import { useMemo } from "react";
import { VolleyballStandingsEntry, Tournament } from "@/types";

export function useVolleyballStandings(
  tournament: Tournament
): VolleyballStandingsEntry[] {
  return useMemo(() => {
    const entries: Record<string, VolleyballStandingsEntry> = {};

    for (const teamId of tournament.teamIds) {
      entries[teamId] = {
        teamId,
        played: 0,
        won: 0,
        lost: 0,
        pct: 0,
        gb: 0,
        setsFor: 0,
        setsAgainst: 0,
        diff: 0,
      };
    }

    for (const match of tournament.matches) {
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

      // homeScore/awayScore = sets ganados
      home.setsFor += match.homeScore;
      home.setsAgainst += match.awayScore;
      away.setsFor += match.awayScore;
      away.setsAgainst += match.homeScore;

      if (match.homeScore > match.awayScore) {
        home.won++;
        away.lost++;
      } else if (match.homeScore < match.awayScore) {
        away.won++;
        home.lost++;
      }
    }

    const sorted = Object.values(entries)
      .map((e) => ({
        ...e,
        pct: e.played > 0 ? e.won / e.played : 0,
        diff: e.setsFor - e.setsAgainst,
      }))
      .sort((a, b) => {
        if (b.pct !== a.pct) return b.pct - a.pct;
        return b.diff - a.diff;
      });

    if (sorted.length > 0) {
      const leader = sorted[0];
      for (const entry of sorted) {
        entry.gb =
          (leader.won - entry.won + (entry.lost - leader.lost)) / 2;
      }
    }

    return sorted;
  }, [tournament.matches, tournament.teamIds]);
}
