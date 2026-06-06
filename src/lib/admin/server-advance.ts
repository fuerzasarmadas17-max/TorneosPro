import { supabaseAdmin } from "@/lib/supabase-server";
import { fetchTournamentById, updateTournament, insertMatchesForPhase, assignTeamsToGroup } from "@/lib/db/tournaments";
import { updateMatchResult, updateMatchDetails } from "@/lib/db/matches";
import { fillPlayoffBracket, fillPhase2Groups, getFinalSeriesChampion } from "@/data/helpers";
import { Tournament, Match, PhaseConfig } from "@/types";
import {
  generateRandomResult,
  getCurrentPhaseMatches,
  getMatchPhaseKey,
  getNextJornadaMatches,
  shouldForceWinner,
} from "@/lib/admin/auto-advance";

export type AdvanceMode = "jornada" | "phase";

interface AdvanceResult {
  matchesAffected: number;
}

/**
 * Server-side orchestrator for the admin "Avanzar" action. Fetches the
 * tournament with `supabaseAdmin` (bypasses RLS), picks the matches to fill
 * according to `mode`, writes random results + downstream cascade (winner
 * propagation, phase completion, playoff bracket generation) — all using
 * `supabaseAdmin`. Mirrors `tournament-context.tsx:updateMatch` cascade but
 * server-side so an admin can advance any tournament without RLS grants.
 */
export async function advanceTournament(
  tournamentId: string,
  mode: AdvanceMode
): Promise<AdvanceResult> {
  let tournament = await fetchTournamentById(tournamentId, supabaseAdmin);
  if (!tournament) {
    throw new Error("Tournament not found");
  }

  let targets =
    mode === "jornada"
      ? getNextJornadaMatches(tournament)
      : getCurrentPhaseMatches(tournament);

  if (targets.length === 0) return { matchesAffected: 0 };

  // Quick fix (Pieza F follow-up): if completing these targets would close
  // the current phase, hold back the last match so the organizer completes
  // it manually via the UI. Applies to BOTH group phases (the manual
  // completion triggers the new "fase completada" modal that hands off to
  // the playoffs configurator) AND playoff bracket rounds (so the admin can
  // play the last bracket match by hand).
  //
  // Snapshot to a const so the .filter closure keeps the non-null narrowing
  // (tournament is a `let` and gets reassigned later in the loop below).
  const tSnap = tournament;
  const phaseKey = getMatchPhaseKey(targets[0], tSnap);
  const remainingInPhase = tSnap.matches.filter(
    (m) =>
      m.status !== "completed" &&
      m.homeTeamId &&
      m.awayTeamId &&
      getMatchPhaseKey(m, tSnap) === phaseKey
  ).length;
  const wouldClosePhase = targets.length >= remainingInPhase;
  if (wouldClosePhase) {
    // Leave the last match for the human. If there's only one match total
    // and we'd skip it, targets becomes [] — server returns
    // matchesAffected=0 and the UI prompts the admin to play it manually.
    targets = targets.slice(0, -1);
  }

  if (targets.length === 0) return { matchesAffected: 0 };

  for (const target of targets) {
    const result = generateRandomResult(
      tournament.sport,
      tournament.bestOf,
      shouldForceWinner(tournament, target)
    );
    const winnerId =
      result.homeScore > result.awayScore
        ? target.homeTeamId
        : result.awayScore > result.homeScore
          ? target.awayTeamId
          : null;

    await updateMatchResult(
      target.id,
      result.homeScore,
      result.awayScore,
      winnerId,
      undefined,
      result.sets,
      supabaseAdmin
    );

    // Refresh local snapshot with the just-completed match so cascade sees it.
    tournament = applyMatchUpdateLocally(tournament, target.id, {
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      winnerId,
    });

    tournament = await applyCascadeAfterMatchUpdate(tournament, target.id);
  }

  return { matchesAffected: targets.length };
}

/** Returns a copy of the tournament with the given match marked completed. */
function applyMatchUpdateLocally(
  tournament: Tournament,
  matchId: string,
  patch: { homeScore: number; awayScore: number; winnerId: string | null }
): Tournament {
  return {
    ...tournament,
    matches: tournament.matches.map((m) =>
      m.id === matchId
        ? {
            ...m,
            homeScore: patch.homeScore,
            awayScore: patch.awayScore,
            winnerId: patch.winnerId,
            status: "completed" as const,
          }
        : m
    ),
  };
}

/**
 * Mirrors the cascade inside `tournament-context.tsx:updateMatch`:
 * - Propagates the winner in elimination / playoff brackets.
 * - Marks phase complete + generates next phase / playoff bracket.
 * - Updates tournament status (in-progress / completed).
 */
async function applyCascadeAfterMatchUpdate(
  tournament: Tournament,
  matchId: string
): Promise<Tournament> {
  const t = tournament;
  const match = t.matches.find((m) => m.id === matchId);
  if (!match) return t;

  // 1. Winner propagation (elimination or playoff phase).
  const shouldPropagate =
    t.format === "elimination" ||
    (t.format === "group-playoff" && match.phase === "playoff");

  if (shouldPropagate && match.winnerId && match.nextMatchId) {
    const nextMatch = t.matches.find((m) => m.id === match.nextMatchId);
    if (nextMatch) {
      const feeders = t.matches.filter((m) => m.nextMatchId === nextMatch.id);
      const feederIndex = feeders.findIndex((m) => m.id === matchId);
      const updates =
        feederIndex === 0
          ? { homeTeamId: match.winnerId }
          : { awayTeamId: match.winnerId };
      await updateMatchDetails(nextMatch.id, updates, supabaseAdmin);
    }
  }

  // 2-3. Phase / playoff cascade for group-playoff format.
  let updatedTournament = t;

  if (t.format === "group-playoff" && t.phaseConfigs?.length) {
    updatedTournament = await processMultiPhaseCascade(t);
  } else if (t.format === "group-playoff" && !t.groupStageComplete) {
    updatedTournament = await processSinglePhaseCascade(t);
  }

  // 4. Tournament status. For group-playoff / elimination, "completed" is
  // gated on the final SERIES having a champion (Pieza I helper handles
  // single / double_leg / best-of-N). Mirrors tournament-context.tsx cascade.
  const matches = updatedTournament.matches;
  let allCompleted: boolean;
  if (
    updatedTournament.format === "group-playoff" ||
    updatedTournament.format === "elimination"
  ) {
    allCompleted = getFinalSeriesChampion(updatedTournament) != null;
  } else {
    allCompleted = matches.length > 0 && matches.every((m) => m.status === "completed");
  }
  const anyStarted = matches.some(
    (m) =>
      m.status === "completed" ||
      m.status === "scheduled" ||
      m.status === "postponed"
  );
  const newStatus = allCompleted
    ? ("completed" as const)
    : anyStarted
      ? ("in-progress" as const)
      : updatedTournament.status;

  if (newStatus !== updatedTournament.status) {
    await updateTournament(
      updatedTournament.id,
      { status: newStatus },
      supabaseAdmin
    );
    updatedTournament = { ...updatedTournament, status: newStatus };
  }

  return updatedTournament;
}

/** Multi-phase group-playoff: walk phases, complete the first pending one. */
async function processMultiPhaseCascade(
  t: Tournament
): Promise<Tournament> {
  const phaseConfigs = t.phaseConfigs!.map((pc) => ({ ...pc }));
  let updatedMatches = t.matches;
  let updatedGroups = t.groups;
  let groupStageComplete = t.groupStageComplete;

  for (const pc of phaseConfigs) {
    if (pc.complete) continue;
    const phaseGroups = (updatedGroups || []).filter(
      (g) => g.phase === pc.phase
    );
    const phaseGroupIds = new Set(phaseGroups.map((g) => g.id));
    const phaseMatches = updatedMatches.filter(
      (m) => m.phase === "group" && m.groupId && phaseGroupIds.has(m.groupId)
    );
    if (
      phaseMatches.length === 0 ||
      !phaseMatches.every((m) => m.status === "completed")
    ) {
      break;
    }

    pc.complete = true;

    if (pc.nextGroupCount) {
      // Intermediate phase → fill next phase groups + matches.
      const result = fillPhase2Groups(
        { ...t, groups: updatedGroups, matches: updatedMatches },
        pc
      );
      await insertMatchesForPhase(
        result.phase2Matches,
        t.id,
        supabaseAdmin
      );
      for (const [groupId, teamIds] of Object.entries(
        result.groupTeamAssignments
      )) {
        await assignTeamsToGroup(groupId, teamIds, supabaseAdmin);
      }
      updatedMatches = [...updatedMatches, ...result.phase2Matches];
      updatedGroups = (updatedGroups || []).map((g) =>
        result.groupTeamAssignments[g.id]
          ? { ...g, teamIds: result.groupTeamAssignments[g.id] }
          : g
      );
    } else {
      // Last group phase → fill playoff bracket.
      const filled = fillPlayoffBracket(
        { ...t, groups: updatedGroups, matches: updatedMatches },
        pc.phase
      );
      await persistPlayoffBracket(t, filled);
      updatedMatches = filled;
      groupStageComplete = true;
      await updateTournament(
        t.id,
        { groupStageComplete: true },
        supabaseAdmin
      );
    }

    await updateTournament(
      t.id,
      { phaseConfigs: phaseConfigs as PhaseConfig[] },
      supabaseAdmin
    );
    break; // Only process one phase per call.
  }

  return {
    ...t,
    matches: updatedMatches,
    groups: updatedGroups,
    phaseConfigs,
    groupStageComplete,
  };
}

/** Single-phase group-playoff: when all group matches done, build playoffs. */
async function processSinglePhaseCascade(
  t: Tournament
): Promise<Tournament> {
  const groupMatches = t.matches.filter((m) => m.phase === "group");
  const allDone =
    groupMatches.length > 0 &&
    groupMatches.every((m) => m.status === "completed");
  if (!allDone) return t;

  const filled = fillPlayoffBracket(t);
  await persistPlayoffBracket(t, filled);
  await updateTournament(t.id, { groupStageComplete: true }, supabaseAdmin);

  return { ...t, matches: filled, groupStageComplete: true };
}

/**
 * Persists the difference between the tournament's current playoff matches and
 * the freshly-filled bracket: inserts new playoff matches, updates team
 * assignments on existing ones.
 */
async function persistPlayoffBracket(
  t: Tournament,
  filled: Match[]
): Promise<void> {
  const existingIds = new Set(t.matches.map((m) => m.id));
  const newPlayoffMatches = filled.filter(
    (m) => m.phase === "playoff" && !existingIds.has(m.id)
  );
  if (newPlayoffMatches.length > 0) {
    await insertMatchesForPhase(newPlayoffMatches, t.id, supabaseAdmin);
  }
  const updatedPlayoffMatches = filled.filter(
    (m) => m.phase === "playoff" && existingIds.has(m.id)
  );
  for (const pm of updatedPlayoffMatches) {
    if (pm.homeTeamId || pm.awayTeamId) {
      await updateMatchDetails(
        pm.id,
        {
          homeTeamId: pm.homeTeamId ?? undefined,
          awayTeamId: pm.awayTeamId ?? undefined,
          ...(pm.winnerId
            ? {
                winnerId: pm.winnerId,
                homeScore: pm.homeScore ?? undefined,
                awayScore: pm.awayScore ?? undefined,
                status: pm.status,
              }
            : {}),
        },
        supabaseAdmin
      );
    }
  }
}
