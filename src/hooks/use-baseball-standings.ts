import { useMemo } from "react";
import { BaseballStandingsEntry, Tournament } from "@/types";

export function useBaseballStandings(tournament: Tournament): BaseballStandingsEntry[] {
  return useMemo(() => {
    const dqTeams = new Set(tournament.disqualifiedTeamIds || []);
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

      if (dqTeams.has(match.homeTeamId) || dqTeams.has(match.awayTeamId)) continue;

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
        // 1. PCT
        if (b.pct !== a.pct) return b.pct - a.pct;
        // 2. Run differential
        if (b.diff !== a.diff) return b.diff - a.diff;
        // 3. Runs scored
        if (b.runsFor !== a.runsFor) return b.runsFor - a.runsFor;
        return 0;
      });

    // 4. Head-to-head resolution for teams still tied
    const validMatches = tournament.matches.filter(
      (m) =>
        m.status === "completed" &&
        m.homeScore !== null &&
        m.awayScore !== null &&
        m.homeTeamId &&
        m.awayTeamId &&
        !dqTeams.has(m.homeTeamId!) &&
        !dqTeams.has(m.awayTeamId!)
    );

    const result: BaseballStandingsEntry[] = [];
    let i = 0;
    while (i < sorted.length) {
      let j = i + 1;
      while (j < sorted.length) {
        const same =
          sorted[i].pct === sorted[j].pct &&
          sorted[i].diff === sorted[j].diff &&
          sorted[i].runsFor === sorted[j].runsFor;
        if (same) j++;
        else break;
      }

      if (j - i === 1) {
        result.push(sorted[i]);
      } else {
        const tiedIds = new Set(sorted.slice(i, j).map((e) => e.teamId));
        const h2hMatches = validMatches.filter(
          (m) => tiedIds.has(m.homeTeamId!) && tiedIds.has(m.awayTeamId!)
        );

        if (h2hMatches.length === 0) {
          for (let k = i; k < j; k++) result.push(sorted[k]);
        } else {
          const h2hWins: Record<string, number> = {};
          for (const id of tiedIds) h2hWins[id] = 0;
          for (const m of h2hMatches) {
            if (m.homeScore! > m.awayScore!) h2hWins[m.homeTeamId!]++;
            else if (m.homeScore! < m.awayScore!) h2hWins[m.awayTeamId!]++;
          }
          const tiedGroup = sorted.slice(i, j);
          tiedGroup.sort((a, b) => (h2hWins[b.teamId] ?? 0) - (h2hWins[a.teamId] ?? 0));
          for (const e of tiedGroup) result.push(e);
        }
      }
      i = j;
    }

    // Calcular GB respecto al lider
    if (result.length > 0) {
      const leader = result[0];
      for (const entry of result) {
        entry.gb = ((leader.won - entry.won) + (entry.lost - leader.lost)) / 2;
      }
    }

    return result;
  }, [tournament.matches, tournament.teamIds, tournament.disqualifiedTeamIds]);
}
