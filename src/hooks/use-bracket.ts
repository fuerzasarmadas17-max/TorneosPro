import { useMemo } from "react";
import { Match, Tournament } from "@/types";
import { getRoundLabel } from "@/data/helpers";

export interface BracketRound {
  roundNumber: number;
  roundLabel: string;
  matches: Match[];
  isDoubleLeg?: boolean;
}

export function useBracket(tournament: Tournament): BracketRound[] {
  return useMemo(() => {
    if (tournament.matches.length === 0) return [];
    const totalRounds = Math.max(...tournament.matches.map((m) => m.round));
    const rounds: BracketRound[] = [];

    if (tournament.doubleRoundRobin && tournament.format === "elimination") {
      // Double-leg: group paired rounds (1+2, 3+4, 5+6...) into bracket rounds
      const bracketRoundCount = Math.ceil(totalRounds / 2);
      for (let r = 0; r < bracketRoundCount; r++) {
        const idaRound = r * 2 + 1;
        const vueltaRound = r * 2 + 2;
        const idaMatches = tournament.matches
          .filter((m) => m.round === idaRound)
          .sort((a, b) => a.matchNumber - b.matchNumber);
        const vueltaMatches = tournament.matches
          .filter((m) => m.round === vueltaRound)
          .sort((a, b) => a.matchNumber - b.matchNumber);

        rounds.push({
          roundNumber: r + 1,
          roundLabel: getRoundLabel(r + 1, bracketRoundCount),
          matches: [...idaMatches, ...vueltaMatches],
          isDoubleLeg: true,
        });
      }
    } else {
      for (let r = 1; r <= totalRounds; r++) {
        const roundMatches = tournament.matches
          .filter((m) => m.round === r)
          .sort((a, b) => a.matchNumber - b.matchNumber);

        rounds.push({
          roundNumber: r,
          roundLabel: getRoundLabel(r, totalRounds),
          matches: roundMatches,
        });
      }
    }

    return rounds;
  }, [tournament.matches, tournament.doubleRoundRobin, tournament.format]);
}
