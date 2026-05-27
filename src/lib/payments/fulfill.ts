import { supabaseAdmin } from "@/lib/supabase-server";
import { createTournament as dbCreateTournament } from "@/lib/db/tournaments";
import { toDbMatch } from "@/lib/db/mappers";
import { generateIncrementalMatchesForGroup } from "@/data/helpers";
import {
  Tournament,
  TournamentGroup,
  PlayoffConfig,
  PhaseConfig,
  Sport,
  TournamentFormat,
  TournamentScope,
  TournamentTier,
  MatchEventType,
} from "@/types";

const GROUP_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export interface PaymentRecord {
  id: string;
  user_id: string;
  coupon_id: string | null;
  tournament_id: string | null;
  amount_cop: number;
  tournament_data: Record<string, unknown> | null;
}

/**
 * Creates (or upgrades) a tournament from an approved payment, server-side.
 * Idempotent: safe to call from both the Wompi webhook and the payment-return
 * confirmation endpoint — only one will end up linked to the payment.
 * Returns the tournament id, or null on failure.
 */
export async function fulfillTournamentPayment(
  payment: PaymentRecord
): Promise<string | null> {
  const data = payment.tournament_data;
  if (!data) {
    console.error("No tournament_data in payment", payment.id);
    return null;
  }

  // Already fulfilled → idempotent no-op.
  if (payment.tournament_id) return payment.tournament_id;

  // Tier upgrade of an existing tournament.
  if (data.type === "upgrade" && data.tournamentId) {
    return upgradeTournamentFromPayment(payment, data);
  }

  const teamCount = Number(data.teamCount) || 0;
  const isIndividual = Boolean(data.isIndividual);
  const format = data.format as TournamentFormat;
  const groupsInput = (data.groups as Array<{ name: string }> | undefined) ?? [];
  const hasGroups =
    (format === "round-robin" || format === "group-playoff") &&
    groupsInput.length > 0;

  // Create teams with placeholder names.
  const dbTeamIds: string[] = [];
  for (let i = 0; i < teamCount; i++) {
    const { data: teamRow } = await supabaseAdmin
      .from("teams")
      .insert({ name: isIndividual ? `Jugador ${i + 1}` : `Equipo ${i + 1}` })
      .select("id")
      .single();
    if (teamRow) dbTeamIds.push(teamRow.id as string);
  }
  if (dbTeamIds.length !== teamCount) {
    console.error("Failed creating teams for payment", payment.id);
    return null;
  }

  // Build groups / phases (mirrors create-tournament-form.tsx).
  let tournamentGroups: TournamentGroup[] | undefined;
  let playoffConfig: PlayoffConfig | undefined;
  let phaseConfigs: PhaseConfig[] | undefined;

  if (hasGroups) {
    tournamentGroups = groupsInput.map((g, gIdx) => ({
      id: `temp-group-${gIdx}`,
      name: g.name,
      teamIds: [] as string[],
      phase: 1,
    }));
    for (let i = 0; i < dbTeamIds.length; i++) {
      tournamentGroups[i % groupsInput.length].teamIds.push(dbTeamIds[i]);
    }
  }

  if (format === "group-playoff") {
    if (data.hasPhase2) {
      const p2GroupCount = Number(data.phase2GroupCount) || 1;
      const p2Advance = Number(data.phase2AdvancePerGroup) || 1;
      const phase2Groups: TournamentGroup[] = Array.from(
        { length: p2GroupCount },
        (_, i) => ({
          id: `temp-phase2-group-${i}`,
          name: `Grupo ${GROUP_LETTERS[groupsInput.length + i] || `${groupsInput.length + i + 1}`}`,
          teamIds: [] as string[],
          phase: 2,
        })
      );
      tournamentGroups = [...(tournamentGroups || []), ...phase2Groups];

      phaseConfigs = [
        {
          phase: 1,
          advancePerGroup: Number(data.phase1AdvancePerGroup) || 1,
          nextGroupCount: p2GroupCount,
        },
        { phase: 2, advancePerGroup: p2Advance },
      ];

      playoffConfig = {
        advancePerGroup: p2Advance,
        totalAdvancing: p2Advance * p2GroupCount,
      };
    } else {
      const advance = Number(data.advanceCount) || 2;
      playoffConfig = { advancePerGroup: advance, totalAdvancing: advance };
    }
  }

  const tournament: Tournament = {
    id: "temp",
    name: String(data.name ?? "").trim(),
    sport: data.sport as Sport,
    format,
    plan: "paid",
    status: "upcoming",
    description: (data.description as string) || undefined,
    createdBy: payment.user_id,
    teamIds: dbTeamIds,
    matches: [],
    createdAt: new Date().toISOString().split("T")[0],
    startDate: data.startDate as string,
    groups: tournamentGroups,
    playoffConfig,
    groupStageComplete: false,
    enabledStats:
      Array.isArray(data.enabledStats) && data.enabledStats.length > 0
        ? (data.enabledStats as MatchEventType[])
        : undefined,
    bestOf: data.sport === "volleyball" ? (data.bestOf as 3 | 5) : undefined,
    price: payment.amount_cop,
    tier: (data.tier as TournamentTier) || undefined,
    couponId: payment.coupon_id || undefined,
    phaseConfigs,
    scope: (data.scope as TournamentScope) || undefined,
    department: (data.department as string) || undefined,
    municipality: (data.municipality as string) || undefined,
  };

  const tournamentId = await dbCreateTournament(
    tournament,
    undefined,
    supabaseAdmin
  );
  if (!tournamentId) {
    console.error("Failed creating tournament for payment", payment.id);
    return null;
  }

  // Atomic claim: only the first caller (webhook OR confirm) links the payment.
  const { data: claimed } = await supabaseAdmin
    .from("payments")
    .update({ tournament_id: tournamentId, status: "approved" })
    .eq("id", payment.id)
    .is("tournament_id", null)
    .select("id")
    .single();

  if (!claimed) {
    // Another process won the race — drop our duplicate and return the winner.
    await supabaseAdmin.from("tournaments").delete().eq("id", tournamentId);
    const { data: fresh } = await supabaseAdmin
      .from("payments")
      .select("tournament_id")
      .eq("id", payment.id)
      .single();
    return (fresh?.tournament_id as string) ?? null;
  }

  // Mark coupon as used (only if not already claimed).
  if (payment.coupon_id) {
    await supabaseAdmin
      .from("coupons")
      .update({
        used_by: payment.user_id,
        used_at: new Date().toISOString(),
        tournament_id: tournamentId,
      })
      .eq("id", payment.coupon_id)
      .is("used_by", null);
  }

  console.log(`Tournament ${tournamentId} fulfilled for payment ${payment.id}`);
  return tournamentId;
}

async function upgradeTournamentFromPayment(
  payment: PaymentRecord,
  data: Record<string, unknown>
): Promise<string | null> {
  const tournamentId = data.tournamentId as string;

  // Idempotent claim: only the first caller (webhook OR confirm) proceeds.
  const { data: claimed } = await supabaseAdmin
    .from("payments")
    .update({ tournament_id: tournamentId, status: "approved" })
    .eq("id", payment.id)
    .is("tournament_id", null)
    .select("id")
    .single();
  if (!claimed) return tournamentId;

  try {
    await supabaseAdmin
      .from("tournaments")
      .update({ tier: data.newTier, price: data.newPrice, plan: "paid" })
      .eq("id", tournamentId);

    const teamsToAdd = Number(data.teamsToAdd) || 0;
    const isIndividual = Boolean(data.isIndividual);
    const currentCount = Number(data.currentCount) || 0;
    if (teamsToAdd <= 0) return tournamentId;

    // Create + link the new teams.
    const dbTeamIds: string[] = [];
    for (let i = 0; i < teamsToAdd; i++) {
      const { data: teamRow } = await supabaseAdmin
        .from("teams")
        .insert({
          name: isIndividual
            ? `Jugador ${currentCount + i + 1}`
            : `Equipo ${currentCount + i + 1}`,
        })
        .select("id")
        .single();
      if (teamRow) dbTeamIds.push(teamRow.id as string);
    }
    if (dbTeamIds.length > 0) {
      await supabaseAdmin.from("tournament_teams").insert(
        dbTeamIds.map((teamId) => ({
          tournament_id: tournamentId,
          team_id: teamId,
        }))
      );
    }

    // Group assignment + incremental matches (mirrors add-teams-dialog).
    const groupAssignments = data.groupAssignments as
      | (string | null)[]
      | null
      | undefined;
    if (groupAssignments && dbTeamIds.length > 0) {
      const byGroup: Record<string, string[]> = {};
      for (let i = 0; i < dbTeamIds.length; i++) {
        const gId = groupAssignments[i];
        if (!gId) continue;
        (byGroup[gId] ||= []).push(dbTeamIds[i]);
      }

      // Existing group members + current matches (for incremental generation).
      const { data: groupRows } = await supabaseAdmin
        .from("tournament_groups")
        .select("id, tournament_group_teams(team_id)")
        .eq("tournament_id", tournamentId);
      const { data: matchRows } = await supabaseAdmin
        .from("matches")
        .select("match_number, phase")
        .eq("tournament_id", tournamentId);
      const { data: tRow } = await supabaseAdmin
        .from("tournaments")
        .select("double_round_robin")
        .eq("id", tournamentId)
        .single();

      const existingByGroup: Record<string, string[]> = {};
      for (const g of groupRows ?? []) {
        existingByGroup[g.id as string] = (
          (g.tournament_group_teams as { team_id: string }[]) ?? []
        ).map((t) => t.team_id);
      }

      // Assign new teams to their chosen groups.
      for (const [groupId, ids] of Object.entries(byGroup)) {
        await supabaseAdmin
          .from("tournament_group_teams")
          .insert(ids.map((teamId) => ({ group_id: groupId, team_id: teamId })));
      }

      // If the group stage already has a calendar, extend it.
      const hasGroupMatches = (matchRows ?? []).some((m) => m.phase === "group");
      if (hasGroupMatches) {
        let counter =
          Math.max(
            0,
            ...(matchRows ?? []).map((m) => Number(m.match_number) || 0)
          ) + 1;
        const doubleRR = Boolean(tRow?.double_round_robin);
        const newMatches = [];
        for (const [groupId, newIds] of Object.entries(byGroup)) {
          const existing = existingByGroup[groupId] ?? [];
          const ms = generateIncrementalMatchesForGroup(
            groupId,
            newIds,
            existing,
            tournamentId,
            counter,
            doubleRR
          );
          newMatches.push(...ms);
          counter += ms.length;
        }
        if (newMatches.length > 0) {
          await supabaseAdmin.from("matches").insert(newMatches.map(toDbMatch));
        }
      }
    }

    console.log(
      `Tournament ${tournamentId} upgraded to ${data.newTier} for payment ${payment.id}`
    );
    return tournamentId;
  } catch (err) {
    console.error("Error upgrading tournament from payment:", err);
    return tournamentId;
  }
}
