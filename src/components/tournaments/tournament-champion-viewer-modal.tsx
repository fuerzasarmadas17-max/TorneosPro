"use client";

import { useEffect, useState } from "react";
import { Tournament } from "@/types";
import { getFinalSeriesChampion } from "@/data/helpers";
import { useTournaments } from "@/context/tournament-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import { ChampionSponsorsStrip } from "@/components/tournaments/champion-sponsors-strip";

interface TournamentChampionViewerModalProps {
  tournament: Tournament;
  /** When true, the viewer stays closed — used to avoid showing it on top of
   *  the organizer's celebration modal while they're uploading the photo. */
  disabled?: boolean;
}

/**
 * Pieza J: read-only champion banner shown as a centered modal on every
 * load of a completed tournament that has `championPhotoUrl` set. Unlike
 * the celebration modal (which fires once per session on the status
 * transition), this one opens automatically on mount and re-opens on every
 * reload — the user can dismiss it to inspect the bracket / phases.
 *
 * Visible for every visitor, including non-logged-in public viewers. The
 * champion name comes from the final series winner.
 */
export function TournamentChampionViewerModal({
  tournament,
  disabled = false,
}: TournamentChampionViewerModalProps) {
  const { teams } = useTournaments();
  const [open, setOpen] = useState(false);

  // Open on mount when the tournament is completed and has a photo. Stays
  // dormant while `disabled` is true so it doesn't stack on top of the
  // organizer's celebration modal during the upload flow.
  useEffect(() => {
    if (disabled) return;
    if (tournament.status === "completed" && tournament.championPhotoUrl) {
      setOpen(true);
    }
  }, [tournament.status, tournament.championPhotoUrl, disabled]);

  if (tournament.status !== "completed" || !tournament.championPhotoUrl) {
    return null;
  }

  const championId = getFinalSeriesChampion(tournament);
  const championName = championId
    ? teams.find((t) => t.id === championId)?.name ?? "El campeón"
    : "El campeón";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-2xl"
        // El modal de publicidad (`components/ads/ad-modal.tsx`) se pinta
        // ENCIMA de este, con su propio overlay y z-[100]. Como no es un
        // Dialog de Radix, cualquier click suyo —incluida su X— le llega a
        // Radix como "click afuera" y cerraba también la foto del campeón:
        // el espectador tocaba la X del anuncio y perdía el campeón sin
        // haberlo pedido.
        //
        // Cerrar solo a propósito. Quedan las dos salidas de siempre: la X de
        // la esquina y el botón del pie. Y de paso deja de cerrarse por un
        // toque mal dado, que en una foto que la gente abre para mirar es más
        // molesto que útil.
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex flex-col items-center gap-2 text-center pt-2">
            <Trophy className="h-12 w-12 text-amber-500" />
            <DialogTitle className="text-2xl">¡Campeón!</DialogTitle>
            <DialogDescription className="text-base">
              <span className="font-semibold text-foreground">
                {championName}
              </span>{" "}
              ganó el torneo{" "}
              <span className="font-semibold text-foreground">
                {tournament.name}
              </span>
              .
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="relative w-full aspect-video overflow-hidden rounded-lg border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tournament.championPhotoUrl}
            alt={`Campeón ${championName}`}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>

        {/* Sponsors strip below the photo — public viewers see the tournament's
            patrocinadores alongside the champion. */}
        <ChampionSponsorsStrip
          sponsors={tournament.sponsors}
          tournamentId={tournament.id}
        />

        <DialogFooter className="sm:justify-center">
          <Button onClick={() => setOpen(false)}>
            Cerrar y ver el torneo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
