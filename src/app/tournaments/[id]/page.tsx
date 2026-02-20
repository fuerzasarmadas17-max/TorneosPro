"use client";

import { use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TournamentDetail } from "@/components/tournaments/tournament-detail";
import { useTournaments } from "@/context/tournament-context";
import { useAuth } from "@/context/auth-context";
import { Loader2 } from "lucide-react";

export default function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { getTournamentById, isLoading: dataLoading } = useTournaments();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const tournament = getTournamentById(id);

  // Still loading — don't show "not found" yet
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
