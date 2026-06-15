"use client";

import { use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TournamentDetail } from "@/components/tournaments/tournament-detail";
import { useTournaments } from "@/context/tournament-context";
import { useAuth } from "@/context/auth-context";
import { usePageView } from "@/hooks/use-page-view";
import { Loader2 } from "lucide-react";

export default function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { getTournamentById, isLoading: dataLoading, teamsLoading, teams } = useTournaments();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  usePageView("tournament", id, "tournament");

  const tournament = getTournamentById(id);

  // Still loading — don't show "not found" yet.
  if (!tournament && (dataLoading || authLoading)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando torneo...</p>
        </div>
      </div>
    );
  }

  // Tenemos el torneo pero los equipos del sistema aún están bajando en
  // background. Sin esto el bracket / posiciones / calendario muestran
  // UUIDs en lugar de nombres durante ~1-2s — feo y confuso. Esperamos
  // unos segundos a que termine la carga; si ya hay datos en `teams` lo
  // saltamos directo aunque `teamsLoading` siga true (caso navegación
  // interna). En la práctica solo aparece para usuarios anónimos que
  // entran directo por link compartido (WhatsApp etc.).
  if (tournament && teamsLoading && teams.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Cargando equipos del torneo...
          </p>
        </div>
      </div>
    );
  }

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
    (user?.id === tournament.createdBy && tournament.status !== "completed") || isAdmin;
  const canEditSponsors =
    canEdit || isAdmin;

  return (
    <div className="container mx-auto px-4 py-8">
      <TournamentDetail tournament={tournament} canEdit={canEdit} canEditSponsors={canEditSponsors} orgSponsors={user?.organizationProfile?.sponsors} isAuthenticated={isAuthenticated} />
    </div>
  );
}
