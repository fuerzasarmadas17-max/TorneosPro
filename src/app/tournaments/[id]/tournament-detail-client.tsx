"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { TournamentDetail } from "@/components/tournaments/tournament-detail";
import { useTournaments } from "@/context/tournament-context";
import { useAuth } from "@/context/auth-context";
import { usePageView } from "@/hooks/use-page-view";
import type { TournamentPageData } from "@/lib/db/tournaments-server";
import { fetchMatchEventsByMatchIds } from "@/lib/db/tournaments";
import { mapMatchEvent } from "@/lib/db/mappers";
import type { Tournament } from "@/types";

interface TournamentDetailClientProps {
  initialData: TournamentPageData;
}

// En el cliente corre ANTES del paint (evita el flash de UUIDs); en el
// servidor cae a useEffect (que no se ejecuta en SSR) para no romper el render.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

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
  const { getTournamentById, seedTournamentData } = useTournaments();
  const { user, isAuthenticated } = useAuth();

  usePageView("tournament", initialData.tournament.id, "tournament");

  // Sembramos los teams en el context en un layout-effect (antes del paint):
  // si esperáramos a un useEffect normal, el primer paint del TournamentDetail
  // pasaría con `teams=[]` en el context y los subcomponentes (BracketView,
  // MatchSchedule, etc.) mostrarían UUIDs en `getTeamById`. En mobile ese
  // "flash de UUIDs" se veía 1-2 s. useLayoutEffect corre sincrónicamente
  // antes de que el navegador pinte, así que el usuario nunca ve ese estado —
  // y no viola la regla de React de no hacer setState de otro componente
  // durante el render (que era el problema del seed en fase de render).
  const seededRef = useRef<string | null>(null);
  useIsomorphicLayoutEffect(() => {
    if (seededRef.current !== initialData.tournament.id) {
      seedTournamentData(initialData.tournament, initialData.teams);
      seededRef.current = initialData.tournament.id;
    }
  }, [initialData.tournament, initialData.teams, seedTournamentData]);

  // Después del primer paint, traer los match_events (que el SSR omitió
  // para no timeoutear) y re-seed. Las stats individuales, sanciones y
  // tarjetas aparecen ~300-500ms después sin bloquear el bracket ni el
  // calendario que ya están visibles.
  useEffect(() => {
    let cancelled = false;
    const matchIds = initialData.tournament.matches.map((m) => m.id);
    fetchMatchEventsByMatchIds(matchIds)
      .then((eventsMap) => {
        if (cancelled) return;
        const enriched: Tournament = {
          ...initialData.tournament,
          matches: initialData.tournament.matches.map((m) => {
            const rawEvents = eventsMap.get(m.id);
            if (!rawEvents) return m;
            return { ...m, events: rawEvents.map(mapMatchEvent) };
          }),
        };
        seedTournamentData(enriched, initialData.teams);
      })
      .catch((err) => {
        console.error("fetchMatchEventsByMatchIds failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, [initialData, seedTournamentData]);

  // El context ya tiene el torneo (lo sembramos en el effect). Si por
  // algún motivo `getTournamentById` devolviese undefined, usamos el
  // initial como fallback robusto.
  const tournament =
    getTournamentById(initialData.tournament.id) ?? initialData.tournament;

  // Render directo del detalle. El `teamsReady` que esperaba al state
  // global del context era EL bug del bloqueo de 30 segundos en mobile:
  // para anónimos el global `teams[]` NUNCA se llena (loadTeams solo
  // dispara para autenticados) — el skeleton quedaba para siempre. Como
  // el SSR ya nos pasó `initialData.teams` y el effect del seed los
  // mete al context de inmediato, no hay nada que esperar.
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
