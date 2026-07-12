"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tournament, Match } from "@/types";
import { useTournaments } from "@/context/tournament-context";
import { getPendingMatchups } from "@/data/helpers";
import { Plus, Trash2, X } from "lucide-react";

interface JornadaBuilderProps {
  tournament: Tournament;
  // For group-playoff, scope to group phase
  scopeGroupId?: string;
  scopePhase?: "group" | "playoff";
}

export function JornadaBuilder({ tournament, scopeGroupId, scopePhase }: JornadaBuilderProps) {
  const {
    getTeamById,
    addMatchToTournament,
    removeMatchFromTournament,
  } = useTournaments();

  const [activeJornada, setActiveJornada] = useState(1);

  // Scope matches and teams based on group context
  const scopedMatches = tournament.matches.filter((m) => {
    if (scopePhase && m.phase !== scopePhase) return false;
    if (scopeGroupId && m.groupId !== scopeGroupId) return false;
    if (!scopePhase && !scopeGroupId && m.phase) return false; // exclude group/playoff matches from flat liga
    return true;
  });

  const scopedTeamIds = scopeGroupId
    ? (tournament.groups?.find((g) => g.id === scopeGroupId)?.teamIds || [])
    : tournament.teamIds;

  // Get jornadas from existing matches
  const jornadaMap = new Map<number, Match[]>();
  for (const m of scopedMatches) {
    const arr = jornadaMap.get(m.round) || [];
    arr.push(m);
    jornadaMap.set(m.round, arr);
  }
  const jornadas = Array.from(jornadaMap.entries()).sort(([a], [b]) => a - b);

  const maxJornada = jornadas.length > 0 ? Math.max(...jornadas.map(([r]) => r)) : 0;

  const currentJornadaMatches = jornadaMap.get(activeJornada) || [];

  // Una jornada recién creada todavía no tiene partidos, así que no figura en
  // `jornadas`. Igual necesita su pestaña para que el organizador vea dónde está parado.
  const roundsWithMatches = jornadas.map(([r]) => r);
  const tabRounds = roundsWithMatches.includes(activeJornada)
    ? roundsWithMatches
    : [...roundsWithMatches, activeJornada].sort((a, b) => a - b);

  // Teams already playing in the current jornada
  const teamsInJornada = new Set<string>();
  for (const m of currentJornadaMatches) {
    if (m.homeTeamId) teamsInJornada.add(m.homeTeamId);
    if (m.awayTeamId) teamsInJornada.add(m.awayTeamId);
  }

  // Pending matchups (not yet in any jornada)
  const pending = getPendingMatchups(scopedTeamIds, scopedMatches, tournament.doubleRoundRobin);

  const handleAddPending = (home: string, away: string) => {
    const maxNum = tournament.matches.length > 0
      ? Math.max(...tournament.matches.map((m) => m.matchNumber))
      : 0;

    const match: Match = {
      id: `${tournament.id}-m-${maxNum + 1}`,
      tournamentId: tournament.id,
      round: activeJornada,
      matchNumber: maxNum + 1,
      homeTeamId: home,
      awayTeamId: away,
      homeScore: null,
      awayScore: null,
      winnerId: null,
      status: "unscheduled",
      ...(scopePhase ? { phase: scopePhase } : {}),
      ...(scopeGroupId ? { groupId: scopeGroupId } : {}),
    };

    addMatchToTournament(tournament.id, match);
  };

  const handleNewJornada = () => {
    setActiveJornada(maxJornada + 1);
  };

  const handleRemoveJornada = (round: number) => {
    const matchesInRound = jornadaMap.get(round) || [];
    for (const m of matchesInRound) {
      removeMatchFromTournament(tournament.id, m.id);
    }
    if (activeJornada === round) {
      setActiveJornada(Math.max(1, round - 1));
    }
  };

  return (
    <div className="space-y-4">
      {/* Jornada tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {tabRounds.map((round) => {
          const count = jornadaMap.get(round)?.length || 0;
          const isActive = activeJornada === round;
          return (
            <Button
              key={round}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveJornada(round)}
              className="gap-1.5"
            >
              Jornada {round}
              {count > 0 && (
                <span
                  className={`text-[10px] rounded-full px-1.5 py-0.5 leading-none ${
                    isActive ? "bg-primary-foreground/20" : "bg-muted"
                  }`}
                >
                  {count}
                </span>
              )}
            </Button>
          );
        })}
        <Button variant="ghost" size="sm" onClick={handleNewJornada} className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          Nueva Jornada
        </Button>
      </div>

      {/* Cruces pendientes — la acción principal: un clic y entran a la jornada */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Elegí los cruces
            </h4>
            <Badge variant="secondary" className="text-xs">{pending.length}</Badge>
          </div>

          <div className="grid gap-1.5 sm:grid-cols-2">
            {pending.map(({ home, away }, i) => {
              const homeTeam = getTeamById(home);
              const awayTeam = getTeamById(away);
              // Un equipo no puede jugar dos veces en la misma jornada.
              const canAdd = !teamsInJornada.has(home) && !teamsInJornada.has(away);
              return (
                <button
                  // El índice hace falta: en ida y vuelta el mismo par aparece
                  // dos veces en `pending` y la key se duplicaría.
                  key={`${home}-${away}-${i}`}
                  type="button"
                  disabled={!canAdd}
                  onClick={() => handleAddPending(home, away)}
                  title={
                    canAdd
                      ? `Agregar a la Jornada ${activeJornada}`
                      : "Alguno de los dos equipos ya juega en esta jornada"
                  }
                  className={`group flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-left transition-colors ${
                    canAdd
                      ? "hover:bg-primary/5 hover:border-primary/40 cursor-pointer"
                      : "opacity-40 cursor-not-allowed"
                  }`}
                >
                  <span className="truncate font-medium">{homeTeam?.name || "?"}</span>
                  <span className="text-xs text-muted-foreground shrink-0">vs</span>
                  <span className="truncate font-medium">{awayTeam?.name || "?"}</span>
                  {canAdd && (
                    <Plus className="h-3.5 w-3.5 ml-auto shrink-0 text-muted-foreground group-hover:text-primary" />
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground">
            Un clic y el cruce entra a la Jornada {activeJornada}.
          </p>
        </div>
      )}

      {/* Lo que llevás armado en la jornada activa */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">En la Jornada {activeJornada}</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {currentJornadaMatches.length}{" "}
                {currentJornadaMatches.length === 1 ? "partido" : "partidos"}
              </span>
              {currentJornadaMatches.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  title="Vaciar esta jornada"
                  onClick={() => handleRemoveJornada(activeJornada)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {currentJornadaMatches.length > 0 ? (
            <div className="divide-y">
              {currentJornadaMatches.map((match) => {
                const home = match.homeTeamId ? getTeamById(match.homeTeamId) : null;
                const away = match.awayTeamId ? getTeamById(match.awayTeamId) : null;
                return (
                  <div key={match.id} className="flex items-center gap-2 py-2 text-sm">
                    <span className="truncate font-medium">{home?.name || "TBD"}</span>
                    <span className="text-xs text-muted-foreground">vs</span>
                    <span className="truncate font-medium">{away?.name || "TBD"}</span>
                    {match.status !== "completed" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 ml-auto shrink-0 text-muted-foreground hover:text-destructive"
                        title="Quitar de la jornada"
                        onClick={() => removeMatchFromTournament(tournament.id, match.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              {pending.length > 0
                ? "Todavía no agregaste partidos. Elegí un cruce de arriba."
                : "No hay partidos en esta jornada."}
            </p>
          )}
        </CardContent>
      </Card>

      {pending.length === 0 && scopedMatches.length > 0 && (
        <div className="text-center py-2">
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
            Calendario completo
          </Badge>
        </div>
      )}

      {/* Las fechas/horarios son responsabilidad del tab Fechas (DateOrganizer).
          Tenerlos también acá duplicaba la UI y hacía que cada partido ocupara
          dos filas de inputs. */}
      {scopedMatches.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Las fechas y horarios se asignan en la pestaña{" "}
          <span className="font-medium text-foreground">Fechas</span>.
        </p>
      )}
    </div>
  );
}
