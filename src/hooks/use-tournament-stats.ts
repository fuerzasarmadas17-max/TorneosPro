import { useMemo } from "react";
import { MatchEventType, Tournament, getStatDefinition } from "@/types";

export interface PlayerStatEntry {
  playerName: string;
  teamId: string;
  count: number;
}

export interface TeamStatEntry {
  teamId: string;
  value: number;
  matchesPlayed: number;
}

export interface CardEntry {
  eventId: string;
  matchId: string;
  playerName: string;
  teamId: string;
  type: "yellow_card" | "red_card" | "ejection";
  paid: boolean;
}

export interface StatLeaderboard {
  statKey: MatchEventType;
  label: string;
  pluralLabel: string;
  computed: boolean;
  leaders: PlayerStatEntry[];
  teamLeaders: TeamStatEntry[];
}

export function useTournamentStats(tournament: Tournament) {
  return useMemo(() => {
    const enabledStats = tournament.enabledStats || [];

    // Separate computed stats from event-based stats
    const eventStats: MatchEventType[] = [];
    const computedStats: MatchEventType[] = [];
    for (const statKey of enabledStats) {
      const def = getStatDefinition(statKey);
      if (def?.computed) {
        computedStats.push(statKey);
      } else {
        eventStats.push(statKey);
      }
    }

    // Build player event maps
    const maps = new Map<MatchEventType, Map<string, PlayerStatEntry>>();
    for (const statKey of eventStats) {
      maps.set(statKey, new Map());
    }

    // Build team computed maps
    const teamMaps = new Map<MatchEventType, Map<string, TeamStatEntry>>();
    for (const statKey of computedStats) {
      const m = new Map<string, TeamStatEntry>();
      for (const teamId of tournament.teamIds) {
        m.set(teamId, { teamId, value: 0, matchesPlayed: 0 });
      }
      teamMaps.set(statKey, m);
    }

    for (const match of tournament.matches) {
      if (match.status !== "completed") continue;

      // Computed stats from scores
      if (
        computedStats.length > 0 &&
        match.homeTeamId &&
        match.awayTeamId &&
        match.homeScore !== null &&
        match.awayScore !== null
      ) {
        if (computedStats.includes("goals_against")) {
          const gaMap = teamMaps.get("goals_against")!;
          const home = gaMap.get(match.homeTeamId);
          const away = gaMap.get(match.awayTeamId);
          if (home) {
            home.value += match.awayScore;
            home.matchesPlayed++;
          }
          if (away) {
            away.value += match.homeScore;
            away.matchesPlayed++;
          }
        }
      }

      // Event-based stats from events
      if (!match.events) continue;
      for (const event of match.events) {
        const statMap = maps.get(event.type);
        if (!statMap) continue;

        const key = `${event.playerName}::${event.teamId}`;
        const existing = statMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          statMap.set(key, {
            playerName: event.playerName,
            teamId: event.teamId,
            count: 1,
          });
        }
      }
    }

    // Collect individual card entries
    const cardEntries: CardEntry[] = [];
    for (const match of tournament.matches) {
      if (match.status !== "completed" || !match.events) continue;
      for (const event of match.events) {
        if (event.type === "yellow_card" || event.type === "red_card" || event.type === "ejection") {
          cardEntries.push({
            eventId: event.id,
            matchId: match.id,
            playerName: event.playerName,
            teamId: event.teamId,
            type: event.type,
            paid: !!event.paid,
          });
        }
      }
    }

    const leaderboards: StatLeaderboard[] = enabledStats
      .map((statKey) => {
        const def = getStatDefinition(statKey);
        if (!def) return null;

        if (def.computed) {
          const teamMap = teamMaps.get(statKey);
          if (!teamMap) return null;
          // goals_against: sort ascending (fewer is better)
          const teamLeaders = Array.from(teamMap.values())
            .filter((t) => t.matchesPlayed > 0)
            .sort((a, b) => a.value - b.value)
            .slice(0, 10);

          return {
            statKey,
            label: def.label,
            pluralLabel: def.pluralLabel,
            computed: true,
            leaders: [] as PlayerStatEntry[],
            teamLeaders: teamLeaders,
          };
        }

        const statMap = maps.get(statKey);
        if (!statMap) return null;
        const leaders = Array.from(statMap.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        return {
          statKey,
          label: def.label,
          pluralLabel: def.pluralLabel,
          computed: false,
          leaders,
          teamLeaders: [] as TeamStatEntry[],
        };
      })
      .filter((lb): lb is StatLeaderboard => lb !== null);

    const hasStats = leaderboards.some(
      (lb) => lb.leaders.length > 0 || lb.teamLeaders.length > 0
    );

    return { leaderboards, hasStats, cardEntries };
  }, [tournament.matches, tournament.enabledStats, tournament.teamIds]);
}
