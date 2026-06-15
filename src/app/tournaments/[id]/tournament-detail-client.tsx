"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TournamentDetail } from "@/components/tournaments/tournament-detail";
import { useTournaments } from "@/context/tournament-context";
import { useAuth } from "@/context/auth-context";
import { usePageView } from "@/hooks/use-page-view";
import type { TournamentPageData } from "@/lib/db/tournaments-server";

interface TournamentDetailClientProps {
  initialData: TournamentPageData;
}

/**
 * Wrapper cliente que recibe el torneo + sus equipos pre-cargados por
 * el Server Component (`page.tsx`) y los inyecta al `TournamentContext`
 * antes del primer render. Después de eso `TournamentDetail` (que usa
 * `useTournaments()` internamente para resolver nombres de equipos)
 * encuentra todo armado y aparece sin spinners.
 *
 * Patrón "seed during render": usamos `useRef` para garantizar que el
 * seed se haga UNA sola vez, dentro del cuerpo del render. React 18+
 * permite llamar a `setState` de un componente externo durante el
 * render de otro (no del propio), así que esto es válido — el provider
 * recibe el update y los hooks que dependen de él lo verán en el
 * commit. El effect adicional vuelve a llamar el seed cuando cambia el
 * `initialData` (típicamente al revalidar la cache de Edge).
 */
export function TournamentDetailClient({
  initialData,
}: TournamentDetailClientProps) {
  const { getTournamentById, seedTournamentData } = useTournaments();
  const { user, isAuthenticated } = useAuth();

  usePageView("tournament", initialData.tournament.id, "tournament");

  const seededRef = useRef<string | null>(null);
  if (seededRef.current !== initialData.tournament.id) {
    seedTournamentData(initialData.tournament, initialData.teams);
    seededRef.current = initialData.tournament.id;
  }

  // Si los `initialData` cambian (ej. ISR revalidó), re-sembramos para
  // que el state quede sincronizado.
  useEffect(() => {
    seedTournamentData(initialData.tournament, initialData.teams);
  }, [initialData, seedTournamentData]);

  // El context ya tiene el torneo (acabamos de sembrar). Si por algún
  // motivo `getTournamentById` devolviese undefined, usamos el initial
  // como fallback robusto. En la práctica esto no debería ocurrir.
  const tournament =
    getTournamentById(initialData.tournament.id) ?? initialData.tournament;

  if (!tournament) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Torneo no encontrado</h1>
        <p className="text-muted-foreground mt-2">
          El torneo que buscas no existe
        </p>
        <Button asChild className="mt-4">
          <Link href="/tournaments">Ver todos los torneos</Link>
        </Button>
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
