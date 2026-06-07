"use client";

import { Match, Tournament } from "@/types";
import { BracketMatch } from "./bracket-match";

interface BracketRoundProps {
  roundLabel: string;
  matches: Match[];
  canEdit: boolean;
  tournament?: Tournament;
  isDoubleLeg?: boolean;
  /** Tennis-style final series. When set, all matches render as a single
   *  card showing both finalists with game-by-game scores. */
  isSeries?: boolean;
  seriesTarget?: number;
  seriesFormat?: Tournament["playoffFinalFormat"];
}

export function BracketRound({
  roundLabel,
  matches,
  canEdit,
  tournament,
  isDoubleLeg,
  isSeries,
  seriesTarget,
  seriesFormat,
}: BracketRoundProps) {
  // Final series: one card showing both finalists with all game scores.
  if (isSeries && matches.length > 0) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground text-center mb-2">
          {roundLabel}
        </h3>
        <div className="flex flex-col justify-around flex-1">
          <BracketMatch
            match={matches[0]}
            seriesMatches={matches}
            seriesTarget={seriesTarget}
            seriesFormat={seriesFormat}
            canEdit={canEdit}
            tournament={tournament}
          />
        </div>
      </div>
    );
  }

  // For double-leg: pair ida + vuelta matches (first half = ida, second half = vuelta)
  if (isDoubleLeg) {
    const half = Math.ceil(matches.length / 2);
    const idaMatches = matches.slice(0, half);
    const vueltaMatches = matches.slice(half);

    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground text-center mb-2">
          {roundLabel}
        </h3>
        <div className="flex flex-col justify-around gap-6 flex-1">
          {idaMatches.map((idaMatch, i) => (
            <BracketMatch
              key={idaMatch.id}
              match={idaMatch}
              vueltaMatch={vueltaMatches[i]}
              canEdit={canEdit}
              tournament={tournament}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-muted-foreground text-center mb-2">
        {roundLabel}
      </h3>
      <div className="flex flex-col justify-around gap-6 flex-1">
        {matches.map((match) => (
          <BracketMatch key={match.id} match={match} canEdit={canEdit} tournament={tournament} />
        ))}
      </div>
    </div>
  );
}
