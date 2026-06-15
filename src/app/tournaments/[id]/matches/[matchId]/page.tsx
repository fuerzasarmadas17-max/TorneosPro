"use client";

import { use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthGuard } from "@/components/auth-guard";
import { MatchResultForm } from "@/components/forms/match-result-form";
import { useTournaments } from "@/context/tournament-context";
import { useAuth } from "@/context/auth-context";

function MatchContent({
  tournamentId,
  matchId,
}: {
  tournamentId: string;
  matchId: string;
}) {
  const { getTournamentById } = useTournaments();
  const { user } = useAuth();

  const tournament = getTournamentById(tournamentId);

  if (!tournament) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold">Torneo no encontrado</h1>
        <Button asChild className="mt-4">
          <Link href="/tournaments">Ver torneos</Link>
        </Button>
      </div>
    );
  }

  const match = tournament.matches.find((m) => m.id === matchId);

  if (!match) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold">Partido no encontrado</h1>
        <Button asChild className="mt-4">
          <Link href={`/tournaments/${tournamentId}`}>Volver al torneo</Link>
        </Button>
      </div>
    );
  }

  if (tournament.createdBy !== user?.id) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold">Sin permisos</h1>
        <p className="text-muted-foreground mt-2">
          Solo el creador del torneo puede ingresar resultados
        </p>
        <Button asChild className="mt-4">
          <Link href={`/tournaments/${tournamentId}`}>Volver al torneo</Link>
        </Button>
      </div>
    );
  }

  // Antes acá había un block hard-coded de match.status === "completed"
  // que impedía entrar al form. El organizer no podía corregir un
  // resultado mal cargado. Lo quitamos — el guard por `createdBy` arriba
  // sigue siendo la restricción real (solo el creador edita, super admin
  // queda bloqueado). El form precarga los valores actuales y avisa que
  // es edición, no nueva carga.
  return <MatchResultForm match={match} enabledStats={tournament.enabledStats} sport={tournament.sport} bestOf={tournament.bestOf} />;
}

export default function MatchResultPage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>;
}) {
  const { id, matchId } = use(params);

  return (
    <AuthGuard>
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <MatchContent tournamentId={id} matchId={matchId} />
      </div>
    </AuthGuard>
  );
}
