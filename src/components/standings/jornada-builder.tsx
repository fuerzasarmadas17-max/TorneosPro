"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tournament, Match } from "@/types";
import { useTournaments } from "@/context/tournament-context";
import { getPendingMatchups } from "@/data/helpers";
import { Plus, Trash2, CalendarIcon, Clock, MapPin, X, Check } from "lucide-react";
import { toast } from "sonner";

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
    updateMatchDetails,
  } = useTournaments();

  const [activeJornada, setActiveJornada] = useState(1);
  const [homeSelect, setHomeSelect] = useState("");
  const [awaySelect, setAwaySelect] = useState("");

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
  const jornadas = Array.from(jornadaMap.entries())
    .sort(([a], [b]) => a - b);

  const maxJornada = jornadas.length > 0 ? Math.max(...jornadas.map(([r]) => r)) : 0;

  // Ensure activeJornada is within range
  const currentJornadaMatches = jornadaMap.get(activeJornada) || [];

  // Teams already playing in the current jornada
  const teamsInJornada = new Set<string>();
  for (const m of currentJornadaMatches) {
    if (m.homeTeamId) teamsInJornada.add(m.homeTeamId);
    if (m.awayTeamId) teamsInJornada.add(m.awayTeamId);
  }

  // Pending matchups (not yet in any jornada)
  const pending = getPendingMatchups(scopedTeamIds, scopedMatches);

  // Available teams for selection (not in current jornada)
  const availableForHome = scopedTeamIds.filter((id) => !teamsInJornada.has(id));
  const availableForAway = availableForHome.filter((id) => id !== homeSelect);

  const handleAddMatch = () => {
    if (!homeSelect || !awaySelect) return;

    const maxNum = tournament.matches.length > 0
      ? Math.max(...tournament.matches.map((m) => m.matchNumber))
      : 0;

    const match: Match = {
      id: `${tournament.id}-m-${maxNum + 1}`,
      tournamentId: tournament.id,
      round: activeJornada,
      matchNumber: maxNum + 1,
      homeTeamId: homeSelect,
      awayTeamId: awaySelect,
      homeScore: null,
      awayScore: null,
      winnerId: null,
      status: "unscheduled",
      ...(scopePhase ? { phase: scopePhase } : {}),
      ...(scopeGroupId ? { groupId: scopeGroupId } : {}),
    };

    addMatchToTournament(tournament.id, match);
    setHomeSelect("");
    setAwaySelect("");
  };

  const handleAddPending = (home: string, away: string) => {
    // Check if both teams are available in this jornada
    if (teamsInJornada.has(home) || teamsInJornada.has(away)) {
      // If not available, just set the selectors
      setHomeSelect(home);
      setAwaySelect(away);
      return;
    }

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
    const newRound = maxJornada + 1;
    setActiveJornada(newRound);
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

  // Collect unique venues for autocomplete
  const usedVenues = Array.from(new Set(
    tournament.matches.map((m) => m.venue).filter(Boolean) as string[]
  ));

  const handleSaveJornada = () => {
    if (currentJornadaMatches.length === 0) return;
    toast.success(`Jornada ${activeJornada} guardada`);
    // Auto-advance to next jornada
    const nextRound = maxJornada + 1;
    if (activeJornada === maxJornada) {
      setActiveJornada(nextRound);
    }
  };

  return (
    <div className="space-y-4">
      {/* Jornada tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {jornadas.map(([round]) => (
          <Button
            key={round}
            variant={activeJornada === round ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveJornada(round)}
          >
            Jornada {round}
          </Button>
        ))}
        {/* Show "new jornada" button if no empty jornada active */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNewJornada}
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Nueva Jornada
        </Button>
      </div>

      {/* Active jornada content */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Jornada {activeJornada}</CardTitle>
            <div className="flex items-center gap-2">
              {currentJornadaMatches.length > 0 && (
                <>
                  <Button
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={handleSaveJornada}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Guardar Jornada
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveJornada(activeJornada)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Venue autocomplete datalist */}
          <datalist id={`builder-venues-${tournament.id}`}>
            {usedVenues.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>

          {/* Matches in this jornada */}
          {currentJornadaMatches.length > 0 ? (
            <div className="space-y-3">
              {currentJornadaMatches.map((match) => {
                const home = match.homeTeamId ? getTeamById(match.homeTeamId) : null;
                const away = match.awayTeamId ? getTeamById(match.awayTeamId) : null;
                return (
                  <div
                    key={match.id}
                    className="rounded-lg border overflow-hidden"
                  >
                    {/* Teams row */}
                    <div className="flex items-center justify-between gap-2 p-2.5">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="font-medium text-sm truncate">
                          {home?.name || "TBD"}
                        </span>
                        <span className="text-muted-foreground text-xs">vs</span>
                        <span className="font-medium text-sm truncate">
                          {away?.name || "TBD"}
                        </span>
                      </div>
                      {match.status !== "completed" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => removeMatchFromTournament(tournament.id, match.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    {/* Date, time, venue per match */}
                    <div className="flex items-center gap-2 px-2.5 py-2 bg-muted/30 border-t">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                        <Input
                          type="date"
                          className="h-7 w-32 text-xs"
                          value={match.date || ""}
                          onChange={(e) => updateMatchDetails(tournament.id, match.id, { date: e.target.value || undefined })}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                        <Input
                          type="time"
                          className="h-7 w-36 text-xs"
                          value={match.time || ""}
                          onChange={(e) => updateMatchDetails(tournament.id, match.id, { time: e.target.value || undefined })}
                        />
                      </div>
                      <div className="flex items-center gap-1 flex-1">
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                        <Input
                          type="text"
                          placeholder="Estadio"
                          className="h-7 text-xs"
                          list={`builder-venues-${tournament.id}`}
                          value={match.venue || ""}
                          onChange={(e) => {
                            const capitalized = e.target.value.replace(/\b\w/g, (c) => c.toUpperCase());
                            updateMatchDetails(tournament.id, match.id, { venue: capitalized || undefined });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay partidos en esta jornada
            </p>
          )}

          {/* Add match controls */}
          {availableForHome.length >= 2 && (
            <div className="flex items-center gap-2">
              <Select value={homeSelect} onValueChange={(v) => { setHomeSelect(v); if (v === awaySelect) setAwaySelect(""); }}>
                <SelectTrigger className="flex-1 h-8 text-sm">
                  <SelectValue placeholder="Local" />
                </SelectTrigger>
                <SelectContent>
                  {availableForHome.map((id) => {
                    const team = getTeamById(id);
                    return (
                      <SelectItem key={id} value={id}>
                        {team?.name || id}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <span className="text-sm text-muted-foreground">vs</span>

              <Select value={awaySelect} onValueChange={setAwaySelect}>
                <SelectTrigger className="flex-1 h-8 text-sm">
                  <SelectValue placeholder="Visitante" />
                </SelectTrigger>
                <SelectContent>
                  {availableForAway.map((id) => {
                    const team = getTeamById(id);
                    return (
                      <SelectItem key={id} value={id}>
                        {team?.name || id}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <Button
                size="sm"
                className="h-8 shrink-0"
                disabled={!homeSelect || !awaySelect}
                onClick={handleAddMatch}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {availableForHome.length < 2 && currentJornadaMatches.length > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Todos los equipos ya tienen partido en esta jornada
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pending matchups */}
      {pending.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Enfrentamientos Pendientes</CardTitle>
              <Badge variant="secondary" className="text-xs">{pending.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {pending.map(({ home, away }) => {
                const homeTeam = getTeamById(home);
                const awayTeam = getTeamById(away);
                const canAdd = !teamsInJornada.has(home) && !teamsInJornada.has(away);
                return (
                  <button
                    key={`${home}-${away}`}
                    type="button"
                    onClick={() => handleAddPending(home, away)}
                    className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                      canAdd
                        ? "hover:bg-primary/10 hover:border-primary/30 cursor-pointer"
                        : "opacity-50 cursor-default"
                    }`}
                  >
                    {homeTeam?.name || "?"} vs {awayTeam?.name || "?"}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {pending.length === 0 && scopedMatches.length > 0 && (
        <div className="text-center py-4">
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
            Calendario completo
          </Badge>
        </div>
      )}
    </div>
  );
}
