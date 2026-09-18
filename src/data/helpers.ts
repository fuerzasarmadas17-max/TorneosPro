import { FAIR_PLAY_POINTS, getWinPoints, Match, MatchEventType, MatchPhase, Sport, StandingsEntry, Team, Tournament, TournamentCup, TournamentGroup, PlayoffConfig, PhaseConfig, User } from "@/types";

type FinalFormat = NonNullable<Tournament["playoffFinalFormat"]>;

/** Cuántos partidos tiene la serie final en cada formato. */
export const FINAL_SERIES_LENGTH: Record<FinalFormat, number> = {
  single: 1,
  double_leg: 2,
  best_of_5: 5,
  best_of_7: 7,
};

/**
 * Pieza I: identify the winner of the final series, if any.
 *
 * - "single" / no format set: champion = winnerId of the only final match.
 * - "double_leg": champion = winnerId of the vuelta (already an aggregate
 *   winner thanks to Pieza G's aggregate-winner fix).
 * - "best_of_5" / "best_of_7": count wins per team across all final series
 *   matches; champion is the first team to win ceil(N/2).
 *
 * Returns null when the series is still open (no team has clinched yet).
 *
 * Con varias copas, "el campeón del torneo" es el de la copa principal (la
 * Oro). El de cada copa sale de `getCupChampion`, y si el torneo terminó lo
 * dice `isBracketFinished`, no esta función.
 */
export function getFinalSeriesChampion(tournament: Tournament): string | null {
  const principal = getPrincipalCup(tournament);
  if (principal) return getCupChampion(tournament, principal.id);

  const playoff = tournament.matches.filter(
    (m) =>
      m.phase === "playoff" || (!m.phase && tournament.format === "elimination")
  );
  return getSeriesChampion(
    playoff,
    tournament.playoffFinalFormat,
    !!tournament.playoffDoubleLeg
  );
}

/** El ganador de la serie final de UNA llave: `matches` son los partidos de
 *  esa llave y nada más. */
function getSeriesChampion(
  playoff: Match[],
  finalFormat: Tournament["playoffFinalFormat"],
  bracketDoubleLeg: boolean
): string | null {
  if (playoff.length === 0) return null;
  const maxRound = Math.max(...playoff.map((m) => m.round));
  const lastRound = playoff
    .filter((m) => m.round === maxRound)
    .sort((a, b) => a.matchNumber - b.matchNumber);

  // Best-of-N: count wins per team across the series.
  if (finalFormat === "best_of_5" || finalFormat === "best_of_7") {
    const target = finalFormat === "best_of_5" ? 3 : 4;
    const wins: Record<string, number> = {};
    for (const m of lastRound) {
      if (m.status === "completed" && m.winnerId) {
        wins[m.winnerId] = (wins[m.winnerId] ?? 0) + 1;
      }
    }
    for (const [teamId, count] of Object.entries(wins)) {
      if (count >= target) return teamId;
    }
    return null;
  }

  // Double-leg final: champion is whoever has aggregate winner on the
  // vuelta (the last completed match of the pair).
  if (finalFormat === "double_leg" ||
      // Implicit double_leg when only the bracket-wide flag is set and
      // no explicit final format chosen.
      (!finalFormat && bracketDoubleLeg)) {
    const finalMatch = lastRound[lastRound.length - 1];
    return finalMatch?.status === "completed" ? finalMatch.winnerId ?? null : null;
  }

  // Single (default for everything else): champion = winnerId of the
  // single final match.
  const finalMatch = lastRound[0];
  return finalMatch?.status === "completed" ? finalMatch?.winnerId ?? null : null;
}

// --- Copas (torneo con varias llaves en paralelo) ---
//
// Una copa es una llave con nombre: sus partidos son `phase: "playoff"` con
// `cupId`. El formato de la final se elige una sola vez para todo el torneo
// (`playoffFinalFormat`), pero cada copa llega a su final en otro momento: la
// primera que llega lo elige, y a las demás hay que "armarles" la final con
// ese formato cuando llegan. Hasta que eso pasa, esa copa se lee con el
// formato natural de su llave (partido único, o ida y vuelta si la llave es de
// ida y vuelta). Ver `Por hacer/torneos/grupos-y-copas.md`, secciones 3 y 5.

/** La copa principal (la de `sortOrder` más bajo), o undefined si el torneo es
 *  de una sola llave. */
export function getPrincipalCup(tournament: Tournament): TournamentCup | undefined {
  if (!tournament.cups?.length) return undefined;
  return [...tournament.cups].sort((a, b) => a.sortOrder - b.sortOrder)[0];
}

/** Los partidos de la llave de una copa. */
export function getCupMatches(tournament: Tournament, cupId: string): Match[] {
  return tournament.matches.filter(
    (m) => m.phase === "playoff" && m.cupId === cupId
  );
}

/** El formato que tiene la llave sin que nadie arme la final: ida y vuelta si
 *  toda la llave se juega así, si no partido único. */
function naturalFinalFormat(tournament: Tournament): FinalFormat {
  return tournament.playoffDoubleLeg ? "double_leg" : "single";
}

/**
 * ¿La final de esta copa ya tiene la forma del formato elegido? Es decir: la
 * última ronda tiene tantos partidos como pide el formato, todos con los dos
 * finalistas puestos. Sin formato elegido no hay nada que armar.
 */
export function isCupFinalReady(tournament: Tournament, cupId: string): boolean {
  const format = tournament.playoffFinalFormat;
  if (!format) return true;
  const matches = getCupMatches(tournament, cupId);
  if (matches.length === 0) return false;
  const maxRound = Math.max(...matches.map((m) => m.round));
  const finals = matches.filter((m) => m.round === maxRound);
  return (
    finals.length === FINAL_SERIES_LENGTH[format] &&
    finals.every((m) => !!m.homeTeamId && !!m.awayTeamId)
  );
}

/** El formato con el que hay que LEER la final de esta copa hoy: el elegido
 *  si la final ya está armada, si no ninguno (la llave natural). */
export function getCupFinalFormat(
  tournament: Tournament,
  cupId: string
): Tournament["playoffFinalFormat"] {
  return isCupFinalReady(tournament, cupId)
    ? tournament.playoffFinalFormat
    : undefined;
}

/**
 * ¿Hay que armarle la final a esta copa? Pasa cuando el formato ya se eligió
 * (lo eligió otra copa), esta copa ya tiene a sus dos finalistas, la final no
 * tiene ningún resultado y el formato elegido no es el que la llave ya trae.
 */
export function cupNeedsFinalSetup(tournament: Tournament, cupId: string): boolean {
  const format = tournament.playoffFinalFormat;
  if (!format) return false;
  if (format === naturalFinalFormat(tournament)) return false;
  if (isCupFinalReady(tournament, cupId)) return false;
  const finalists = getCupFinalists(tournament, cupId);
  if (!finalists) return false;
  const matches = getCupMatches(tournament, cupId);
  const maxRound = Math.max(...matches.map((m) => m.round));
  const finalRounds = tournament.playoffDoubleLeg ? [maxRound - 1, maxRound] : [maxRound];
  return !matches.some(
    (m) =>
      finalRounds.includes(m.round) &&
      (m.homeScore != null || m.awayScore != null || m.winnerId != null)
  );
}

/** Los dos finalistas de una copa, o null si todavía no se conocen. En una
 *  llave de ida y vuelta viven en la ida de la final (la vuelta puede estar
 *  vacía hasta que se arme). */
export function getCupFinalists(
  tournament: Tournament,
  cupId: string
): { home: string; away: string } | null {
  const matches = getCupMatches(tournament, cupId);
  if (matches.length === 0) return null;
  const maxRound = Math.max(...matches.map((m) => m.round));
  const ready = isCupFinalReady(tournament, cupId) && !!tournament.playoffFinalFormat;
  const idaRound = !ready && tournament.playoffDoubleLeg ? maxRound - 1 : maxRound;
  const first = matches
    .filter((m) => m.round === idaRound)
    .sort((a, b) => a.matchNumber - b.matchNumber)[0];
  if (!first?.homeTeamId || !first?.awayTeamId) return null;
  return { home: first.homeTeamId, away: first.awayTeamId };
}

/** El campeón de una copa, o null si su final no terminó. */
export function getCupChampion(tournament: Tournament, cupId: string): string | null {
  const matches = getCupMatches(tournament, cupId);
  const ready = isCupFinalReady(tournament, cupId);
  // La final todavía no tiene la forma del formato elegido (un mejor de 5 que
  // sigue siendo un partido): no se puede coronar a nadie hasta armarla.
  if (!ready && tournament.playoffFinalFormat !== naturalFinalFormat(tournament)) {
    return null;
  }
  return getSeriesChampion(
    matches,
    ready ? tournament.playoffFinalFormat : undefined,
    !!tournament.playoffDoubleLeg
  );
}

/**
 * ¿Terminaron los playoffs? Con una sola llave, cuando la final tiene campeón.
 * Con copas, cuando TODAS lo tienen: si no, el torneo se daría por terminado
 * con la primera final que se juegue y las otras copas a medio jugar.
 */
export function isBracketFinished(tournament: Tournament): boolean {
  if (tournament.cups?.length) {
    return tournament.cups.every((c) => getCupChampion(tournament, c.id) != null);
  }
  return getFinalSeriesChampion(tournament) != null;
}

// --- Per-group advancement helpers ---

/**
 * Resolve the effective per-group advancement map for a phase or playoff
 * config. Returns the explicit `perGroup` map when present, otherwise expands
 * the legacy uniform `advancePerGroup` to every group id passed in.
 *
 * Use this anywhere advancement counts are needed instead of reading
 * `config.advancePerGroup` directly — it transparently handles both old
 * tournaments (uniform) and new ones (per-group).
 */
export function getEffectivePerGroup(
  config: { advancePerGroup: number; perGroup?: Record<string, number> },
  groupIds: string[]
): Record<string, number> {
  if (config.perGroup && Object.keys(config.perGroup).length > 0) {
    // Fill in any group ids missing from the stored map with the legacy
    // uniform value, so callers can rely on every id being present.
    const result: Record<string, number> = { ...config.perGroup };
    for (const id of groupIds) {
      if (result[id] == null) result[id] = config.advancePerGroup;
    }
    return result;
  }
  return Object.fromEntries(groupIds.map((id) => [id, config.advancePerGroup]));
}

/**
 * Compute the ranked list of teams classified from a finished group phase.
 * Returns one entry per advancing team in the canonical seeding order:
 * all 1st-place finishers, then all 2nd-place, etc., interleaved across
 * groups (1°A, 1°B, 2°A, 2°B, ...). Each entry carries enough metadata to
 * present the user with a row like "1° Grupo A — Equipo X" in the
 * configuration dialog.
 *
 * Honors perGroup cupos: a group with cupo=2 only contributes its top 2.
 */
export interface ClassifiedTeam {
  teamId: string;
  fromGroupId: string;
  fromGroupName: string;
  /** 1-based position within the source group (1 = winner). */
  position: number;
}

export function getClassifiedTeamsRanked(
  tournament: Tournament,
  fromPhase: number
): ClassifiedTeam[] {
  const phaseGroups = (tournament.groups ?? []).filter((g) => g.phase === fromPhase);
  if (phaseGroups.length === 0) return [];

  // Source of truth for cupos: phaseConfig if available, otherwise
  // playoffConfig (last-phase case), otherwise default 2 per group.
  const pc = tournament.phaseConfigs?.find((c) => c.phase === fromPhase);
  const isLastPhase = !tournament.phaseConfigs?.some((c) => c.phase > fromPhase);
  const config = isLastPhase
    ? (tournament.playoffConfig ?? pc)
    : pc;
  const perGroup = config
    ? getEffectivePerGroup(config, phaseGroups.map((g) => g.id))
    : Object.fromEntries(phaseGroups.map((g) => [g.id, 2]));

  // Rank teams in each source group.
  const rankedByGroup = phaseGroups.map((group) => {
    const groupMatches = tournament.matches.filter(
      (m) => m.phase === "group" && m.groupId === group.id
    );
    return {
      group,
      ranked: rankTeamsInGroup(group.teamIds, groupMatches, tournament.sport, fairPlayEnabled(tournament)),
    };
  });

  // Interleave by seed position so the output reads 1°A, 1°B, ..., 2°A, 2°B, ...
  const maxSeed = Math.max(0, ...phaseGroups.map((g) => perGroup[g.id] ?? 0));
  const out: ClassifiedTeam[] = [];
  for (let seed = 0; seed < maxSeed; seed++) {
    for (const { group, ranked } of rankedByGroup) {
      const cupo = perGroup[group.id] ?? 0;
      if (seed < cupo && ranked[seed]) {
        out.push({
          teamId: ranked[seed],
          fromGroupId: group.id,
          fromGroupName: group.name,
          position: seed + 1,
        });
      }
    }
  }
  return out;
}

// --- Utility ---

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Circle method round-robin ---

interface RoundRobinOptions {
  phase?: "group" | "playoff";
  groupId?: string;
  matchCounterStart?: number;
  doubleRoundRobin?: boolean;
}

export function generateRoundRobinCircle(
  teamIds: string[],
  tournamentId: string,
  options?: RoundRobinOptions
): { matches: Match[]; nextMatchCounter: number } {
  const teams = [...teamIds];
  const hasBye = teams.length % 2 !== 0;
  if (hasBye) teams.push("__BYE__");

  const n = teams.length;
  const totalRounds = n - 1;
  const matches: Match[] = [];
  let matchCounter = options?.matchCounterStart ?? 1;

  const fixed = teams[0];
  const rotating = teams.slice(1);

  for (let round = 0; round < totalRounds; round++) {
    const roundNumber = round + 1;
    const pairings: [string, string][] = [];

    pairings.push([fixed, rotating[0]]);
    for (let i = 1; i < n / 2; i++) {
      pairings.push([rotating[i], rotating[rotating.length - i]]);
    }

    for (const [home, away] of pairings) {
      if (home === "__BYE__" || away === "__BYE__") continue;
      matches.push({
        id: `${tournamentId}-m-${matchCounter}`,
        tournamentId,
        round: roundNumber,
        matchNumber: matchCounter,
        homeTeamId: home,
        awayTeamId: away,
        homeScore: null,
        awayScore: null,
        winnerId: null,
        status: "unscheduled",
        ...(options?.phase ? { phase: options.phase } : {}),
        ...(options?.groupId ? { groupId: options.groupId } : {}),
      });
      matchCounter++;
    }

    rotating.unshift(rotating.pop()!);
  }

  // Double round-robin (ida y vuelta): mirror all matches with home/away swapped
  if (options?.doubleRoundRobin) {
    const firstLegMatches = [...matches];
    for (const m of firstLegMatches) {
      matches.push({
        id: `${tournamentId}-m-${matchCounter}`,
        tournamentId,
        round: m.round + totalRounds,
        matchNumber: matchCounter,
        homeTeamId: m.awayTeamId,
        awayTeamId: m.homeTeamId,
        homeScore: null,
        awayScore: null,
        winnerId: null,
        status: "unscheduled",
        ...(options?.phase ? { phase: options.phase } : {}),
        ...(options?.groupId ? { groupId: options.groupId } : {}),
      });
      matchCounter++;
    }
  }

  return { matches, nextMatchCounter: matchCounter };
}

// --- Additional rounds for an existing group phase ---

/**
 * Genera rondas adicionales para un grupo que ya tiene partidos creados.
 * Reutiliza `generateRoundRobinCircle` y solo offsetea los `round` para
 * que continúen secuencialmente desde el último ya existente.
 *
 *  - `numRounds: 1` → una ronda extra completa (vuelta), con localía
 *    invertida respecto a la "ida" para que el organizador no repita el
 *    mismo enfrentamiento idéntico (lo natural en futbol/básquet).
 *  - `numRounds: 2` → dos rondas extra (ida + vuelta nueva). La primera
 *    arranca igual que la ida original, la segunda viene invertida —
 *    misma lógica que `doubleRoundRobin: true` en el generador base.
 *
 * No toca el flag `doubleRoundRobin` del torneo a propósito: el flag
 * representa cómo se CREÓ la fase, no cuántas vueltas tiene ahora.
 * Tocarlo rompería tablas de posiciones y reportes históricos.
 */
export function generateAdditionalGroupRounds(
  teamIds: string[],
  tournamentId: string,
  options: {
    groupId: string;
    numRounds: 1 | 2;
    roundOffset: number;
    matchCounterStart: number;
  }
): { matches: Match[]; nextMatchCounter: number } {
  const { groupId, numRounds, roundOffset, matchCounterStart } = options;

  if (numRounds === 1) {
    // Una vuelta adicional con localía invertida.
    const { matches: base, nextMatchCounter } = generateRoundRobinCircle(
      teamIds,
      tournamentId,
      {
        phase: "group",
        groupId,
        matchCounterStart,
        doubleRoundRobin: false,
      }
    );
    const matches = base.map((m) => ({
      ...m,
      round: m.round + roundOffset,
      homeTeamId: m.awayTeamId,
      awayTeamId: m.homeTeamId,
    }));
    return { matches, nextMatchCounter };
  }

  // Dos vueltas adicionales = ida + vuelta. `doubleRoundRobin: true` ya
  // ordena los matches en (ida) + (vuelta-invertida), solo hay que
  // empujar todos los round numbers para continuar desde el último.
  const { matches: base, nextMatchCounter } = generateRoundRobinCircle(
    teamIds,
    tournamentId,
    {
      phase: "group",
      groupId,
      matchCounterStart,
      doubleRoundRobin: true,
    }
  );
  const matches = base.map((m) => ({ ...m, round: m.round + roundOffset }));
  return { matches, nextMatchCounter };
}

// --- Pending matchups helper ---

export function getPendingMatchups(
  teamIds: string[],
  matches: Match[],
  doubleRoundRobin?: boolean
): { home: string; away: string }[] {
  const counts = new Map<string, number>();
  for (const m of matches) {
    if (m.homeTeamId && m.awayTeamId) {
      const key = [m.homeTeamId, m.awayTeamId].sort().join("|");
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  const target = doubleRoundRobin ? 2 : 1;
  const pending: { home: string; away: string }[] = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      const key = [teamIds[i], teamIds[j]].sort().join("|");
      const current = counts.get(key) || 0;
      for (let k = current; k < target; k++) {
        pending.push({ home: teamIds[i], away: teamIds[j] });
      }
    }
  }
  return pending;
}

// --- Empty bracket/schedule generators (manual mode) ---

export function generateEmptyEliminationBracket(
  teamCount: number,
  tournamentId: string,
  doubleRoundRobin?: boolean
): Match[] {
  const numRounds = Math.log2(teamCount);
  const singleLeg: Match[] = [];
  let matchCounter = 1;

  // Round 1
  for (let i = 0; i < teamCount / 2; i++) {
    singleLeg.push({
      id: `${tournamentId}-m-${matchCounter}`,
      tournamentId,
      round: 1,
      matchNumber: matchCounter,
      homeTeamId: null,
      awayTeamId: null,
      homeScore: null,
      awayScore: null,
      winnerId: null,
      status: "unscheduled",
      nextMatchId: null,
    });
    matchCounter++;
  }

  let prevRoundStart = 0;
  let prevRoundSize = teamCount / 2;

  for (let round = 2; round <= numRounds; round++) {
    const currentRoundSize = prevRoundSize / 2;

    for (let i = 0; i < currentRoundSize; i++) {
      const matchId = `${tournamentId}-m-${matchCounter}`;
      singleLeg.push({
        id: matchId,
        tournamentId,
        round,
        matchNumber: matchCounter,
        homeTeamId: null,
        awayTeamId: null,
        homeScore: null,
        awayScore: null,
        winnerId: null,
        status: "unscheduled",
        nextMatchId: null,
      });

      singleLeg[prevRoundStart + i * 2].nextMatchId = matchId;
      singleLeg[prevRoundStart + i * 2 + 1].nextMatchId = matchId;
      matchCounter++;
    }
    prevRoundStart += prevRoundSize;
    prevRoundSize = currentRoundSize;
  }

  if (!doubleRoundRobin) return singleLeg;
  return toDoubleLegElimination(singleLeg, tournamentId, matchCounter);
}

// generateEmptyRoundRobinSlots and generateEmptyGroupPlayoffMatches removed
// Manual mode now starts with 0 matches and uses JornadaBuilder

export function generateEliminationMatches(
  teamIds: string[],
  tournamentId: string,
  doubleRoundRobin?: boolean
): Match[] {
  const numTeams = teamIds.length;
  const numRounds = Math.log2(numTeams);
  const singleLeg: Match[] = [];
  let matchCounter = 1;

  // Round 1: pair up all teams
  for (let i = 0; i < numTeams; i += 2) {
    singleLeg.push({
      id: `${tournamentId}-m-${matchCounter}`,
      tournamentId,
      round: 1,
      matchNumber: matchCounter,
      homeTeamId: teamIds[i],
      awayTeamId: teamIds[i + 1],
      homeScore: null,
      awayScore: null,
      winnerId: null,
      status: "unscheduled",
      nextMatchId: null,
    });
    matchCounter++;
  }

  // Subsequent rounds: matches with TBD teams
  let prevRoundStart = 0;
  let prevRoundSize = numTeams / 2;

  for (let round = 2; round <= numRounds; round++) {
    const currentRoundSize = prevRoundSize / 2;

    for (let i = 0; i < currentRoundSize; i++) {
      const matchId = `${tournamentId}-m-${matchCounter}`;
      singleLeg.push({
        id: matchId,
        tournamentId,
        round,
        matchNumber: matchCounter,
        homeTeamId: null,
        awayTeamId: null,
        homeScore: null,
        awayScore: null,
        winnerId: null,
        status: "unscheduled",
        nextMatchId: null,
      });

      // Link the two feeder matches to this match
      const feederIdx1 = prevRoundStart + i * 2;
      const feederIdx2 = prevRoundStart + i * 2 + 1;
      singleLeg[feederIdx1].nextMatchId = matchId;
      singleLeg[feederIdx2].nextMatchId = matchId;

      matchCounter++;
    }
    prevRoundStart += prevRoundSize;
    prevRoundSize = currentRoundSize;
  }

  if (!doubleRoundRobin) return singleLeg;
  return toDoubleLegElimination(singleLeg, tournamentId, matchCounter);
}

/**
 * Transform single-leg elimination bracket to double-leg (ida y vuelta).
 * Ida matches go to odd rounds (1,3,5...), vuelta to even rounds (2,4,6...).
 * Only vuelta matches carry nextMatchId to the ida of the next bracket round.
 */
function toDoubleLegElimination(
  singleLeg: Match[],
  tournamentId: string,
  nextCounter: number
): Match[] {
  const result: Match[] = [];
  let vueltaCounter = nextCounter;

  for (const match of singleLeg) {
    // Ida: same ID, remapped round (1→1, 2→3, 3→5...), no nextMatchId
    result.push({
      ...match,
      round: match.round * 2 - 1,
      nextMatchId: null,
    });

    // Vuelta: new ID, even round (1→2, 2→4, 3→6...), swapped teams, inherits nextMatchId
    result.push({
      id: `${tournamentId}-m-${vueltaCounter}`,
      tournamentId,
      round: match.round * 2,
      matchNumber: vueltaCounter,
      homeTeamId: match.awayTeamId,
      awayTeamId: match.homeTeamId,
      homeScore: null,
      awayScore: null,
      winnerId: null,
      status: "unscheduled",
      nextMatchId: match.nextMatchId,
    });
    vueltaCounter++;
  }

  return result;
}

export function generateRoundRobinMatches(
  teamIds: string[],
  tournamentId: string,
  doubleRoundRobin?: boolean
): Match[] {
  return generateRoundRobinCircle(teamIds, tournamentId, { doubleRoundRobin }).matches;
}

export function generateGroupRoundRobinMatches(
  groups: TournamentGroup[],
  tournamentId: string,
  doubleRoundRobin?: boolean
): Match[] {
  const allMatches: Match[] = [];
  let counter = 1;

  for (const group of groups) {
    const { matches, nextMatchCounter } = generateRoundRobinCircle(
      group.teamIds,
      tournamentId,
      { phase: "group", groupId: group.id, matchCounterStart: counter, doubleRoundRobin }
    );
    allMatches.push(...matches);
    counter = nextMatchCounter;
  }

  return allMatches;
}

export function getRoundLabel(round: number, totalRounds: number): string {
  const fromFinal = totalRounds - round;
  if (fromFinal === 0) return "Final";
  if (fromFinal === 1) return "Semifinal";
  if (fromFinal === 2) return "Cuartos de Final";
  if (fromFinal === 3) return "Octavos de Final";
  return `Ronda ${round}`;
}

/** El torneo premia el juego limpio (la stat está habilitada). */
export function fairPlayEnabled(tournament: {
  enabledStats?: MatchEventType[];
}): boolean {
  return !!tournament.enabledStats?.includes("fair_play");
}

export function rankTeamsInGroup(
  teamIds: string[],
  matches: Match[],
  sport: Sport = "futbol",
  /** El torneo tiene la stat `fair_play` habilitada. Si no, el punto del juego
   *  limpio no se suma aunque la columna traiga un equipo — así un torneo que
   *  probó la stat y la apagó vuelve a clasificar con los puntos de cancha. */
  fairPlayEnabled = false
): string[] {
  const winPoints = getWinPoints(sport);
  const entries: Record<string, StandingsEntry> = {};

  for (const teamId of teamIds) {
    entries[teamId] = {
      teamId,
      played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
      fairPlay: 0,
    };
  }

  for (const match of matches) {
    if (
      match.status !== "completed" ||
      match.homeScore === null ||
      match.awayScore === null ||
      !match.homeTeamId ||
      !match.awayTeamId
    ) continue;

    const home = entries[match.homeTeamId];
    const away = entries[match.awayTeamId];
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.goalsFor += match.homeScore;
    home.goalsAgainst += match.awayScore;
    away.goalsFor += match.awayScore;
    away.goalsAgainst += match.homeScore;

    if (match.homeScore > match.awayScore) {
      home.won++; home.points += winPoints; away.lost++;
    } else if (match.homeScore < match.awayScore) {
      away.won++; away.points += winPoints; home.lost++;
    } else {
      home.drawn++; away.drawn++;
      home.points += 1; away.points += 1;
    }

    // Juego limpio: un punto para el equipo premiado, encima de lo que sacó
    // en la cancha. `fairPlayTeamId` puede apuntar a un equipo que ya no está
    // en el grupo (reasignaciones), por eso el lookup puede dar undefined.
    if (fairPlayEnabled && match.fairPlayTeamId) {
      const fp = entries[match.fairPlayTeamId];
      if (fp) {
        fp.fairPlay++;
        fp.points += FAIR_PLAY_POINTS;
      }
    }
  }

  return Object.values(entries)
    .map((e) => ({ ...e, goalDifference: e.goalsFor - e.goalsAgainst }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    })
    .map((e) => e.teamId);
}

export function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Empty playoff skeleton: the round-1 slots plus every later round, already
 * linked through `nextMatchId`. Teams are assigned later — either by the
 * matchup builder or by `fillPlayoffBracket`.
 *
 * `matchCounterStart` continues the tournament's global match numbering so the
 * bracket doesn't collide with the group-stage matches.
 */
export function generateEmptyPlayoffBracket(
  tournamentId: string,
  totalAdvancing: number,
  matchCounterStart: number
): Match[] {
  const bracketSize = nextPowerOf2(totalAdvancing);
  if (bracketSize < 2) return [];

  const numRounds = Math.log2(bracketSize);
  const bracket: Match[] = [];
  let matchCounter = matchCounterStart;

  const emptyMatch = (round: number): Match => {
    const match: Match = {
      id: `${tournamentId}-m-${matchCounter}`,
      tournamentId,
      round,
      matchNumber: matchCounter,
      homeTeamId: null,
      awayTeamId: null,
      homeScore: null,
      awayScore: null,
      winnerId: null,
      status: "unscheduled",
      nextMatchId: null,
      phase: "playoff",
    };
    matchCounter++;
    return match;
  };

  // Round 1 of playoffs
  for (let i = 0; i < bracketSize / 2; i++) {
    bracket.push(emptyMatch(1));
  }

  // Subsequent playoff rounds with nextMatchId linking
  let prevRoundStart = 0;
  let prevRoundSize = bracketSize / 2;

  for (let round = 2; round <= numRounds; round++) {
    const currentRoundSize = prevRoundSize / 2;
    for (let i = 0; i < currentRoundSize; i++) {
      const match = emptyMatch(round);
      bracket.push(match);
      bracket[prevRoundStart + i * 2].nextMatchId = match.id;
      bracket[prevRoundStart + i * 2 + 1].nextMatchId = match.id;
    }
    prevRoundStart += prevRoundSize;
    prevRoundSize = currentRoundSize;
  }

  return bracket;
}

export function generateGroupPlayoffMatches(
  groups: TournamentGroup[],
  playoffConfig: PlayoffConfig,
  tournamentId: string,
  doubleRoundRobin?: boolean
): Match[] {
  const allMatches: Match[] = [];
  let matchCounter = 1;

  // Phase 1: Group stage - circle method round-robin per group
  for (const group of groups) {
    const { matches, nextMatchCounter } = generateRoundRobinCircle(
      group.teamIds,
      tournamentId,
      { phase: "group", groupId: group.id, matchCounterStart: matchCounter, doubleRoundRobin }
    );
    allMatches.push(...matches);
    matchCounter = nextMatchCounter;
  }

  // Phase 2: Playoff bracket sized to next power of 2
  allMatches.push(
    ...generateEmptyPlayoffBracket(
      tournamentId,
      playoffConfig.totalAdvancing,
      matchCounter
    )
  );

  return allMatches;
}

export function fillPlayoffBracket(tournament: Tournament, phaseNumber?: number): Match[] {
  const allGroups = tournament.groups!;
  const groups = phaseNumber != null
    ? allGroups.filter((g) => g.phase === phaseNumber)
    : allGroups.filter((g) => !g.phase || g.phase === 1);
  const config = tournament.playoffConfig!;

  // Rank teams within each group
  const rankedByGroup: string[][] = groups.map((group) => {
    const groupMatches = tournament.matches.filter(
      (m) => m.phase === "group" && m.groupId === group.id
    );
    return rankTeamsInGroup(group.teamIds, groupMatches, tournament.sport, fairPlayEnabled(tournament));
  });

  // Collect advancing teams ordered by seed
  const seeded: string[] = [];

  if (groups.length === 1) {
    // Single group: take top N by ranking
    seeded.push(...rankedByGroup[0].slice(0, config.totalAdvancing));
  } else {
    // Multiple groups: interleave by seed position across groups
    const perGroup = Math.ceil(config.totalAdvancing / groups.length);
    for (let seed = 0; seed < perGroup; seed++) {
      for (let g = 0; g < groups.length; g++) {
        if (rankedByGroup[g][seed] && seeded.length < config.totalAdvancing) {
          seeded.push(rankedByGroup[g][seed]);
        }
      }
    }
  }

  const totalAdvancing = seeded.length;
  const bracketSize = nextPowerOf2(totalAdvancing);
  const numByes = bracketSize - totalAdvancing;

  // Build bracket slots: pair seed 1 vs last, seed 2 vs second-to-last, etc.
  // Slots for a full bracket of bracketSize
  const slots: (string | null)[] = new Array(bracketSize).fill(null);
  for (let i = 0; i < totalAdvancing; i++) {
    slots[i] = seeded[i];
  }
  // Interleave: top vs bottom
  const paired: (string | null)[] = [];
  for (let i = 0; i < bracketSize / 2; i++) {
    paired.push(slots[i]);
    paired.push(slots[bracketSize - 1 - i]);
  }

  // Fill round 1 playoff matches
  const playoffR1 = tournament.matches
    .filter((m) => m.phase === "playoff" && m.round === 1)
    .sort((a, b) => a.matchNumber - b.matchNumber);

  const updatedMatches = [...tournament.matches];

  for (let i = 0; i < playoffR1.length; i++) {
    const idx = updatedMatches.findIndex((m) => m.id === playoffR1[i].id);
    const homeTeamId = paired[i * 2] || null;
    const awayTeamId = paired[i * 2 + 1] || null;
    const isBye = (homeTeamId && !awayTeamId) || (!homeTeamId && awayTeamId);

    updatedMatches[idx] = {
      ...updatedMatches[idx],
      homeTeamId,
      awayTeamId,
    };

    // Auto-complete bye matches
    if (isBye) {
      const byeWinner = homeTeamId || awayTeamId;
      updatedMatches[idx] = {
        ...updatedMatches[idx],
        homeScore: homeTeamId ? 1 : 0,
        awayScore: awayTeamId ? 1 : 0,
        winnerId: byeWinner,
        status: "completed",
      };

      // Propagate bye winner to next match
      const nextMatchId = updatedMatches[idx].nextMatchId;
      if (nextMatchId && byeWinner) {
        const nextIdx = updatedMatches.findIndex((m) => m.id === nextMatchId);
        if (nextIdx !== -1) {
          const feeders = updatedMatches.filter(
            (m) => m.nextMatchId === nextMatchId && m.phase === "playoff"
          );
          const feederIndex = feeders.findIndex(
            (m) => m.id === updatedMatches[idx].id
          );
          const nextMatch = { ...updatedMatches[nextIdx] };
          if (feederIndex === 0) {
            nextMatch.homeTeamId = byeWinner;
          } else {
            nextMatch.awayTeamId = byeWinner;
          }
          updatedMatches[nextIdx] = nextMatch;
        }
      }
    }
  }

  return updatedMatches;
}

// --- Multi-phase helpers ---

export function generateMultiPhaseMatches(
  phase1Groups: TournamentGroup[],
  phaseConfigs: PhaseConfig[],
  playoffConfig: PlayoffConfig,
  tournamentId: string,
  doubleRoundRobin?: boolean
): Match[] {
  const allMatches: Match[] = [];
  let matchCounter = 1;

  // Generate Phase 1 group round-robin matches
  for (const group of phase1Groups) {
    const { matches, nextMatchCounter } = generateRoundRobinCircle(
      group.teamIds,
      tournamentId,
      { phase: "group", groupId: group.id, matchCounterStart: matchCounter, doubleRoundRobin }
    );
    allMatches.push(...matches);
    matchCounter = nextMatchCounter;
  }

  // Create empty playoff bracket (filled when last group phase completes)
  allMatches.push(
    ...generateEmptyPlayoffBracket(
      tournamentId,
      playoffConfig.totalAdvancing,
      matchCounter
    )
  );

  return allMatches;
}

export function fillPhase2Groups(
  tournament: Tournament,
  phaseConfig: PhaseConfig
): { phase2Matches: Match[]; groupTeamAssignments: Record<string, string[]> } {
  const phase1Groups = tournament.groups!.filter((g) => g.phase === phaseConfig.phase);
  const phase2Groups = tournament.groups!.filter((g) => g.phase === (phaseConfig.phase + 1));

  // Rank teams in each Phase 1 group
  const rankedByGroup: string[][] = phase1Groups.map((group) => {
    const groupMatches = tournament.matches.filter(
      (m) => m.phase === "group" && m.groupId === group.id
    );
    return rankTeamsInGroup(group.teamIds, groupMatches, tournament.sport, fairPlayEnabled(tournament));
  });

  // Collect advancing teams (interleave by seed position). Each group can
  // have a different cupo via phaseConfig.perGroup; groups with smaller
  // cupos simply stop contributing earlier. When perGroup is absent the
  // helper expands the legacy uniform advancePerGroup to every group, so the
  // behavior for old tournaments is identical to before.
  const perGroup = getEffectivePerGroup(phaseConfig, phase1Groups.map((g) => g.id));
  const maxSeed = Math.max(0, ...phase1Groups.map((g) => perGroup[g.id] ?? 0));
  const advancingTeams: string[] = [];
  for (let seed = 0; seed < maxSeed; seed++) {
    for (let g = 0; g < rankedByGroup.length; g++) {
      const count = perGroup[phase1Groups[g].id] ?? 0;
      if (seed < count && rankedByGroup[g][seed]) {
        advancingTeams.push(rankedByGroup[g][seed]);
      }
    }
  }

  // Distribute advancing teams to Phase 2 groups (round-robin)
  const groupTeamAssignments: Record<string, string[]> = {};
  for (const group of phase2Groups) {
    groupTeamAssignments[group.id] = [];
  }
  for (let i = 0; i < advancingTeams.length; i++) {
    const targetGroup = phase2Groups[i % phase2Groups.length];
    groupTeamAssignments[targetGroup.id].push(advancingTeams[i]);
  }

  // Generate Phase 2 round-robin matches
  const phase2Matches: Match[] = [];
  // Find max match counter from existing matches
  let matchCounter = Math.max(...tournament.matches.map((m) => m.matchNumber)) + 1;
  const doubleRoundRobin = tournament.doubleRoundRobin;

  for (const group of phase2Groups) {
    const teamIds = groupTeamAssignments[group.id];
    if (teamIds.length < 2) continue;
    const { matches, nextMatchCounter } = generateRoundRobinCircle(
      teamIds,
      tournament.id,
      { phase: "group", groupId: group.id, matchCounterStart: matchCounter, doubleRoundRobin }
    );
    phase2Matches.push(...matches);
    matchCounter = nextMatchCounter;
  }

  return { phase2Matches, groupTeamAssignments };
}

/**
 * Generate incremental round-robin matches when new teams are added to a
 * tournament that ALREADY has a calendar. Produces matches between each new
 * team and every existing team, plus matches among the new teams themselves.
 *
 * Los partidos salen con `round: 0`, que el tab Fechas muestra como "Extras"
 * (date-organizer.tsx), y como `unscheduled` para que el organizador les
 * asigne día y hora.
 *
 * `scope` los ata a un grupo; sin `scope` quedan sin `phase`/`groupId`, que es
 * lo que espera una liga plana (round-robin sin grupos).
 *
 * Nunca regenera el calendario existente: solo agrega. Rehacerlo borraría los
 * partidos ya jugados y sus resultados.
 */
export function generateIncrementalMatches(
  newTeamIds: string[],
  existingTeamIds: string[],
  tournamentId: string,
  matchCounterStart: number,
  doubleRoundRobin?: boolean,
  scope?: { phase: "group"; groupId: string }
): Match[] {
  const matches: Match[] = [];
  let counter = matchCounterStart;

  // Defensa: según cuándo haya refrescado el estado, el caller puede pasarnos
  // los equipos nuevos también dentro de `existingTeamIds`. Sin este filtro
  // generaríamos partidos de un equipo contra sí mismo y cruces duplicados.
  const isNew = new Set(newTeamIds);
  const existing = existingTeamIds.filter((id) => !isNew.has(id));

  const push = (home: string, away: string) => {
    matches.push({
      id: `${tournamentId}-m-${counter}`,
      tournamentId,
      round: 0,
      matchNumber: counter,
      homeTeamId: home,
      awayTeamId: away,
      homeScore: null,
      awayScore: null,
      winnerId: null,
      status: "unscheduled",
      ...(scope ? { phase: scope.phase, groupId: scope.groupId } : {}),
    });
    counter++;
  };

  // New teams vs existing teams
  for (const newId of newTeamIds) {
    for (const existingId of existing) {
      push(newId, existingId);
      if (doubleRoundRobin) push(existingId, newId);
    }
  }

  // New teams vs each other
  for (let i = 0; i < newTeamIds.length; i++) {
    for (let j = i + 1; j < newTeamIds.length; j++) {
      push(newTeamIds[i], newTeamIds[j]);
      if (doubleRoundRobin) push(newTeamIds[j], newTeamIds[i]);
    }
  }

  return matches;
}

/** Variante scopeada a un grupo. Wrapper sobre `generateIncrementalMatches`. */
export function generateIncrementalMatchesForGroup(
  groupId: string,
  newTeamIds: string[],
  existingTeamIds: string[],
  tournamentId: string,
  matchCounterStart: number,
  doubleRoundRobin?: boolean
): Match[] {
  return generateIncrementalMatches(
    newTeamIds,
    existingTeamIds,
    tournamentId,
    matchCounterStart,
    doubleRoundRobin,
    { phase: "group", groupId }
  );
}
