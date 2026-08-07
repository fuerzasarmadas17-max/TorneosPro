import { supabaseAdmin } from "@/lib/supabase-server";
import { createTournament as dbCreateTournament } from "@/lib/db/tournaments";
import { toDbMatch } from "@/lib/db/mappers";
import {
  generateIncrementalMatches,
  generateIncrementalMatchesForGroup,
} from "@/data/helpers";
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

  // Paquete de torneos: el pago no crea un torneo, crea CRÉDITOS. Va antes que
  // todo lo demás porque no tiene `teamCount` ni formato y caería en la rama de
  // creación normal, que armaría un torneo fantasma.
  if (data.type === "pack") {
    return createCreditsFromPayment(payment, data);
  }

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

  // Translate the per-group cupos sent by the wizard (keyed by index) into the
  // tournament-side perGroup map (keyed by the temp ids we just assigned).
  // The wizard's stable client uuids aren't useful here because we rebuild
  // groups server-side; indices give us a stable mapping.
  const readIdxMap = (raw: unknown): Record<number, number> | undefined => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
    return raw as Record<number, number>;
  };
  const advance1ByIdx = readIdxMap(data.advance1ByIdx);
  const advance2ByIdx = readIdxMap(data.advance2ByIdx);

  if (format === "group-playoff") {
    // Phase 1 perGroup map (used by both single-phase and multi-phase setups).
    const perGroup1: Record<string, number> | undefined = tournamentGroups
      ? Object.fromEntries(
          tournamentGroups.map((g, idx) => {
            const fromIdxMap = advance1ByIdx?.[idx];
            const fromLegacy = data.hasPhase2
              ? Number(data.phase1AdvancePerGroup)
              : Number(data.advanceCount);
            return [g.id, Number(fromIdxMap ?? fromLegacy) || 1];
          })
        )
      : undefined;
    const advance1Total = perGroup1
      ? Object.values(perGroup1).reduce((s, n) => s + n, 0)
      : 0;
    const legacy1 = perGroup1 && Object.keys(perGroup1).length > 0
      ? Math.round(advance1Total / Object.keys(perGroup1).length)
      : 1;

    if (data.hasPhase2) {
      const p2GroupCount = Number(data.phase2GroupCount) || 1;
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

      const perGroup2: Record<string, number> = Object.fromEntries(
        phase2Groups.map((g, idx) => [
          g.id,
          Number(advance2ByIdx?.[idx] ?? data.phase2AdvancePerGroup) || 1,
        ])
      );
      const advance2Total = Object.values(perGroup2).reduce((s, n) => s + n, 0);
      const legacy2 = p2GroupCount > 0 ? Math.round(advance2Total / p2GroupCount) : 1;

      phaseConfigs = [
        {
          phase: 1,
          advancePerGroup: legacy1,
          perGroup: perGroup1,
          nextGroupCount: p2GroupCount,
        },
        { phase: 2, advancePerGroup: legacy2, perGroup: perGroup2 },
      ];

      playoffConfig = {
        advancePerGroup: legacy2,
        perGroup: perGroup2,
        totalAdvancing: advance2Total,
      };
    } else {
      playoffConfig = {
        advancePerGroup: legacy1,
        perGroup: perGroup1,
        totalAdvancing: advance1Total,
      };
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
      // Una sola consulta por tabla — incluimos `phase` en groups y
      // `phase_configs` en el tournament para el fallback de nulls.
      const { data: groupRows } = await supabaseAdmin
        .from("tournament_groups")
        .select("id, tournament_group_teams(team_id), phase")
        .eq("tournament_id", tournamentId);
      const { data: matchRows } = await supabaseAdmin
        .from("matches")
        .select("match_number, phase")
        .eq("tournament_id", tournamentId);
      const { data: tRow } = await supabaseAdmin
        .from("tournaments")
        .select("double_round_robin, phase_configs")
        .eq("id", tournamentId)
        .single();

      // Fallback para nulls: si llega un team SIN groupId pero el torneo
      // SÍ tiene grupos, lo asignamos al grupo activo más vacío. Sin esta
      // defensa el equipo quedaba "huérfano" en `tournament.teamIds` sin
      // estar en ningún `group.teamIds` — eso rompe `getPendingMatchups`
      // y deja partidos manuales sin descontar (bug que vimos en torneos
      // con equipos como "Nacional" agregados a mano post-fixture).
      const phaseConfigs = ((tRow?.phase_configs as unknown) ?? []) as Array<{
        phase: number;
        complete?: boolean;
      }>;
      const activePhase = phaseConfigs.find((pc) => !pc.complete)?.phase;
      const activeGroups = (groupRows ?? [])
        .map((g) => ({
          id: g.id as string,
          phase: (g.phase as number) ?? 1,
          teamCount:
            ((g.tournament_group_teams as { team_id: string }[]) ?? []).length,
        }))
        .filter((g) => activePhase == null || g.phase === activePhase);

      const byGroup: Record<string, string[]> = {};
      for (let i = 0; i < dbTeamIds.length; i++) {
        let gId = groupAssignments[i];
        if (!gId && activeGroups.length > 0) {
          // Pick the smallest active group so the assignment stays balanced.
          const fallback = [...activeGroups].sort(
            (a, b) => a.teamCount - b.teamCount
          )[0];
          gId = fallback.id;
          console.warn(
            `[fulfill] payment ${payment.id} sent null groupAssignment for team ${dbTeamIds[i]}; falling back to group ${gId}`
          );
          fallback.teamCount++;
        }
        if (!gId) continue;
        (byGroup[gId] ||= []).push(dbTeamIds[i]);
      }

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
    } else if (dbTeamIds.length > 0) {
      // Liga plana (round-robin sin grupos): el bloque de arriba solo corre si
      // vinieron `groupAssignments`. Sin esta rama, pagar por equipos nuevos en
      // una liga simple los dejaba SIN un solo partido — mismo agujero que en
      // add-teams-dialog, pero del lado del servidor.
      const { data: tRow } = await supabaseAdmin
        .from("tournaments")
        .select("format, double_round_robin")
        .eq("id", tournamentId)
        .single();

      // Eliminación queda afuera: el bracket tiene tamaño fijo.
      if (tRow?.format === "round-robin") {
        const { data: matchRows } = await supabaseAdmin
          .from("matches")
          .select("match_number, phase")
          .eq("tournament_id", tournamentId);

        // Sin calendario todavía no hay nada que extender.
        const flatMatches = (matchRows ?? []).filter((m) => !m.phase);
        if (flatMatches.length > 0) {
          const { data: teamRows } = await supabaseAdmin
            .from("tournament_teams")
            .select("team_id")
            .eq("tournament_id", tournamentId);

          // `tournament_teams` ya incluye a los recién insertados: los sacamos
          // para que no se generen partidos de un equipo contra sí mismo.
          const existingIds = (teamRows ?? [])
            .map((t) => t.team_id as string)
            .filter((id) => !dbTeamIds.includes(id));

          const counter =
            Math.max(
              0,
              ...(matchRows ?? []).map((m) => Number(m.match_number) || 0)
            ) + 1;

          const newMatches = generateIncrementalMatches(
            dbTeamIds,
            existingIds,
            tournamentId,
            counter,
            Boolean(tRow?.double_round_robin)
          );

          if (newMatches.length > 0) {
            await supabaseAdmin
              .from("matches")
              .insert(newMatches.map(toDbMatch));
          }
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

/**
 * Crea los créditos de un paquete de torneos a partir de un pago aprobado.
 *
 * A diferencia del resto de este archivo, NO crea ningún torneo: deja N
 * créditos que el organizador va gastando cuando los necesita. Ver
 * `Por hacer/paquetes-de-torneos.md`.
 *
 * IDEMPOTENCIA — acá no sirve el `payment.tournament_id` que protege a las
 * otras ramas, porque un paquete nunca tiene torneo. La guarda es que ya
 * existan créditos de ESTE pago: si el webhook y la página de retorno corren a
 * la vez, el segundo encuentra los créditos ya creados y no duplica.
 *
 * Devuelve el id del pago (no hay torneo al que apuntar) o null si falló, para
 * que el llamador distinga "se hizo" de "no se hizo".
 */
async function createCreditsFromPayment(
  payment: PaymentRecord,
  data: Record<string, unknown>
): Promise<string | null> {
  const credits = Number(data.credits) || 0;
  const valueCop = Number(data.valueCop) || 0;
  const maxTeams = Number(data.maxTeams) || 0;
  const months = Number(data.months) || 12;

  if (credits <= 0 || maxTeams <= 0) {
    console.error("Pack payment con datos inválidos", payment.id, data);
    return null;
  }

  // ¿Ya se crearon? Entonces este pago ya se cumplió.
  const { count, error: countErr } = await supabaseAdmin
    .from("tournament_credits")
    .select("id", { count: "exact", head: true })
    .eq("payment_id", payment.id);

  if (countErr) {
    console.error("No se pudo verificar créditos existentes", countErr);
    return null;
  }
  if ((count ?? 0) > 0) return payment.id; // ya cumplido

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + months);

  const rows = Array.from({ length: credits }, () => ({
    user_id: payment.user_id,
    payment_id: payment.id,
    value_cop: valueCop,
    max_teams: maxTeams,
    expires_at: expiresAt.toISOString(),
  }));

  const { error: insErr } = await supabaseAdmin
    .from("tournament_credits")
    .insert(rows);

  if (insErr) {
    console.error("No se pudieron crear los créditos del paquete", insErr);
    return null;
  }

  return payment.id;
}
