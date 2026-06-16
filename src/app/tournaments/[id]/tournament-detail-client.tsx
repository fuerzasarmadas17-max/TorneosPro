"use client";

import { useEffect, useMemo, useState } from "react";
import { TournamentDetail } from "@/components/tournaments/tournament-detail";
import { useTournaments } from "@/context/tournament-context";
import { useAuth } from "@/context/auth-context";
import { usePageView } from "@/hooks/use-page-view";
import type { TournamentPageData } from "@/lib/db/tournaments-server";
import { fetchMatchEventsByTournament } from "@/lib/db/tournaments";
import { mapMatchEvent } from "@/lib/db/mappers";
import { Loader2 } from "lucide-react";
import type { Tournament } from "@/types";

interface TournamentDetailClientProps {
  initialData: TournamentPageData;
}

/**
 * Wrapper cliente del detalle del torneo.
 *
 * Estrategia para evitar el "flash de UUIDs": el SSR no puede ejecutar
 * setState en el provider, así que el HTML inicial tendría los teams
 * vacíos en el contexto. Si renderizáramos TournamentDetail directo,
 * los subcomponentes (BracketView, MatchSchedule, Standings) leerían
 * `useTournaments().getTeamById` con `teams=[]` y mostrarían los UUIDs.
 *
 * Solución: verificamos si TODOS los equipos del torneo están en el
 * context. Si faltan, sembramos vía useEffect y mientras tanto
 * mostramos un skeleton liviano con info que sí tenemos (nombre del
 * torneo del initialData). Es ~50-100ms entre el primer paint
 * (skeleton + título) y el TournamentDetail completo — mucho mejor que
 * mostrar UUIDs.
 *
 * Cuando el usuario navega desde el listado interno, los teams ya
 * están en el context y el skeleton ni siquiera aparece.
 */
export function TournamentDetailClient({
  initialData,
}: TournamentDetailClientProps) {
  const { getTournamentById, seedTournamentData, teams } = useTournaments();
  const { user, isAuthenticated } = useAuth();

  usePageView("tournament", initialData.tournament.id, "tournament");

  // Resembrar si cambian los initialData (revalidación de cache Edge).
  useEffect(() => {
    seedTournamentData(initialData.tournament, initialData.teams);
  }, [initialData, seedTournamentData]);

  // El SSR cargó el torneo SIN match_events (para evitar el 504 de
  // Vercel). Acá completamos: en cuanto el cliente termina de hidratar,
  // disparamos un fetch específico de los eventos del torneo y los
  // mergeamos en el state local. Las stats individuales, sanciones y
  // tarjetas aparecen al toque después (~300-500ms). No bloquea nada.
  const [eventsLoaded, setEventsLoaded] = useState(false);
  useEffect(() => {
    if (eventsLoaded) return;
    let cancelled = false;
    (async () => {
      const eventsMap = await fetchMatchEventsByTournament(
        initialData.tournament.id
      );
      if (cancelled) return;
      // Sembramos los events directamente en el torneo. Lo hacemos
      // construyendo un Tournament nuevo con los matches enriquecidos
      // y volviendo a llamar seedTournamentData, que reemplaza el
      // torneo existente en el state.
      const enriched: Tournament = {
        ...initialData.tournament,
        matches: initialData.tournament.matches.map((m) => {
          const rawEvents = eventsMap.get(m.id);
          if (!rawEvents) return m;
          return { ...m, events: rawEvents.map(mapMatchEvent) };
        }),
      };
      seedTournamentData(enriched, initialData.teams);
      setEventsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialData, eventsLoaded, seedTournamentData]);

  // ¿El context tiene todos los equipos del torneo? Mientras no los
  // tenga, los subcomponentes mostrarían UUIDs — mejor un skeleton.
  const teamsReady = useMemo(() => {
    if (teams.length === 0) return false;
    const teamIdSet = new Set(teams.map((t) => t.id));
    return initialData.tournament.teamIds.every((id) => teamIdSet.has(id));
  }, [teams, initialData.tournament.teamIds]);

  const tournament =
    getTournamentById(initialData.tournament.id) ?? initialData.tournament;

  if (!teamsReady) {
    // Primer paint del SSR + transición de hidratación. Mostramos lo
    // que ya tenemos del initialData (nombre + descripción) y un
    // spinner suave debajo. Dura típicamente 50-100ms en cliente
    // después del hydrate.
    return (
      <div className="container mx-auto px-4 py-8 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{tournament.name}</h1>
          {tournament.description && (
            <p className="text-muted-foreground">{tournament.description}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {tournament.teamIds.length} equipos · Inicio: {tournament.startDate}
          </p>
        </header>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const isAdmin = user?.role === "admin";
  const canEdit =
    (user?.id === tournament.createdBy && tournament.status !== "completed") ||
    isAdmin;
  const canEditSponsors = canEdit || isAdmin;

  return (
    <div className="container mx-auto px-4 py-8">
      <TournamentDetail
        tournament={tournament}
        canEdit={canEdit}
        canEditSponsors={canEditSponsors}
        orgSponsors={user?.organizationProfile?.sponsors}
        isAuthenticated={isAuthenticated}
      />
    </div>
  );
}
