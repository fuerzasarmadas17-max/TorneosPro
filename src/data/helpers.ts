import { Match, MatchPhase, StandingsEntry, Team, Tournament, TournamentGroup, PlayoffConfig, User } from "@/types";
import { MOCK_TEAMS } from "./teams";
import { MOCK_USERS } from "./users";

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
  tournamentId: string
): Match[] {
  const numRounds = Math.log2(teamCount);
  const matches: Match[] = [];
  let matchCounter = 1;

  // Round 1
  for (let i = 0; i < teamCount / 2; i++) {
    matches.push({
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
      matches.push({
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

      matches[prevRoundStart + i * 2].nextMatchId = matchId;
      matches[prevRoundStart + i * 2 + 1].nextMatchId = matchId;
      matchCounter++;
    }
    prevRoundStart += prevRoundSize;
    prevRoundSize = currentRoundSize;
  }

  return matches;
}

// generateEmptyRoundRobinSlots and generateEmptyGroupPlayoffMatches removed
// Manual mode now starts with 0 matches and uses JornadaBuilder

export function generateEliminationMatches(
  teamIds: string[],
  tournamentId: string
): Match[] {
  const numTeams = teamIds.length;
  const numRounds = Math.log2(numTeams);
  const matches: Match[] = [];
  let matchCounter = 1;

  // Round 1: pair up all teams
  for (let i = 0; i < numTeams; i += 2) {
    matches.push({
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
    const roundStartIdx = matches.length;

    for (let i = 0; i < currentRoundSize; i++) {
      const matchId = `${tournamentId}-m-${matchCounter}`;
      matches.push({
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
      matches[feederIdx1].nextMatchId = matchId;
      matches[feederIdx2].nextMatchId = matchId;

      matchCounter++;
    }
    prevRoundStart += prevRoundSize;
    prevRoundSize = currentRoundSize;
  }

  return matches;
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

export function getTeamById(id: string): Team | undefined {
  return MOCK_TEAMS.find((t) => t.id === id);
}

export function getUserByEmail(email: string): User | undefined {
  return MOCK_USERS.find((u) => u.email === email);
}

export function getRoundLabel(round: number, totalRounds: number): string {
  const fromFinal = totalRounds - round;
  if (fromFinal === 0) return "Final";
  if (fromFinal === 1) return "Semifinal";
  if (fromFinal === 2) return "Cuartos de Final";
  if (fromFinal === 3) return "Octavos de Final";
  return `Ronda ${round}`;
}

export function rankTeamsInGroup(teamIds: string[], matches: Match[]): string[] {
  const entries: Record<string, StandingsEntry> = {};

  for (const teamId of teamIds) {
    entries[teamId] = {
      teamId,
      played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
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
      home.won++; home.points += 3; away.lost++;
    } else if (match.homeScore < match.awayScore) {
      away.won++; away.points += 3; home.lost++;
    } else {
      home.drawn++; away.drawn++;
      home.points += 1; away.points += 1;
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

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
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
  const bracketSize = nextPowerOf2(playoffConfig.totalAdvancing);
  const numRounds = Math.log2(bracketSize);
  const playoffStartIdx = allMatches.length;

  // Round 1 of playoffs
  for (let i = 0; i < bracketSize / 2; i++) {
    allMatches.push({
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
      phase: "playoff",
    });
    matchCounter++;
  }

  // Subsequent playoff rounds with nextMatchId linking
  let prevRoundStart = playoffStartIdx;
  let prevRoundSize = bracketSize / 2;

  for (let round = 2; round <= numRounds; round++) {
    const currentRoundSize = prevRoundSize / 2;

    for (let i = 0; i < currentRoundSize; i++) {
      const matchId = `${tournamentId}-m-${matchCounter}`;
      allMatches.push({
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
        phase: "playoff",
      });

      const feederIdx1 = prevRoundStart + i * 2;
      const feederIdx2 = prevRoundStart + i * 2 + 1;
      allMatches[feederIdx1].nextMatchId = matchId;
      allMatches[feederIdx2].nextMatchId = matchId;

      matchCounter++;
    }
    prevRoundStart += prevRoundSize;
    prevRoundSize = currentRoundSize;
  }

  return allMatches;
}

export function fillPlayoffBracket(tournament: Tournament): Match[] {
  const groups = tournament.groups!;
  const config = tournament.playoffConfig!;

  // Rank teams within each group
  const rankedByGroup: string[][] = groups.map((group) => {
    const groupMatches = tournament.matches.filter(
      (m) => m.phase === "group" && m.groupId === group.id
    );
    return rankTeamsInGroup(group.teamIds, groupMatches);
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
