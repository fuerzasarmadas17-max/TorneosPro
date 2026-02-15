import { useMemo } from "react";
import { Match, Tournament } from "@/types";
import { getRoundLabel } from "@/data/helpers";

export interface BracketRound {
  roundNumber: number;
  roundLabel: string;
  matches: Match[];
}

export function useBracket(tournament: Tournament): BracketRound[] {
  return useMemo(() => {
    const totalRounds = Math.max(...tournament.matches.map((m) => m.round));
    const rounds: BracketRound[] = [];

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

    return rounds;
  }, [tournament.matches]);
}
