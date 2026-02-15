import { useMemo } from "react";
import { BaseballStandingsEntry, Tournament } from "@/types";

export function useBaseballStandings(tournament: Tournament): BaseballStandingsEntry[] {
  return useMemo(() => {
    const entries: Record<string, BaseballStandingsEntry> = {};

    for (const teamId of tournament.teamIds) {
      entries[teamId] = {
        teamId,
        played: 0,
        won: 0,
        lost: 0,
        pct: 0,
        gb: 0,
        runsFor: 0,
        runsAgainst: 0,
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
      home.runsFor += match.homeScore;
      home.runsAgainst += match.awayScore;
      away.runsFor += match.awayScore;
      away.runsAgainst += match.homeScore;

      if (match.homeScore > match.awayScore) {
        home.won++;
        away.lost++;
      } else if (match.homeScore < match.awayScore) {
        away.won++;
        home.lost++;
      } else {
        // Empates no deberian pasar en beisbol, pero por si acaso
        // se cuenta como medio juego ganado para ambos
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
        diff: e.runsFor - e.runsAgainst,
      }))
      .sort((a, b) => {
        if (b.pct !== a.pct) return b.pct - a.pct;
        return b.diff - a.diff;
      });

    // Calcular GB respecto al lider
    if (sorted.length > 0) {
      const leader = sorted[0];
      for (const entry of sorted) {
        entry.gb = ((leader.won - entry.won) + (entry.lost - leader.lost)) / 2;
      }
    }

    return sorted;
  }, [tournament.matches, tournament.teamIds]);
}
