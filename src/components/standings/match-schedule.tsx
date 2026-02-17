"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tournament, Match, MatchStatus } from "@/types";
import { useTournaments } from "@/context/tournament-context";
import {
  generateEliminationMatches,
  generateRoundRobinMatches,
  generateGroupRoundRobinMatches,
  generateGroupPlayoffMatches,
  generateEmptyEliminationBracket,
  shuffleArray,
  getPendingMatchups,
} from "@/data/helpers";
import { Shuffle, LayoutList, CalendarIcon, Clock, MapPin, AlertTriangle, Filter } from "lucide-react";
import { toast } from "sonner";
import { JornadaBuilder } from "./jornada-builder";

interface MatchScheduleProps {
  tournament: Tournament;
  canEdit: boolean;
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${suffix}`;
}

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function formatDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

const statusLabels: Record<MatchStatus, string> = {
  unscheduled: "Sin Programar",
  scheduled: "Programado",
  postponed: "Aplazado",
  completed: "Completado",
};

export function MatchSchedule({ tournament, canEdit }: MatchScheduleProps) {
  const { getTeamById } = useTournaments();
  const [manualMode, setManualMode] = useState(false);

  const isRoundRobinType = tournament.format === "round-robin" || tournament.format === "group-playoff";

  // --- Empty state ---
  if (tournament.matches.length === 0 && canEdit) {
    // Elimination: bracket options
    if (tournament.format === "elimination") {
      return <EliminationEmptySchedule tournament={tournament} />;
    }
    // Liga / Groups: jornada options
    if (manualMode) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Programar Manualmente</h3>
            <Button variant="ghost" size="sm" onClick={() => setManualMode(false)}>
              Volver
            </Button>
          </div>
          {tournament.format === "group-playoff" && tournament.groups ? (
            <GroupJornadaBuilder tournament={tournament} />
          ) : (
            <JornadaBuilder tournament={tournament} />
          )}
        </div>
      );
    }
    return <RoundRobinEmptySchedule tournament={tournament} onManual={() => setManualMode(true)} />;
  }

  if (tournament.matches.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        El calendario aun no ha sido generado.
      </div>
    );
  }

  // --- Has matches: display schedule + optional JornadaBuilder ---
  // For round-robin types, check if there are pending matchups
  const hasPendingMatchups = isRoundRobinType && canEdit && (() => {
    if (tournament.format === "group-playoff") {
      return (tournament.groups || []).some((g) => {
        const groupMatches = tournament.matches.filter((m) => m.phase === "group" && m.groupId === g.id);
        return getPendingMatchups(g.teamIds, groupMatches, tournament.doubleRoundRobin).length > 0;
      });
    }
    const regularMatches = tournament.matches.filter((m) => !m.phase);
    return getPendingMatchups(tournament.teamIds, regularMatches, tournament.doubleRoundRobin).length > 0;
  })();

  return (
    <div className="space-y-6">
      {/* Match display */}
      <MatchDisplay
        tournament={tournament}
        canEdit={canEdit}
        getTeamById={getTeamById}
      />

      {/* JornadaBuilder for incomplete schedules */}
      {hasPendingMatchups && (
        <div className="space-y-3">
          <div className="border-t pt-4">
            <h3 className="font-semibold text-sm mb-3">Agregar mas partidos</h3>
            {tournament.format === "group-playoff" && tournament.groups ? (
              <GroupJornadaBuilder tournament={tournament} />
            ) : (
              <JornadaBuilder tournament={tournament} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Match display (read-only + result buttons) ---

function MatchDisplay({
  tournament,
  canEdit,
  getTeamById,
}: {
  tournament: Tournament;
  canEdit: boolean;
  getTeamById: (id: string) => import("@/types").Team | undefined;
}) {
  const { updateMatchDetails } = useTournaments();
  const [postponingId, setPostponingId] = useState<string | null>(null);
  const [postponeReason, setPostponeReason] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("all");

  // Collect unique venues already used across the tournament
  const usedVenues = Array.from(new Set(
    tournament.matches.map((m) => m.venue).filter(Boolean) as string[]
  ));

  // Build team list for filter
  const teamOptions = tournament.teamIds
    .map((id) => ({ id, name: getTeamById(id)?.name || id }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Filter out unscheduled matches for public view
  const baseMatches = canEdit
    ? tournament.matches
    : tournament.matches.filter((m) => m.status !== "unscheduled");

  // Apply team filter
  const visibleMatches = teamFilter === "all"
    ? baseMatches
    : baseMatches.filter((m) => m.homeTeamId === teamFilter || m.awayTeamId === teamFilter);

  // Today's date string for comparing postponed matches
  const today = new Date().toISOString().split("T")[0];

  // Separate postponed into "recent" (date not passed yet) vs "past" (date already passed)
  const postponedRecent = visibleMatches.filter(
    (m) => m.status === "postponed" && m.date && m.date >= today
  );
  const postponedPast = visibleMatches.filter(
    (m) => m.status === "postponed" && (!m.date || m.date < today)
  );

  // Active = non-postponed matches
  const activeMatches = visibleMatches.filter((m) => m.status !== "postponed");

  // When team filter is active, use a flat sorted view
  const isFiltered = teamFilter !== "all";

  // --- Filtered view: flat list sorted by status priority + date ---
  const filteredSorted = (() => {
    if (!isFiltered) return [];

    const scheduled = activeMatches
      .filter((m) => m.status === "scheduled" || m.status === "unscheduled")
      .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));

    // Recent postponed (date today or future) mixed with scheduled
    const recentPostponed = [...postponedRecent].sort(
      (a, b) => (a.date || "9999").localeCompare(b.date || "9999")
    );

    const upcoming = [...scheduled, ...recentPostponed].sort(
      (a, b) => (a.date || "9999").localeCompare(b.date || "9999")
    );

    const completed = activeMatches
      .filter((m) => m.status === "completed")
      .sort((a, b) => (b.date || "0000").localeCompare(a.date || "0000"));

    const pastPostponed = [...postponedPast].sort(
      (a, b) => (b.date || "0000").localeCompare(a.date || "0000")
    );

    return [...upcoming, ...completed, ...pastPostponed];
  })();

  // --- Default view: grouped by jornada ---
  const allSections: { label: string; matches: Match[] }[] = [];

  if (!isFiltered) {
    const nonPostponed = activeMatches;
    const groupPhaseMatches = nonPostponed.filter((m) => m.phase === "group");
    const playoffMatches = nonPostponed.filter((m) => m.phase === "playoff");
    const regularMatches = nonPostponed.filter((m) => !m.phase);

    if (regularMatches.length > 0) {
      const rounds = new Map<number, Match[]>();
      for (const m of regularMatches) {
        const arr = rounds.get(m.round) || [];
        arr.push(m);
        rounds.set(m.round, arr);
      }
      for (const [round, matches] of Array.from(rounds.entries()).sort(([a], [b]) => a - b)) {
        allSections.push({ label: `Jornada ${round}`, matches });
      }
    }

    if (groupPhaseMatches.length > 0) {
      const rounds = new Map<number, Match[]>();
      for (const m of groupPhaseMatches) {
        const arr = rounds.get(m.round) || [];
        arr.push(m);
        rounds.set(m.round, arr);
      }
      for (const [round, matches] of Array.from(rounds.entries()).sort(([a], [b]) => a - b)) {
        allSections.push({ label: `Jornada ${round} (Grupos)`, matches });
      }
    }

    if (playoffMatches.length > 0) {
      const rounds = new Map<number, Match[]>();
      for (const m of playoffMatches) {
        const arr = rounds.get(m.round) || [];
        arr.push(m);
        rounds.set(m.round, arr);
      }
      for (const [round, matches] of Array.from(rounds.entries()).sort(([a], [b]) => a - b)) {
        allSections.push({ label: `Playoff - Ronda ${round}`, matches });
      }
    }
  }

  // Postponed matches for the default (non-filtered) view
  const postponedMatches = [...postponedRecent, ...postponedPast];

  const handleStatusChange = (matchId: string, newStatus: MatchStatus) => {
    if (newStatus === "postponed") {
      setPostponingId(matchId);
      setPostponeReason("");
      return;
    }
    // Validate: "scheduled" requires date, time, and venue
    if (newStatus === "scheduled") {
      const match = tournament.matches.find((m) => m.id === matchId);
      if (!match?.date || !match?.time || !match?.venue) {
        toast.error("Debes completar la fecha, hora y estadio para programar el partido");
        return;
      }
    }
    updateMatchDetails(tournament.id, matchId, {
      status: newStatus,
      postponedReason: undefined,
    });
    toast.success(`Estado cambiado a ${statusLabels[newStatus]}`);
  };

  const handlePostponeConfirm = (matchId: string) => {
    if (!postponeReason.trim()) return;
    updateMatchDetails(tournament.id, matchId, {
      status: "postponed",
      postponedReason: postponeReason.trim(),
      date: undefined,
      time: undefined,
    });
    setPostponingId(null);
    setPostponeReason("");
    toast.success("Partido aplazado");
  };

  const renderMatchCard = (match: Match, recoveryLabel?: string) => {
    const home = match.homeTeamId ? getTeamById(match.homeTeamId) : null;
    const away = match.awayTeamId ? getTeamById(match.awayTeamId) : null;
    const isPostponed = match.status === "postponed";
    const isCompleted = match.status === "completed";
    const canEditDetails = canEdit && !isCompleted;
    const hasFullDetails = !!(match.date && match.time && match.venue);

    const groupName = match.groupId
      ? tournament.groups?.find((g) => g.id === match.groupId)?.name || ""
      : "";

    return (
      <div key={match.id} className={`rounded-lg border overflow-hidden ${isPostponed ? "border-amber-500/40" : ""}`}>
        {/* Recovery label */}
        {recoveryLabel && (
          <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-600" />
            <span className="text-xs font-medium text-amber-700">{recoveryLabel}</span>
          </div>
        )}

        {/* Teams + score — stacked on mobile, inline on desktop */}
        <div className="p-3 sm:p-3">
          {/* Mobile: stacked layout */}
          <div className="flex sm:hidden flex-col gap-2">
            {/* Home team */}
            <div className="flex items-center gap-2">
              {home && (home.primaryColor || home.secondaryColor) && (
                <div className="w-6 h-6 rounded border border-border overflow-hidden flex shrink-0">
                  <div className="w-1/2 h-full" style={{ backgroundColor: home.primaryColor || "#fff" }} />
                  <div className="w-1/2 h-full" style={{ backgroundColor: home.secondaryColor || "#000" }} />
                </div>
              )}
              <span className="font-semibold text-base flex-1">{home?.name || "TBD"}</span>
              {isCompleted && (
                <span className="font-bold text-lg tabular-nums">{match.homeScore}</span>
              )}
            </div>
            {/* Away team */}
            <div className="flex items-center gap-2">
              {away && (away.primaryColor || away.secondaryColor) && (
                <div className="w-6 h-6 rounded border border-border overflow-hidden flex shrink-0">
                  <div className="w-1/2 h-full" style={{ backgroundColor: away.primaryColor || "#fff" }} />
                  <div className="w-1/2 h-full" style={{ backgroundColor: away.secondaryColor || "#000" }} />
                </div>
              )}
              <span className="font-semibold text-base flex-1">{away?.name || "TBD"}</span>
              {isCompleted && (
                <span className="font-bold text-lg tabular-nums">{match.awayScore}</span>
              )}
            </div>
            {/* Sets (if any) */}
            {isCompleted && match.sets && match.sets.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Sets: {match.sets.map((s) => `${s.homePoints}-${s.awayPoints}`).join(", ")}
              </p>
            )}
            {/* Badges row */}
            <div className="flex items-center gap-2 mt-1">
              {groupName && (
                <Badge variant="secondary" className="text-xs">
                  {groupName}
                </Badge>
              )}
              {canEdit && !isCompleted ? (
                <Select
                  value={match.status}
                  onValueChange={(value) => handleStatusChange(match.id, value as MatchStatus)}
                >
                  <SelectTrigger className="h-7 w-auto text-xs gap-1 min-w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {match.status === "unscheduled" && (
                      <>
                        <SelectItem value="unscheduled">Sin Programar</SelectItem>
                        <SelectItem value="scheduled" disabled={!hasFullDetails}>
                          Programado{!hasFullDetails ? " (completar datos)" : ""}
                        </SelectItem>
                        <SelectItem value="postponed">Aplazado</SelectItem>
                      </>
                    )}
                    {match.status === "scheduled" && (
                      <>
                        <SelectItem value="scheduled">Programado</SelectItem>
                        <SelectItem value="unscheduled">Sin Programar</SelectItem>
                        <SelectItem value="postponed">Aplazado</SelectItem>
                      </>
                    )}
                    {match.status === "postponed" && (
                      <>
                        <SelectItem value="postponed">Aplazado</SelectItem>
                        <SelectItem value="scheduled">Programado</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Badge
                  variant="outline"
                  className={`text-xs ${isPostponed ? "bg-amber-500/10 text-amber-700 border-amber-500/30" : ""}`}
                >
                  {statusLabels[match.status]}
                </Badge>
              )}
              {canEdit && match.status === "scheduled" && match.homeTeamId && match.awayTeamId && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/tournaments/${tournament.id}/matches/${match.id}`}>
                    Resultado
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Desktop: horizontal layout */}
          <div className="hidden sm:flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-1.5 truncate">
                {home && (home.primaryColor || home.secondaryColor) && (
                  <div className="w-5 h-5 rounded border border-border overflow-hidden flex shrink-0">
                    <div className="w-1/2 h-full" style={{ backgroundColor: home.primaryColor || "#fff" }} />
                    <div className="w-1/2 h-full" style={{ backgroundColor: home.secondaryColor || "#000" }} />
                  </div>
                )}
                <span className="font-medium truncate">{home?.name || "TBD"}</span>
              </div>

              {isCompleted ? (
                <div className="text-center">
                  <span className="font-bold tabular-nums whitespace-nowrap">
                    {match.homeScore} - {match.awayScore}
                  </span>
                  {match.sets && match.sets.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {match.sets.map((s) => `${s.homePoints}-${s.awayPoints}`).join(", ")}
                    </p>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground text-sm">vs</span>
              )}

              <div className="flex items-center gap-1.5 truncate">
                <span className="font-medium truncate">{away?.name || "TBD"}</span>
                {away && (away.primaryColor || away.secondaryColor) && (
                  <div className="w-5 h-5 rounded border border-border overflow-hidden flex shrink-0">
                    <div className="w-1/2 h-full" style={{ backgroundColor: away.primaryColor || "#fff" }} />
                    <div className="w-1/2 h-full" style={{ backgroundColor: away.secondaryColor || "#000" }} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {groupName && (
                <Badge variant="secondary" className="text-xs">
                  {groupName}
                </Badge>
              )}
              {canEdit && !isCompleted ? (
                <Select
                  value={match.status}
                  onValueChange={(value) => handleStatusChange(match.id, value as MatchStatus)}
                >
                  <SelectTrigger className="h-7 w-auto text-xs gap-1 min-w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {match.status === "unscheduled" && (
                      <>
                        <SelectItem value="unscheduled">Sin Programar</SelectItem>
                        <SelectItem value="scheduled" disabled={!hasFullDetails}>
                          Programado{!hasFullDetails ? " (completar datos)" : ""}
                        </SelectItem>
                        <SelectItem value="postponed">Aplazado</SelectItem>
                      </>
                    )}
                    {match.status === "scheduled" && (
                      <>
                        <SelectItem value="scheduled">Programado</SelectItem>
                        <SelectItem value="unscheduled">Sin Programar</SelectItem>
                        <SelectItem value="postponed">Aplazado</SelectItem>
                      </>
                    )}
                    {match.status === "postponed" && (
                      <>
                        <SelectItem value="postponed">Aplazado</SelectItem>
                        <SelectItem value="scheduled">Programado</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Badge
                  variant="outline"
                  className={`text-xs ${isPostponed ? "bg-amber-500/10 text-amber-700 border-amber-500/30" : ""}`}
                >
                  {statusLabels[match.status]}
                </Badge>
              )}
              {canEdit && match.status === "scheduled" && match.homeTeamId && match.awayTeamId && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/tournaments/${tournament.id}/matches/${match.id}`}>
                    Resultado
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Postpone reason input (inline) */}
        {postponingId === match.id && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/5 border-t border-amber-500/20">
            <Input
              type="text"
              placeholder="Razon del aplazamiento..."
              className="h-7 text-xs flex-1"
              value={postponeReason}
              onChange={(e) => setPostponeReason(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handlePostponeConfirm(match.id); }}
              autoFocus
            />
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={!postponeReason.trim()}
              onClick={() => handlePostponeConfirm(match.id)}
            >
              Aplazar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setPostponingId(null)}
            >
              Cancelar
            </Button>
          </div>
        )}

        {/* Postpone reason display */}
        {isPostponed && match.postponedReason && postponingId !== match.id && (
          <div className="px-3 py-2 bg-amber-500/5 border-t border-amber-500/20 text-xs text-amber-700">
            Motivo: {match.postponedReason}
          </div>
        )}

        {/* Match details row: date, time, venue */}
        {canEditDetails && !isPostponed && match.status === "unscheduled" ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-3 py-2.5 bg-muted/30 border-t">
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4 sm:h-3 sm:w-3 text-muted-foreground shrink-0" />
              <Input
                type="date"
                className="h-8 sm:h-7 text-sm sm:text-xs flex-1"
                value={match.date || ""}
                onChange={(e) => updateMatchDetails(tournament.id, match.id, { date: e.target.value || undefined })}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 sm:h-3 sm:w-3 text-muted-foreground shrink-0" />
              <Input
                type="time"
                className="h-8 sm:h-7 text-sm sm:text-xs flex-1"
                value={match.time || ""}
                onChange={(e) => updateMatchDetails(tournament.id, match.id, { time: e.target.value || undefined })}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 sm:h-3 sm:w-3 text-muted-foreground shrink-0" />
              <Input
                type="text"
                placeholder="Estadio"
                className="h-8 sm:h-7 text-sm sm:text-xs flex-1"
                list={`venues-${tournament.id}`}
                value={match.venue || ""}
                onChange={(e) => {
                  const capitalized = e.target.value.replace(/\b\w/g, (c) => c.toUpperCase());
                  updateMatchDetails(tournament.id, match.id, { venue: capitalized || undefined });
                }}
              />
            </div>
          </div>
        ) : (match.date || match.time || match.venue) ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 bg-muted/30 border-t text-sm sm:text-xs text-muted-foreground">
            {match.date && (
              <span className="flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4 sm:h-3 sm:w-3" />
                {formatDateShort(match.date)}
              </span>
            )}
            {match.time && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 sm:h-3 sm:w-3" />
                {formatTime12h(match.time)}
              </span>
            )}
            {match.venue && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 sm:h-3 sm:w-3" />
                {match.venue}
              </span>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <>
      {/* Venue autocomplete datalist (shared across all match cards) */}
      <datalist id={`venues-${tournament.id}`}>
        {usedVenues.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>

      {/* Team filter */}
      {teamOptions.length > 0 && (
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="h-9 w-full sm:w-64">
              <SelectValue placeholder="Filtrar por equipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los equipos</SelectItem>
              {teamOptions.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* No results message */}
      {teamFilter !== "all" && visibleMatches.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No hay partidos para este equipo
        </div>
      )}

      {/* === Filtered view: flat sorted list === */}
      {isFiltered && filteredSorted.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Partidos de {teamOptions.find((t) => t.id === teamFilter)?.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredSorted.map((match) => {
              const label = match.status === "postponed"
                ? match.date && match.date < today
                  ? `Aplazado - Jornada ${match.round}`
                  : undefined
                : undefined;
              return renderMatchCard(match, label);
            })}
          </CardContent>
        </Card>
      )}

      {/* === Default view: grouped by jornada === */}
      {!isFiltered && (
        <>
          {/* Postponed matches section (top) */}
          {postponedMatches.length > 0 && (
            <Card className="border-amber-500/30">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <CardTitle className="text-base">Partidos Aplazados</CardTitle>
                  <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-xs">
                    {postponedMatches.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {postponedMatches.map((match) => {
                  const jornadaLabel = match.phase === "group"
                    ? `Recuperacion Jornada ${match.round} (${tournament.groups?.find((g) => g.id === match.groupId)?.name || ""})`
                    : match.phase === "playoff"
                      ? `Recuperacion Playoff Ronda ${match.round}`
                      : `Recuperacion Jornada ${match.round}`;
                  return renderMatchCard(match, jornadaLabel);
                })}
              </CardContent>
            </Card>
          )}

          {/* Regular jornada sections */}
          {allSections
            .filter((section) => section.matches.length > 0)
            .map((section) => (
            <Card key={section.label}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{section.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {section.matches.map((match) => renderMatchCard(match))}
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </>
  );
}

// --- Empty state for Elimination ---

function EliminationEmptySchedule({ tournament }: { tournament: Tournament }) {
  const { setTournamentMatches } = useTournaments();

  const handleRandom = () => {
    const shuffledTeams = shuffleArray(tournament.teamIds);
    const matches = generateEliminationMatches(shuffledTeams, tournament.id);
    setTournamentMatches(tournament.id, matches);
    toast.success("Bracket generado aleatoriamente");
  };

  const handleManual = () => {
    const matches = generateEmptyEliminationBracket(tournament.teamIds.length, tournament.id);
    setTournamentMatches(tournament.id, matches);
    toast.success("Bracket creado. Asigna los equipos en la vista de bracket.");
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6">
      <div className="text-center space-y-2">
        <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/50" />
        <h3 className="text-lg font-semibold">Bracket Vacio</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Genera el bracket de eliminacion para este torneo
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={handleRandom} className="gap-2">
          <Shuffle className="h-4 w-4" />
          Aleatorio
        </Button>
        <Button variant="outline" onClick={handleManual} className="gap-2">
          <LayoutList className="h-4 w-4" />
          Asignar Equipos
        </Button>
      </div>
    </div>
  );
}

// --- Empty state for Round-Robin / Group-Playoff ---

function RoundRobinEmptySchedule({
  tournament,
  onManual,
}: {
  tournament: Tournament;
  onManual: () => void;
}) {
  const { setTournamentMatches, updateTournamentProps } = useTournaments();
  const [showIdaVueltaDialog, setShowIdaVueltaDialog] = useState(false);

  // Compute team count for jornada display
  const teamCount = tournament.format === "group-playoff" || (tournament.format === "round-robin" && tournament.groups && tournament.groups.length > 0)
    ? Math.max(...(tournament.groups || []).map((g) => g.teamIds.length), 2)
    : tournament.teamIds.length;

  const jornadasIda = teamCount % 2 === 0 ? teamCount - 1 : teamCount;
  const jornadasIdaVuelta = jornadasIda * 2;

  const handleGenerate = (doubleRoundRobin: boolean) => {
    setShowIdaVueltaDialog(false);
    const shuffledTeams = shuffleArray(tournament.teamIds);
    let matches: Match[];

    switch (tournament.format) {
      case "round-robin":
        if (tournament.groups && tournament.groups.length > 0) {
          const shuffledGroups = tournament.groups.map((g) => ({
            ...g,
            teamIds: shuffleArray(g.teamIds),
          }));
          matches = generateGroupRoundRobinMatches(shuffledGroups, tournament.id, doubleRoundRobin);
        } else {
          matches = generateRoundRobinMatches(shuffledTeams, tournament.id, doubleRoundRobin);
        }
        break;
      case "group-playoff":
        if (tournament.groups && tournament.playoffConfig) {
          const shuffledGroups = tournament.groups.map((g) => ({
            ...g,
            teamIds: shuffleArray(g.teamIds),
          }));
          matches = generateGroupPlayoffMatches(shuffledGroups, tournament.playoffConfig, tournament.id, doubleRoundRobin);
        } else {
          matches = [];
        }
        break;
      default:
        matches = [];
    }

    // Assign dates by round
    matches = assignDatesToMatches(matches, tournament.startDate);
    setTournamentMatches(tournament.id, matches);
    updateTournamentProps(tournament.id, { doubleRoundRobin });
    toast.success("Calendario generado aleatoriamente");
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6">
      <div className="text-center space-y-2">
        <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/50" />
        <h3 className="text-lg font-semibold">Calendario Vacio</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Programa los partidos jornada por jornada
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={() => setShowIdaVueltaDialog(true)} className="gap-2">
          <Shuffle className="h-4 w-4" />
          Generar Aleatorio
        </Button>
        <Button variant="outline" onClick={onManual} className="gap-2">
          <LayoutList className="h-4 w-4" />
          Programar Manualmente
        </Button>
      </div>

      <Dialog open={showIdaVueltaDialog} onOpenChange={setShowIdaVueltaDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Tipo de Calendario</DialogTitle>
            <DialogDescription>
              Selecciona el formato de enfrentamientos
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              onClick={() => handleGenerate(false)}
              className="justify-start h-auto py-3"
            >
              <div className="text-left">
                <div className="font-medium">Ida</div>
                <div className="text-xs text-muted-foreground font-normal">
                  Cada equipo se enfrenta una vez ({jornadasIda} jornadas)
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              onClick={() => handleGenerate(true)}
              className="justify-start h-auto py-3"
            >
              <div className="text-left">
                <div className="font-medium">Ida y Vuelta</div>
                <div className="text-xs text-muted-foreground font-normal">
                  Cada equipo se enfrenta dos veces ({jornadasIdaVuelta} jornadas)
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Group jornada builder (renders one JornadaBuilder per group) ---

function GroupJornadaBuilder({ tournament }: { tournament: Tournament }) {
  const groups = tournament.groups || [];

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.id} className="space-y-2">
          <h4 className="font-medium text-sm">{group.name}</h4>
          <JornadaBuilder
            tournament={tournament}
            scopeGroupId={group.id}
            scopePhase="group"
          />
        </div>
      ))}
    </div>
  );
}

// --- Date assignment helper ---

function assignDatesToMatches(matches: Match[], startDate: string): Match[] {
  const roundKeys = new Set<string>();
  for (const m of matches) {
    roundKeys.add(`${m.phase || "regular"}-${m.round}`);
  }
  const phaseOrder: Record<string, number> = { group: 0, regular: 1, playoff: 2 };
  const sorted = Array.from(roundKeys).sort((a, b) => {
    const [phaseA, roundA] = a.split("-");
    const [phaseB, roundB] = b.split("-");
    const po = (phaseOrder[phaseA] ?? 1) - (phaseOrder[phaseB] ?? 1);
    if (po !== 0) return po;
    return parseInt(roundA) - parseInt(roundB);
  });

  const dateMap = new Map<string, string>();
  const base = new Date(startDate + "T12:00:00");
  sorted.forEach((key, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + i * 7);
    dateMap.set(key, d.toISOString().split("T")[0]);
  });

  return matches.map((m) => ({
    ...m,
    date: dateMap.get(`${m.phase || "regular"}-${m.round}`) || m.date,
  }));
}
