"use client";

import { useMemo } from "react";
import { Tournament } from "@/types";
import { TournamentCard } from "./tournament-card";
import { buildSportImageMap } from "@/data/sport-images";
import { useOrganizers } from "@/hooks/use-organizers";

export function TournamentList({
  tournaments,
  /**
   * Cuántas columnas como máximo. La portada muestra hasta 6 (mockup); el
   * dashboard y el perfil se quedan en las 3 de siempre, que es lo que da
   * el ancho de esas pantallas.
   */
  maxColumns = 3,
}: {
  tournaments: Tournament[];
  maxColumns?: 3 | 6;
}) {
  // Una sola consulta para todos los organizadores de la grilla, en vez de
  // una por tarjeta.
  const organizers = useOrganizers(
    useMemo(() => tournaments.map((t) => t.createdBy), [tournaments])
  );
  const images = useMemo(() => buildSportImageMap(tournaments), [tournaments]);

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
    <div
      className={
        maxColumns === 6
          ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6"
          : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      }
    >
      {tournaments.map((tournament, i) => (
        <TournamentCard
          key={tournament.id}
          tournament={tournament}
          organizer={
            tournament.createdBy
              ? organizers.get(tournament.createdBy)
              : undefined
          }
          image={images.get(tournament.id)}
          // Solo la primera fila sin lazy load: son las que compiten por el
          // LCP, el resto entra al hacer scroll.
          priority={i < maxColumns}
        />
      ))}
    </div>
  );
}
