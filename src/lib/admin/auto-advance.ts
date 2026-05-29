import { Match, Sport, Tournament, VolleyballSet } from "@/types";

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const BASEBALL_SPORTS: Sport[] = ["beisbol", "softball", "wiffleball"];
const RACKET_SPORTS: Sport[] = ["padel", "tenis", "ping-pong"];

export interface GeneratedResult {
  homeScore: number;
  awayScore: number;
  sets?: VolleyballSet[];
}

/**
 * Generates a plausible random score for a match of the given sport.
 * When `forceWinner` is true (elimination/playoff), the scores will never tie.
 */
export function generateRandomResult(
  sport: Sport,
  bestOf?: 3 | 5,
  forceWinner = false
): GeneratedResult {
  if (sport === "volleyball") {
    return generateVolleyballResult(bestOf ?? 3);
  }

  if (RACKET_SPORTS.includes(sport)) {
    const bo = bestOf ?? 3;
    const target = Math.ceil((bo + 1) / 2);
    const homeWins = Math.random() < 0.5;
    const loser = rand(0, target - 1);
    return {
      homeScore: homeWins ? target : loser,
      awayScore: homeWins ? loser : target,
    };
  }

  if (sport === "basketball") {
    let home = rand(60, 110);
    const away = rand(60, 110);
    if (home === away) home += 1;
    return { homeScore: home, awayScore: away };
  }

  if (BASEBALL_SPORTS.includes(sport)) {
    let home = rand(0, 15);
    let away = rand(0, 15);
    // Baseball has no ties.
    while (home === away) {
      if (Math.random() < 0.5) home += rand(1, 3);
      else away += rand(1, 3);
    }
    return { homeScore: home, awayScore: away };
  }

  // Football-like (futbol/futsal/microfutbol) and anything else: 0-5 goals.
  let home = rand(0, 5);
  let away = rand(0, 5);
  if (forceWinner && home === away) {
    if (Math.random() < 0.5) home++;
    else away++;
  }
  return { homeScore: home, awayScore: away };
}

function generateVolleyballResult(bestOf: 3 | 5): GeneratedResult {
  const target = Math.ceil((bestOf + 1) / 2); // 2 (bestOf=3) or 3 (bestOf=5)
  const homeWins = Math.random() < 0.5;
  const loserSets = rand(0, target - 1);
  const homeSetsWon = homeWins ? target : loserSets;
  const awaySetsWon = homeWins ? loserSets : target;

  const sets: VolleyballSet[] = [];
  let hw = 0;
  let aw = 0;
  let setNum = 1;
  while (hw < homeSetsWon || aw < awaySetsWon) {
    const isDeciding = hw === target - 1 && aw === target - 1;
    const homeMustWin = hw < homeSetsWon && aw >= awaySetsWon;
    const awayMustWin = aw < awaySetsWon && hw >= homeSetsWon;
    const setHomeWins = homeMustWin ? true : awayMustWin ? false : Math.random() < 0.5;
    if (setHomeWins) hw++;
    else aw++;
    const winnerPts = isDeciding ? 15 : 25;
    const loserPts = isDeciding ? rand(10, 13) : rand(18, 23);
    sets.push({
      setNumber: setNum++,
      homePoints: setHomeWins ? winnerPts : loserPts,
      awayPoints: setHomeWins ? loserPts : winnerPts,
    });
  }
  return { homeScore: homeSetsWon, awayScore: awaySetsWon, sets };
}

/** Matches with both teams assigned and not yet completed. */
function getPlayableMatches(tournament: Tournament): Match[] {
  return tournament.matches.filter(
    (m) => m.status !== "completed" && m.homeTeamId && m.awayTeamId
  );
}

/**
 * Returns the "phase key" used to compare matches across the tournament:
 * group-phase number (1, 2, …) if the match belongs to a group; 99 for
 * playoff / bracket matches.
 */
function getMatchPhaseKey(match: Match, tournament: Tournament): number {
  if (match.phase === "group" && match.groupId) {
    const g = tournament.groups?.find((g) => g.id === match.groupId);
    return g?.phase ?? 1;
  }
  // playoff matches, or elimination-only tournament matches (phase undefined).
  return 99;
}

/**
 * Returns the matches of the next pending jornada — the smallest pending
 * (phase, round) among playable matches.
 */
export function getNextJornadaMatches(tournament: Tournament): Match[] {
  const playable = getPlayableMatches(tournament);
  if (playable.length === 0) return [];

  const enriched = playable.map((m) => ({
    match: m,
    phaseKey: getMatchPhaseKey(m, tournament),
    round: m.round,
  }));
  enriched.sort((a, b) => a.phaseKey - b.phaseKey || a.round - b.round);
  const head = enriched[0];
  return enriched
    .filter((e) => e.phaseKey === head.phaseKey && e.round === head.round)
    .map((e) => e.match);
}

/**
 * Returns the matches of the current pending phase — all playable matches that
 * share the smallest pending phase key.
 */
export function getCurrentPhaseMatches(tournament: Tournament): Match[] {
  const playable = getPlayableMatches(tournament);
  if (playable.length === 0) return [];

  const enriched = playable.map((m) => ({
    match: m,
    phaseKey: getMatchPhaseKey(m, tournament),
  }));
  const minPhase = Math.min(...enriched.map((e) => e.phaseKey));
  return enriched.filter((e) => e.phaseKey === minPhase).map((e) => e.match);
}

/** True if this match should never tie (elimination tournament or bracket round). */
export function shouldForceWinner(
  tournament: Tournament,
  match: Match
): boolean {
  return tournament.format === "elimination" || match.phase === "playoff";
}
