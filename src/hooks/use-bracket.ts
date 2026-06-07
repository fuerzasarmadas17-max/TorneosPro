import { useMemo } from "react";
import { Match, Tournament } from "@/types";
import { getRoundLabel } from "@/data/helpers";

export interface BracketRound {
  roundNumber: number;
  roundLabel: string;
  matches: Match[];
  isDoubleLeg?: boolean;
  /** Pieza I + tennis-style render: the final round renders as a single card
   *  showing both finalists and the game-by-game scores like a tennis match.
   *  Triggered for any chosen `playoffFinalFormat` (single / double_leg /
   *  best_of_5 / best_of_7). `seriesTarget` is the wins needed to clinch (1
   *  for single/double_leg, 3 for best-of-5, 4 for best-of-7). `seriesFormat`
   *  lets the renderer pick the right header label (Global / Serie / Final). */
  isSeries?: boolean;
  seriesTarget?: number;
  seriesFormat?: Tournament["playoffFinalFormat"];
}

export function useBracket(tournament: Tournament): BracketRound[] {
  return useMemo(() => {
    if (tournament.matches.length === 0) return [];
    const rounds: BracketRound[] = [];

    // Identify the final series. When playoffFinalFormat is set, the
    // configurePlayoffFinal materializer placed N matches at the highest
    // playoff round (or, for elimination format with doubleRoundRobin, the
    // highest match round). Those N matches collapse into one tennis-style
    // card; the regular per-round processing skips that last round so it
    // doesn't render twice.
    const playoffMatches = tournament.matches.filter(
      (m) => m.phase === "playoff"
    );
    const eliminationFinalApplies =
      tournament.format === "elimination" && !!tournament.playoffFinalFormat;
    const finalMatches = (() => {
      if (!tournament.playoffFinalFormat) return [] as Match[];
      const pool =
        playoffMatches.length > 0 ? playoffMatches : tournament.matches;
      if (pool.length === 0) return [] as Match[];
      const maxRound = Math.max(...pool.map((m) => m.round));
      return pool
        .filter((m) => m.round === maxRound)
        .sort((a, b) => a.matchNumber - b.matchNumber);
    })();
    const finalMatchIds = new Set(finalMatches.map((m) => m.id));
    const hasFinalSeries = finalMatches.length > 0;
    const finalSeriesTarget = (() => {
      if (!hasFinalSeries) return 0;
      switch (tournament.playoffFinalFormat) {
        case "best_of_5":
          return 3;
        case "best_of_7":
          return 4;
        default:
          // single & double_leg: one "win" decides (game / aggregate).
          return 1;
      }
    })();

    // Matches considered for the rest of the bracket (everything that is
    // NOT part of the final series).
    const nonFinalMatches = tournament.matches.filter(
      (m) => !finalMatchIds.has(m.id)
    );
    const totalRounds =
      nonFinalMatches.length > 0
        ? Math.max(...nonFinalMatches.map((m) => m.round))
        : 0;

    // Same pairing logic for both shapes of double-leg bracket:
    //  - elimination format with doubleRoundRobin
    //  - group-playoff format with playoffDoubleLeg (Pieza G)
    const isDoubleLegBracket =
      (tournament.format === "elimination" && tournament.doubleRoundRobin) ||
      (tournament.format === "group-playoff" && tournament.playoffDoubleLeg);

    if (totalRounds > 0) {
      if (isDoubleLegBracket) {
        // Round count for the non-final part. Round numbers come straight
        // from the bracket positions (cuartos/semis/final from the label
        // helper), so we use a forecasted total that includes the final
        // when it exists — otherwise non-final rounds get wrong labels.
        const labeledTotal = hasFinalSeries
          ? Math.ceil((totalRounds + 1) / 2) + (eliminationFinalApplies ? 0 : 0)
          : Math.ceil(totalRounds / 2);
        const nonFinalPairCount = Math.ceil(totalRounds / 2);
        for (let r = 0; r < nonFinalPairCount; r++) {
          const idaRound = r * 2 + 1;
          const vueltaRound = r * 2 + 2;
          const idaMatches = nonFinalMatches
            .filter((m) => m.round === idaRound)
            .sort((a, b) => a.matchNumber - b.matchNumber);
          const vueltaMatches = nonFinalMatches
            .filter((m) => m.round === vueltaRound)
            .sort((a, b) => a.matchNumber - b.matchNumber);
          if (idaMatches.length === 0 && vueltaMatches.length === 0) continue;
          rounds.push({
            roundNumber: r + 1,
            roundLabel: getRoundLabel(r + 1, labeledTotal),
            matches: [...idaMatches, ...vueltaMatches],
            isDoubleLeg: true,
          });
        }
      } else {
        const labeledTotal = hasFinalSeries ? totalRounds + 1 : totalRounds;
        for (let r = 1; r <= totalRounds; r++) {
          const roundMatches = nonFinalMatches
            .filter((m) => m.round === r)
            .sort((a, b) => a.matchNumber - b.matchNumber);
          if (roundMatches.length === 0) continue;
          rounds.push({
            roundNumber: r,
            roundLabel: getRoundLabel(r, labeledTotal),
            matches: roundMatches,
          });
        }
      }
    }

    if (hasFinalSeries) {
      const finalRoundNumber = rounds.length + 1;
      rounds.push({
        roundNumber: finalRoundNumber,
        roundLabel: getRoundLabel(finalRoundNumber, finalRoundNumber),
        matches: finalMatches,
        isSeries: true,
        seriesTarget: finalSeriesTarget,
        seriesFormat: tournament.playoffFinalFormat,
      });
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
