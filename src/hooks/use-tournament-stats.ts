import { useMemo } from "react";
import { MatchEventType, Tournament, getStatDefinition, getSportCategory } from "@/types";

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
  type: "yellow_card" | "red_card" | "ejection" | "blue_card";
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

export interface BaseballPlayerStats {
  playerName: string;
  teamId: string;
  ab: number;
  h: number; // total hits = singles + doubles + triples + hr
  singles: number;
  doubles: number;
  triples: number;
  hr: number;
  bb: number;
  k: number;
  rbi: number;
  r: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
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
        if (event.type === "yellow_card" || event.type === "red_card" || event.type === "ejection" || event.type === "blue_card") {
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

    // Baseball / softball / wiffleball: per-player AVG / OBP / SLG / OPS
    const isBaseball = getSportCategory(tournament.sport) === "baseball";
    const baseballMap = new Map<string, BaseballPlayerStats>();

    if (isBaseball) {
      for (const match of tournament.matches) {
        if (match.status !== "completed" || !match.events) continue;
        for (const event of match.events) {
          const key = `${event.playerName}::${event.teamId}`;
          let entry = baseballMap.get(key);
          if (!entry) {
            entry = {
              playerName: event.playerName,
              teamId: event.teamId,
              ab: 0, h: 0, singles: 0, doubles: 0, triples: 0, hr: 0,
              bb: 0, k: 0, rbi: 0, r: 0,
              avg: 0, obp: 0, slg: 0, ops: 0,
            };
            baseballMap.set(key, entry);
          }
          switch (event.type) {
            case "at_bat": entry.ab++; break;
            case "hit": entry.singles++; entry.h++; break;
            case "double": entry.doubles++; entry.h++; break;
            case "triple": entry.triples++; entry.h++; break;
            case "home_run": entry.hr++; entry.h++; break;
            case "walk": entry.bb++; break;
            case "strikeout": entry.k++; break;
            case "rbi": entry.rbi++; break;
            case "run_scored": entry.r++; break;
          }
        }
      }

      for (const e of baseballMap.values()) {
        e.avg = e.ab > 0 ? e.h / e.ab : 0;
        const obpDen = e.ab + e.bb;
        e.obp = obpDen > 0 ? (e.h + e.bb) / obpDen : 0;
        const totalBases = e.singles + 2 * e.doubles + 3 * e.triples + 4 * e.hr;
        e.slg = e.ab > 0 ? totalBases / e.ab : 0;
        e.ops = e.obp + e.slg;
      }
    }

    const baseballPlayerStats = Array.from(baseballMap.values())
      .filter((e) => e.ab > 0 || e.bb > 0 || e.h > 0)
      .sort((a, b) => b.ops - a.ops);

    return { leaderboards, hasStats, cardEntries, baseballPlayerStats };
  }, [tournament.matches, tournament.enabledStats, tournament.teamIds, tournament.sport]);
}
