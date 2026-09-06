"use client";

import { useEffect, useState } from "react";
import { Tournament } from "@/types";
import { getFinalSeriesChampion } from "@/data/helpers";
import { useTournaments } from "@/context/tournament-context";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Star, Trophy } from "lucide-react";
import { ChampionHeader } from "@/components/tournaments/tournament-champion-header";
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
 *
 * MVP del torneo: cuando el organizador además subió la foto del MVP, el mismo
 * modal la muestra con un botón que pasa de una a la otra. Van juntas y no en
 * dos modales porque el visitante abre esto una vez, para mirar el cierre del
 * torneo; dos ventanas seguidas se leen como un anuncio.
 *
 * Si solo hay foto de MVP —el organizador subió esa y no la del campeón— el
 * modal abre directo en el MVP.
 */
export function TournamentChampionViewerModal({
  tournament,
  disabled = false,
}: TournamentChampionViewerModalProps) {
  const { teams } = useTournaments();
  const [open, setOpen] = useState(false);
  const hasChampionPhoto = Boolean(tournament.championPhotoUrl);
  const hasMvpPhoto = Boolean(tournament.mvpPhotoUrl);
  // Qué foto se está mirando. Arranca en el campeón salvo que solo haya MVP.
  const [view, setView] = useState<"champion" | "mvp">(
    hasChampionPhoto ? "champion" : "mvp"
  );

  // Open on mount when the tournament is completed and has a photo. Stays
  // dormant while `disabled` is true so it doesn't stack on top of the
  // organizer's celebration modal during the upload flow.
  useEffect(() => {
    if (disabled) return;
    if (
      tournament.status === "completed" &&
      (tournament.championPhotoUrl || tournament.mvpPhotoUrl)
    ) {
      setOpen(true);
    }
  }, [
    tournament.status,
    tournament.championPhotoUrl,
    tournament.mvpPhotoUrl,
    disabled,
  ]);

  if (
    tournament.status !== "completed" ||
    (!tournament.championPhotoUrl && !tournament.mvpPhotoUrl)
  ) {
    return null;
  }

  const championId = getFinalSeriesChampion(tournament);
  const championName = championId
    ? teams.find((t) => t.id === championId)?.name ?? "El campeón"
    : "El campeón";

  const championTeam = championId
    ? (teams.find((t) => t.id === championId) ?? null)
    : null;
  const mvpTeam = tournament.mvpTeamId
    ? (teams.find((t) => t.id === tournament.mvpTeamId) ?? null)
    : null;
  const mvpName = tournament.mvpPlayerName ?? "El MVP";
  const mvpTeamName = mvpTeam?.name ?? null;
  const showingMvp = view === "mvp" && hasMvpPhoto;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto"
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
          {/* El escudo del equipo manda la forma de la cabecera: con logo, el
              texto se va a la izquierda; sin logo, todo centrado como siempre.
              En la vista del MVP el equipo es el suyo, no el del campeón. */}
          <ChampionHeader
            icon={showingMvp ? "star" : "trophy"}
            title={showingMvp ? "MVP del torneo" : "¡Campeón!"}
            portraitUrl={showingMvp ? tournament.mvpPhotoUrl : null}
            teamLogoUrl={showingMvp ? null : championTeam?.logoUrl}
            teamName={showingMvp ? (mvpTeamName ?? "") : championName}
            description={
              showingMvp ? (
                <>
                  {/* El título ya dice "MVP del torneo": repetir "el mejor
                      jugador de <torneo>" abajo es decir lo mismo dos veces. */}
                  <span className="font-semibold text-foreground">
                    {mvpName}
                  </span>
                  {mvpTeamName && (
                    <span className="mt-1.5 flex items-center gap-2 text-sm">
                      {mvpTeam?.logoUrl && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={mvpTeam.logoUrl}
                          alt=""
                          width={40}
                          height={40}
                          className="h-8 w-8 shrink-0 object-contain sm:h-10 sm:w-10"
                        />
                      )}
                      {mvpTeamName}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="font-semibold text-foreground">
                    {championName}
                  </span>{" "}
                  ganó el torneo{" "}
                  <span className="font-semibold text-foreground">
                    {tournament.name}
                  </span>
                  .
                </>
              )
            }
          />
        </DialogHeader>

        {/* La foto del MVP ya está en la cabecera, al lado del texto: acá abajo
            va solo la del campeón, que es horizontal y se luce a lo ancho. */}
        {!showingMvp && (
          <div className="relative w-full aspect-video overflow-hidden rounded-lg border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tournament.championPhotoUrl ?? ""}
              alt={`Campeón ${championName}`}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        )}

        {/* Sponsors strip below the photo — public viewers see the tournament's
            patrocinadores alongside the champion. */}
        <ChampionSponsorsStrip
          sponsors={tournament.sponsors}
          tournamentId={tournament.id}
        />

        <DialogFooter className="gap-2 sm:justify-center">
          {/* El botón para cruzar entre las dos fotos aparece solo cuando las
              dos existen. Con una sola, este pie queda como estaba. */}
          {hasChampionPhoto && hasMvpPhoto && (
            <Button
              variant="outline"
              onClick={() => setView(showingMvp ? "champion" : "mvp")}
            >
              {showingMvp ? (
                <>
                  <Trophy className="mr-2 h-4 w-4" />
                  Ver el campeón
                </>
              ) : (
                <>
                  <Star className="mr-2 h-4 w-4" />
                  Ver el MVP del torneo
                </>
              )}
            </Button>
          )}
          <Button onClick={() => setOpen(false)}>
            Cerrar y ver el torneo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
