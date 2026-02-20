"use client";

import { Match, Tournament } from "@/types";
import { BracketMatch } from "./bracket-match";

interface BracketRoundProps {
  roundLabel: string;
  matches: Match[];
  canEdit: boolean;
  tournament?: Tournament;
  isDoubleLeg?: boolean;
}

export function BracketRound({ roundLabel, matches, canEdit, tournament, isDoubleLeg }: BracketRoundProps) {
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
