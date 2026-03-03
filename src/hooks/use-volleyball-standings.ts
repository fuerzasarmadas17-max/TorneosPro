import { useMemo } from "react";
import { VolleyballStandingsEntry, Tournament, Match } from "@/types";

/**
 * Calculates ranking points for a volleyball match result.
 *
 * Best of 5 (setsToWin=3):
 *   3-0 or 3-1 → winner 3 pts, loser 0 pts
 *   3-2        → winner 2 pts, loser 1 pt
 *
 * Best of 3 (setsToWin=2):
 *   2-0        → winner 3 pts, loser 0 pts
 *   2-1        → winner 2 pts, loser 1 pt
 */
function getMatchPoints(
  winnerSets: number,
  loserSets: number,
  setsToWin: number
): { winnerPts: number; loserPts: number } {
  // The winner always has exactly setsToWin sets.
  // If the loser won (setsToWin - 1) sets, it was a close match.
  const closeLoss = loserSets === setsToWin - 1;
  return closeLoss
    ? { winnerPts: 2, loserPts: 1 }
    : { winnerPts: 3, loserPts: 0 };
}

/** Build entries from a set of matches and teamIds */
function buildEntries(
  matches: Match[],
  teamIds: string[],
  setsToWin: number
): Record<string, VolleyballStandingsEntry> {
  const entries: Record<string, VolleyballStandingsEntry> = {};

  for (const teamId of teamIds) {
    entries[teamId] = {
      teamId,
      played: 0,
      won: 0,
      lost: 0,
      setsFor: 0,
      setsAgainst: 0,
      setDiff: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
      points: 0,
    };
  }

  for (const match of matches) {
    if (
      match.status !== "completed" ||
      match.homeScore === null ||
      match.awayScore === null ||
      !match.homeTeamId ||
      !match.awayTeamId
    )
      continue;

    const home = entries[match.homeTeamId];
    const away = entries[match.awayTeamId];
    if (!home || !away) continue;

    home.played++;
    away.played++;

    // Sets (homeScore/awayScore = sets won by each team)
    home.setsFor += match.homeScore;
    home.setsAgainst += match.awayScore;
    away.setsFor += match.awayScore;
    away.setsAgainst += match.homeScore;

    // Individual points from set-by-set data
    if (match.sets && match.sets.length > 0) {
      for (const set of match.sets) {
        home.pointsFor += set.homePoints;
        home.pointsAgainst += set.awayPoints;
        away.pointsFor += set.awayPoints;
        away.pointsAgainst += set.homePoints;
      }
    }

    // Ranking points
    const homeWon = match.homeScore > match.awayScore;
    if (homeWon) {
      home.won++;
      away.lost++;
      const { winnerPts, loserPts } = getMatchPoints(
        match.homeScore,
        match.awayScore,
        setsToWin
      );
      home.points += winnerPts;
      away.points += loserPts;
    } else {
      away.won++;
      home.lost++;
      const { winnerPts, loserPts } = getMatchPoints(
        match.awayScore,
        match.homeScore,
        setsToWin
      );
      away.points += winnerPts;
      home.points += loserPts;
    }
  }

  // Calculate diffs
  for (const e of Object.values(entries)) {
    e.setDiff = e.setsFor - e.setsAgainst;
    e.pointDiff = e.pointsFor - e.pointsAgainst;
  }

  return entries;
}

/** Safe ratio: a/b, returns Infinity when b=0 and a>0, 0 when both 0 */
function ratio(a: number, b: number): number {
  if (b === 0) return a > 0 ? Infinity : 0;
  return a / b;
}

/**
 * Compare two entries by tiebreaker criteria 1-5.
 * Returns negative if a ranks higher, positive if b ranks higher, 0 if still tied.
 */
function compareByCriteria(
  a: VolleyballStandingsEntry,
  b: VolleyballStandingsEntry
): number {
  // 1. More matches won
  if (b.won !== a.won) return b.won - a.won;
  // 2. Better set difference
  if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff;
  // 3. Better set ratio
  const sRatioA = ratio(a.setsFor, a.setsAgainst);
  const sRatioB = ratio(b.setsFor, b.setsAgainst);
  if (sRatioB !== sRatioA) return sRatioB - sRatioA;
  // 4. Better point difference
  if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
  // 5. Better point ratio
  const pRatioA = ratio(a.pointsFor, a.pointsAgainst);
  const pRatioB = ratio(b.pointsFor, b.pointsAgainst);
  if (pRatioB !== pRatioA) return pRatioB - pRatioA;
  return 0;
}

/**
 * Resolve head-to-head tiebreak for a group of teams that are still tied
 * after criteria 1-5. Recalculates stats using only matches between them.
 */
function resolveHeadToHead(
  tiedTeamIds: string[],
  allMatches: Match[],
  setsToWin: number
): string[] {
  if (tiedTeamIds.length <= 1) return tiedTeamIds;

  const tiedSet = new Set(tiedTeamIds);
  const h2hMatches = allMatches.filter(
    (m) =>
      m.status === "completed" &&
      m.homeTeamId &&
      m.awayTeamId &&
      tiedSet.has(m.homeTeamId) &&
      tiedSet.has(m.awayTeamId)
  );

  // If no direct matches, keep current order
  if (h2hMatches.length === 0) return tiedTeamIds;

  const h2hEntries = buildEntries(h2hMatches, tiedTeamIds, setsToWin);
  const h2hSorted = Object.values(h2hEntries).sort((a, b) => {
    // Sort by h2h points first, then criteria 1-5 on h2h stats
    if (b.points !== a.points) return b.points - a.points;
    return compareByCriteria(a, b);
  });

  return h2hSorted.map((e) => e.teamId);
}

export function useVolleyballStandings(
  tournament: Tournament
): VolleyballStandingsEntry[] {
  return useMemo(() => {
    const dqTeams = new Set(tournament.disqualifiedTeamIds || []);
    const setsToWin = tournament.bestOf
      ? Math.ceil(tournament.bestOf / 2)
      : 2;

    // Filter out matches involving disqualified teams
    const validMatches = tournament.matches.filter(
      (m) => !m.homeTeamId || !m.awayTeamId || (!dqTeams.has(m.homeTeamId) && !dqTeams.has(m.awayTeamId))
    );

    const entries = buildEntries(
      validMatches,
      tournament.teamIds,
      setsToWin
    );

    // Primary sort: by ranking points desc, then criteria 1-5
    const sorted = Object.values(entries).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return compareByCriteria(a, b);
    });

    // Head-to-head resolution for teams still tied after criteria 1-5
    const result: VolleyballStandingsEntry[] = [];
    let i = 0;
    while (i < sorted.length) {
      // Find group of teams with same points AND same criteria 1-5 result
      let j = i + 1;
      while (j < sorted.length) {
        const cmpPoints = sorted[i].points === sorted[j].points;
        const cmpCriteria = compareByCriteria(sorted[i], sorted[j]) === 0;
        if (cmpPoints && cmpCriteria) {
          j++;
        } else {
          break;
        }
      }

      if (j - i === 1) {
        // Single team, no tiebreak needed
        result.push(sorted[i]);
      } else {
        // Multiple teams tied — resolve via head-to-head
        const tiedGroup = sorted.slice(i, j);
        const tiedIds = tiedGroup.map((e) => e.teamId);
        const h2hOrder = resolveHeadToHead(
          tiedIds,
          tournament.matches,
          setsToWin
        );
        for (const teamId of h2hOrder) {
          result.push(entries[teamId]);
        }
      }

      i = j;
    }

    return result;
  }, [tournament.matches, tournament.teamIds, tournament.bestOf, tournament.disqualifiedTeamIds]);
}
