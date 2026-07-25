import { useMemo } from "react";
import { BasketballStandingsEntry, Tournament } from "@/types";

export function useBasketballStandings(
  tournament: Tournament
): BasketballStandingsEntry[] {
  return useMemo(() => {
    const dqTeams = new Set(tournament.disqualifiedTeamIds || []);
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

      // Los partidos del descalificado cuentan (ya jugados = su resultado;
      // pendientes = walkover al rival). El DQ solo se manda al fondo en el sort.
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
        // Los descalificados van siempre al fondo, pase lo que pase.
        const aDQ = dqTeams.has(a.teamId);
        const bDQ = dqTeams.has(b.teamId);
        if (aDQ !== bDQ) return aDQ ? 1 : -1;
        // 1. PCT
        if (b.pct !== a.pct) return b.pct - a.pct;
        // 2. Point differential
        if (b.diff !== a.diff) return b.diff - a.diff;
        // 3. Points scored
        if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
        return 0;
      });

    // 4. Head-to-head resolution for teams still tied
    const validMatches = tournament.matches.filter(
      (m) =>
        m.status === "completed" &&
        m.homeScore !== null &&
        m.awayScore !== null &&
        m.homeTeamId &&
        m.awayTeamId
    );

    const result: BasketballStandingsEntry[] = [];
    let i = 0;
    while (i < sorted.length) {
      let j = i + 1;
      while (j < sorted.length) {
        const same =
          dqTeams.has(sorted[i].teamId) === dqTeams.has(sorted[j].teamId) &&
          sorted[i].pct === sorted[j].pct &&
          sorted[i].diff === sorted[j].diff &&
          sorted[i].pointsFor === sorted[j].pointsFor;
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

    if (result.length > 0) {
      const leader = result[0];
      for (const entry of result) {
        entry.gb =
          (leader.won - entry.won + (entry.lost - leader.lost)) / 2;
      }
    }

    return result;
  }, [tournament.matches, tournament.teamIds, tournament.disqualifiedTeamIds]);
}
