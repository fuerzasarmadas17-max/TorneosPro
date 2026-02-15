"use client";

import { Tournament } from "@/types";
import { TournamentCard } from "./tournament-card";

export function TournamentList({
  tournaments,
}: {
  tournaments: Tournament[];
}) {
  if (tournaments.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">
          No se encontraron torneos
        </p>
        <p className="text-muted-foreground text-sm mt-1">
          Intenta con otros filtros o crea un nuevo torneo
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tournaments.map((tournament) => (
        <TournamentCard key={tournament.id} tournament={tournament} />
      ))}
    </div>
  );
}
