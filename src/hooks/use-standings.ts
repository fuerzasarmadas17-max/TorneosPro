import { useMemo } from "react";
import { FAIR_PLAY_POINTS, getWinPoints, StandingsEntry, Tournament } from "@/types";

export function useStandings(tournament: Tournament): StandingsEntry[] {
  return useMemo(() => {
    const winPoints = getWinPoints(tournament.sport);
    // El punto del juego limpio solo cuenta si el torneo tiene la stat
    // prendida. Si se apagó, la tabla vuelve a los puntos de cancha aunque
    // los partidos conserven el premio marcado.
    const fairPlayOn = !!tournament.enabledStats?.includes("fair_play");
    const dqTeams = new Set(tournament.disqualifiedTeamIds || []);
    const entries: Record<string, StandingsEntry> = {};

    // Initialize entries for all teams
    for (const teamId of tournament.teamIds) {
      entries[teamId] = {
        teamId,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        fairPlay: 0,
      };
    }

    // Process completed matches (skip matches involving DQ teams)
    for (const match of tournament.matches) {
      if (
        match.status !== "completed" ||
        match.homeScore === null ||
        match.awayScore === null ||
        !match.homeTeamId ||
        !match.awayTeamId
      )
        continue;

      // Los partidos que involucran a un descalificado SÍ cuentan: los ya
      // jugados conservan su resultado y los pendientes se dan por ganados al
      // rival (walkover, ver disqualifyTeam). El DQ solo se manda al fondo de
      // la tabla en el sort.
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
        home.won++;
        home.points += winPoints;
        away.lost++;
      } else if (match.homeScore < match.awayScore) {
        away.won++;
        away.points += winPoints;
        home.lost++;
      } else {
        home.drawn++;
        away.drawn++;
        home.points += 1;
        away.points += 1;
      }

      // Juego limpio: punto extra al equipo premiado, encima de lo de cancha.
      if (fairPlayOn && match.fairPlayTeamId) {
        const fp = entries[match.fairPlayTeamId];
        if (fp) {
          fp.fairPlay++;
          fp.points += FAIR_PLAY_POINTS;
        }
      }
    }

    // Calculate goal difference
    const sorted = Object.values(entries)
      .map((e) => ({
        ...e,
        goalDifference: e.goalsFor - e.goalsAgainst,
      }))
      .sort((a, b) => {
        // Los descalificados van siempre al fondo, pase lo que pase.
        const aDQ = dqTeams.has(a.teamId);
        const bDQ = dqTeams.has(b.teamId);
        if (aDQ !== bDQ) return aDQ ? 1 : -1;
        // 1. Points
        if (b.points !== a.points) return b.points - a.points;
        // 2. Goal difference
        if (b.goalDifference !== a.goalDifference)
          return b.goalDifference - a.goalDifference;
        // 3. Goals for
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        // 4. Wins
        if (b.won !== a.won) return b.won - a.won;
        return 0;
      });

    // 5. Head-to-head resolution for teams still tied after criteria 1-4
    const validMatches = tournament.matches.filter(
      (m) =>
        m.status === "completed" &&
        m.homeScore !== null &&
        m.awayScore !== null &&
        m.homeTeamId &&
        m.awayTeamId
    );

    const result: StandingsEntry[] = [];
    let i = 0;
    while (i < sorted.length) {
      let j = i + 1;
      while (j < sorted.length) {
        const same =
          dqTeams.has(sorted[i].teamId) === dqTeams.has(sorted[j].teamId) &&
          sorted[i].points === sorted[j].points &&
          sorted[i].goalDifference === sorted[j].goalDifference &&
          sorted[i].goalsFor === sorted[j].goalsFor &&
          sorted[i].won === sorted[j].won;
        if (same) j++;
        else break;
      }

      if (j - i === 1) {
        result.push(sorted[i]);
      } else {
        // Resolve via head-to-head
        const tiedIds = new Set(sorted.slice(i, j).map((e) => e.teamId));
        const h2hMatches = validMatches.filter(
          (m) => tiedIds.has(m.homeTeamId!) && tiedIds.has(m.awayTeamId!)
        );

        if (h2hMatches.length === 0) {
          for (let k = i; k < j; k++) result.push(sorted[k]);
        } else {
          // Build h2h points
          const h2hPoints: Record<string, number> = {};
          for (const id of tiedIds) h2hPoints[id] = 0;
          for (const m of h2hMatches) {
            if (m.homeScore! > m.awayScore!) {
              h2hPoints[m.homeTeamId!] += winPoints;
            } else if (m.homeScore! < m.awayScore!) {
              h2hPoints[m.awayTeamId!] += winPoints;
            } else {
              h2hPoints[m.homeTeamId!] += 1;
              h2hPoints[m.awayTeamId!] += 1;
            }
          }
          const tiedGroup = sorted.slice(i, j);
          tiedGroup.sort((a, b) => (h2hPoints[b.teamId] ?? 0) - (h2hPoints[a.teamId] ?? 0));
          for (const e of tiedGroup) result.push(e);
        }
      }
      i = j;
    }

    return result;
  }, [tournament.matches, tournament.teamIds, tournament.disqualifiedTeamIds, tournament.sport, tournament.enabledStats]);
}
