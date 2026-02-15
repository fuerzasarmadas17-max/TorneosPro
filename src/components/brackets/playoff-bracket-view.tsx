"use client";

import { Tournament } from "@/types";
import { BracketView } from "./bracket-view";

interface PlayoffBracketViewProps {
  tournament: Tournament;
  canEdit: boolean;
}

export function PlayoffBracketView({ tournament, canEdit }: PlayoffBracketViewProps) {
  const playoffTournament: Tournament = {
    ...tournament,
    matches: tournament.matches.filter((m) => m.phase === "playoff"),
  };

  if (!tournament.groupStageComplete) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium mb-2">Playoffs pendientes</p>
        <p className="text-sm">
          El bracket de playoffs se generara automaticamente cuando finalice la fase de grupos.
        </p>
      </div>
    );
  }

  return <BracketView tournament={playoffTournament} canEdit={canEdit} />;
}
