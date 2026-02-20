"use client";

import { Tournament } from "@/types";
import { useBracket } from "@/hooks/use-bracket";
import { BracketRound } from "./bracket-round";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface BracketViewProps {
  tournament: Tournament;
  canEdit: boolean;
}

export function BracketView({ tournament, canEdit }: BracketViewProps) {
  const rounds = useBracket(tournament);

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-8 p-4 min-w-max">
        {rounds.map((round) => (
          <BracketRound
            key={round.roundNumber}
            roundLabel={round.roundLabel}
            matches={round.matches}
            canEdit={canEdit}
            tournament={tournament}
            isDoubleLeg={round.isDoubleLeg}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
