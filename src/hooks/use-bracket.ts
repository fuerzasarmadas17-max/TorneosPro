import { useMemo } from "react";
import { Match, Tournament } from "@/types";
import { getRoundLabel } from "@/data/helpers";

export interface BracketRound {
  roundNumber: number;
  roundLabel: string;
  matches: Match[];
  isDoubleLeg?: boolean;
  /** Pieza I: best-of-N final series. When set, BracketRound renders a
   *  single card showing all `matches` as games of the series with a
   *  running scoreboard. `seriesTarget` is the wins needed to clinch
   *  (3 for best-of-5, 4 for best-of-7). */
  isSeries?: boolean;
  seriesTarget?: number;
}

export function useBracket(tournament: Tournament): BracketRound[] {
  return useMemo(() => {
    if (tournament.matches.length === 0) return [];
    const totalRounds = Math.max(...tournament.matches.map((m) => m.round));
    const rounds: BracketRound[] = [];

    // Pieza I: best-of-N final. The configurePlayoffFinal materializer puts
    // all N series matches in the SAME (highest) round and they all share
    // the same matchup teams. We detect that here so the renderer can group
    // them as one card.
    const isBestOfNFinal =
      tournament.playoffFinalFormat === "best_of_5" ||
      tournament.playoffFinalFormat === "best_of_7";
    const finalSeriesTarget =
      tournament.playoffFinalFormat === "best_of_5"
        ? 3
        : tournament.playoffFinalFormat === "best_of_7"
          ? 4
          : 0;

    // Same pairing logic for both shapes of double-leg bracket:
    //  - elimination format with doubleRoundRobin
    //  - group-playoff format with playoffDoubleLeg (Pieza G)
    // In both, raw matches are stored as round 1=ida r1, round 2=vuelta r1,
    // round 3=ida r2, etc. We collapse each pair into a single visual round
    // so BracketMatch can render "Ida X-Y / Vuelta X-Y · Global Z" in one card.
    const isDoubleLegBracket =
      (tournament.format === "elimination" && tournament.doubleRoundRobin) ||
      (tournament.format === "group-playoff" && tournament.playoffDoubleLeg);

    if (isDoubleLegBracket) {
      // Double-leg: group paired rounds (1+2, 3+4, 5+6...) into bracket rounds
      // Final exception: if a best-of-N final overrides the last bracket
      // round, that round is rendered as a series instead of an ida/vuelta
      // pair. configurePlayoffFinal places all N final matches in the same
      // raw round, so we detect by counting.
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

        const isLastBracketRound = r === bracketRoundCount - 1;
        if (isLastBracketRound && isBestOfNFinal && idaMatches.length > 2) {
          // Best-of-N final overrode the pair: all series matches are in
          // idaRound. Render as one series card.
          rounds.push({
            roundNumber: r + 1,
            roundLabel: getRoundLabel(r + 1, bracketRoundCount),
            matches: idaMatches,
            isSeries: true,
            seriesTarget: finalSeriesTarget,
          });
        } else {
          rounds.push({
            roundNumber: r + 1,
            roundLabel: getRoundLabel(r + 1, bracketRoundCount),
            matches: [...idaMatches, ...vueltaMatches],
            isDoubleLeg: true,
          });
        }
      }
    } else {
      for (let r = 1; r <= totalRounds; r++) {
        const roundMatches = tournament.matches
          .filter((m) => m.round === r)
          .sort((a, b) => a.matchNumber - b.matchNumber);

        const isLast = r === totalRounds;
        if (isLast && isBestOfNFinal && roundMatches.length > 1) {
          rounds.push({
            roundNumber: r,
            roundLabel: getRoundLabel(r, totalRounds),
            matches: roundMatches,
            isSeries: true,
            seriesTarget: finalSeriesTarget,
          });
        } else {
          rounds.push({
            roundNumber: r,
            roundLabel: getRoundLabel(r, totalRounds),
            matches: roundMatches,
          });
        }
      }
    }

    return rounds;
  }, [
    tournament.matches,
    tournament.doubleRoundRobin,
    tournament.format,
    tournament.playoffDoubleLeg,
    tournament.playoffFinalFormat,
  ]);
}
