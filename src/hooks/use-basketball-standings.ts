import { useMemo } from "react";
import { BasketballStandingsEntry, Tournament } from "@/types";

export function useBasketballStandings(
  tournament: Tournament
): BasketballStandingsEntry[] {
  return useMemo(() => {
    const entries: Record<string, BasketballStandingsEntry> = {};

    for (const teamId of tournament.teamIds) {
      entries[teamId] = {
        teamId,
        played: 0,
        won: 0,
        lost: 0,
        pct: 0,
        gb: 0,
        pointsFor: 0,
        pointsAgainst: 0,
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
      home.pointsFor += match.homeScore;
      home.pointsAgainst += match.awayScore;
      away.pointsFor += match.awayScore;
      away.pointsAgainst += match.homeScore;

      if (match.homeScore > match.awayScore) {
        home.won++;
        away.lost++;
      } else if (match.homeScore < match.awayScore) {
        away.won++;
        home.lost++;
      } else {
        // No hay empates en basketball, pero por si acaso
        home.won += 0.5;
        home.lost += 0.5;
        away.won += 0.5;
        away.lost += 0.5;
      }
    }

    const sorted = Object.values(entries)
      .map((e) => ({
        ...e,
        pct: e.played > 0 ? e.won / e.played : 0,
        diff: e.pointsFor - e.pointsAgainst,
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
