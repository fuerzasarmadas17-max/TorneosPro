"use client";

import { Match, Tournament } from "@/types";
import { BracketMatch } from "./bracket-match";

interface BracketRoundProps {
  roundLabel: string;
  matches: Match[];
  canEdit: boolean;
  tournament?: Tournament;
}

export function BracketRound({ roundLabel, matches, canEdit, tournament }: BracketRoundProps) {
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
