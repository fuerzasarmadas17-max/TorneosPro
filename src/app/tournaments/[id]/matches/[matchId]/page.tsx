"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthGuard } from "@/components/auth-guard";
import { MatchResultForm } from "@/components/forms/match-result-form";
import { useTournaments } from "@/context/tournament-context";
import { useAuth } from "@/context/auth-context";
import { fetchMatchEventsByMatchIds } from "@/lib/db/tournaments";
import { mapMatchEvent } from "@/lib/db/mappers";
import type { MatchEvent } from "@/types";

function MatchContent({
  tournamentId,
  matchId,
}: {
  tournamentId: string;
  matchId: string;
}) {
  const { getTournamentById } = useTournaments();
  const { user } = useAuth();

  // Los eventos de ESTE partido se piden acá, no se heredan del contexto.
  // Antes el form dependía de que la página del torneo hubiera bajado los
  // eventos de todos los partidos: si se entraba por link directo (o si esa
  // descarga masiva se difiere), el form arrancaba vacío y al guardar
  // borraba los goles y tarjetas ya cargados. Por eso no renderizamos el
  // form hasta tener los eventos, y ante un error mostramos reintentar en
  // vez de un formulario en blanco: `MatchResultForm` inicializa su estado
  // una sola vez al montar, así que llegar tarde con los datos no sirve.
  const [events, setEvents] = useState<MatchEvent[] | null>(null);
  const [eventsFailed, setEventsFailed] = useState(false);
  // El botón de reintentar incrementa esto para re-disparar el effect.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchMatchEventsByMatchIds([matchId])
      .then((map) => {
        if (cancelled) return;
        setEvents((map.get(matchId) ?? []).map(mapMatchEvent));
        setEventsFailed(false);
      })
      .catch((err) => {
        console.error("No se pudieron cargar los eventos del partido", err);
        if (!cancelled) setEventsFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId, reloadKey]);

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
  if (eventsFailed) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold">No se pudo cargar el partido</h1>
        <p className="text-muted-foreground mt-2">
          No pudimos traer las estadísticas ya cargadas. Reintenta antes de
          editar, para no perder lo que ya estaba guardado.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button
            onClick={() => {
              setEventsFailed(false);
              setReloadKey((k) => k + 1);
            }}
          >
            Reintentar
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/tournaments/${tournamentId}`}>Volver al torneo</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (events === null) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Cargando partido…
      </div>
    );
  }

  return (
    <MatchResultForm
      match={{ ...match, events }}
      enabledStats={tournament.enabledStats}
      sport={tournament.sport}
      bestOf={tournament.bestOf}
    />
  );
}

export default function MatchResultPage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>;
}) {
  const { id, matchId } = use(params);

  return (
    <AuthGuard>
      <div className="container mx-auto px-4 py-8">
        {/* `key` por partido: navegar de un partido a otro sin salir de la
            ruta remonta el contenido, así los eventos ya cargados nunca se
            muestran junto al partido equivocado. */}
        <MatchContent key={matchId} tournamentId={id} matchId={matchId} />
      </div>
    </AuthGuard>
  );
}
