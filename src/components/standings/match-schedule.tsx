"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { TeamMark } from "@/components/teams/team-mark";
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
import { Tournament, Match, MatchStatus, getSportCategory } from "@/types";
import { MatchEventsDialog } from "@/components/standings/match-events-dialog";
import { useTournaments } from "@/context/tournament-context";
import {
  generateEliminationMatches,
  generateRoundRobinMatches,
  generateGroupRoundRobinMatches,
  generateGroupPlayoffMatches,
  generateMultiPhaseMatches,
  generateEmptyEliminationBracket,
  shuffleArray,
} from "@/data/helpers";
import { Shuffle, LayoutList, CalendarIcon, Clock, MapPin, AlertTriangle, Filter } from "lucide-react";
import { toast } from "sonner";

interface MatchScheduleProps {
  tournament: Tournament;
  canEdit: boolean;
  /** True if a user is logged in. The round/jornada badge ("J1", "R2", "Extra")
   *  is meaningful for organizers and registered followers but not for
   *  anonymous public viewers — hide it when this is false. */
  isAuthenticated?: boolean;
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

const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS_FULL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function formatDateFull(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dayName = DAYS[date.getDay()];
  const cap = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  return `${cap} ${d} de ${MONTHS_FULL[m - 1]}`;
}

const statusLabels: Record<MatchStatus, string> = {
  unscheduled: "Sin Programar",
  scheduled: "Programado",
  postponed: "Aplazado",
  completed: "Completado",
};

export function MatchSchedule({ tournament, canEdit, isAuthenticated = false }: MatchScheduleProps) {
  const { getTeamById } = useTournaments();

  // --- Empty state ---
  if (tournament.matches.length === 0 && canEdit) {
    // Elimination: bracket options
    if (tournament.format === "elimination") {
      return <EliminationEmptySchedule tournament={tournament} />;
    }
    // Liga / Groups: jornada options
    return <RoundRobinEmptySchedule tournament={tournament} />;
  }

  if (tournament.matches.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        El calendario aun no ha sido generado.
      </div>
    );
  }

  // El tab Calendario muestra exclusivamente partidos ya programados /
  // completos / aplazados. Los cruces de grupos y ligas se generan solo de
  // forma automática ("Generar Aleatorio" / "Generar fixture"); ya no hay
  // armado manual de enfrentamientos.

  return (
    <div className="space-y-6">
      <MatchDisplay
        tournament={tournament}
        canEdit={canEdit}
        isAuthenticated={isAuthenticated}
        getTeamById={getTeamById}
      />
    </div>
  );
}

// --- Match display (read-only + result buttons) ---

function MatchDisplay({
  tournament,
  canEdit,
  isAuthenticated,
  getTeamById,
}: {
  tournament: Tournament;
  canEdit: boolean;
  isAuthenticated: boolean;
  getTeamById: (id: string) => import("@/types").Team | undefined;
}) {
  const { updateMatchDetails } = useTournaments();
  const [postponingId, setPostponingId] = useState<string | null>(null);
  const [postponeReason, setPostponeReason] = useState("");
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleVenue, setRescheduleVenue] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [statusTab, setStatusTab] = useState<"upcoming" | "completed" | "postponed">("upcoming");

  // Detalle de estadísticas del partido para quien NO puede editar: el
  // organizador ya llega a lo mismo (y más) por "Editar resultado". Limitado a
  // fútbol y vóley porque son los únicos donde el evento por jugador se lee
  // solo — béisbol y básquet necesitan la tabla completa de la pestaña
  // Estadísticas para significar algo.
  const eventsSportCategory = getSportCategory(tournament.sport);
  const supportsEventsDialog =
    eventsSportCategory === "futbol" || eventsSportCategory === "volleyball";
  const showEventsDialog = (match: Match) =>
    !canEdit &&
    supportsEventsDialog &&
    match.status === "completed" &&
    !!match.homeTeamId &&
    !!match.awayTeamId;

  // Collect unique venues already used across the tournament
  const usedVenues = Array.from(new Set(
    tournament.matches.map((m) => m.venue).filter(Boolean) as string[]
  ));

  // Build team list for filter
  const teamOptions = tournament.teamIds
    .map((id) => ({ id, name: getTeamById(id)?.name || id }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Only show scheduled/completed/postponed matches (unscheduled go to Fechas tab)
  const baseMatches = tournament.matches.filter((m) => m.status !== "unscheduled");

  // Apply team filter
  const visibleMatches = teamFilter === "all"
    ? baseMatches
    : baseMatches.filter((m) => m.homeTeamId === teamFilter || m.awayTeamId === teamFilter);

  // Status counts (after team filter)
  const upcomingCount = visibleMatches.filter(
    (m) => m.status === "scheduled"
  ).length;
  const completedCount = visibleMatches.filter(
    (m) => m.status === "completed"
  ).length;
  const postponedCount = visibleMatches.filter(
    (m) => m.status === "postponed"
  ).length;

  // Apply status tab filter
  const tabMatches = visibleMatches.filter((m) => {
    if (statusTab === "upcoming") return m.status === "scheduled";
    if (statusTab === "completed") return m.status === "completed";
    if (statusTab === "postponed") return m.status === "postponed";
    return true;
  });

  // When team filter is active, use a flat sorted view
  const isFiltered = teamFilter !== "all";

  // --- Filtered view: flat list sorted by date ---
  const filteredSorted = (() => {
    if (!isFiltered) return [];
    if (statusTab === "completed") {
      return [...tabMatches].sort((a, b) => (b.date || "0000").localeCompare(a.date || "0000"));
    }
    return [...tabMatches].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  })();

  // --- Default view: grouped by date ---
  const allSections: { label: string; matches: Match[] }[] = [];

  if (!isFiltered) {
    const dateGroups = new Map<string, Match[]>();
    const sortAsc = statusTab !== "completed";

    for (const m of tabMatches) {
      const key = m.date || "__nodate__";
      const arr = dateGroups.get(key) || [];
      arr.push(m);
      dateGroups.set(key, arr);
    }

    const sortedKeys = Array.from(dateGroups.keys()).sort((a, b) => {
      if (a === "__nodate__") return 1;
      if (b === "__nodate__") return -1;
      return sortAsc ? a.localeCompare(b) : b.localeCompare(a);
    });

    for (const key of sortedKeys) {
      const matches = dateGroups.get(key)!;
      // Sort matches by time within each date
      matches.sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
      const label = key === "__nodate__"
        ? "Sin fecha asignada"
        : formatDateFull(key);
      allSections.push({ label, matches });
    }
  }

  // Empty state messages per tab
  const emptyMessage = statusTab === "upcoming"
    ? "No hay partidos pendientes"
    : statusTab === "completed"
      ? "No hay partidos completados aun"
      : "No hay partidos aplazados";

  const handleStatusChange = (matchId: string, newStatus: MatchStatus | "reschedule") => {
    if (newStatus === "postponed") {
      setPostponingId(matchId);
      setPostponeReason("");
      return;
    }
    if (newStatus === "reschedule") {
      handleRescheduleStart(matchId);
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
    if (newStatus === "unscheduled") {
      toast.success("Partido enviado a Fechas para reprogramar");
    } else {
      toast.success(`Estado cambiado a ${statusLabels[newStatus]}`);
    }
  };

  const handleRescheduleStart = (matchId: string) => {
    const match = tournament.matches.find((m) => m.id === matchId);
    setReschedulingId(matchId);
    setRescheduleDate(match?.date || "");
    setRescheduleTime(match?.time || "");
    setRescheduleVenue(match?.venue || "");
  };

  const handleRescheduleConfirm = (matchId: string) => {
    if (!rescheduleDate || !rescheduleTime || !rescheduleVenue.trim()) {
      toast.error("Completa fecha, hora y cancha para reprogramar");
      return;
    }
    updateMatchDetails(tournament.id, matchId, {
      status: "scheduled",
      date: rescheduleDate,
      time: rescheduleTime,
      venue: rescheduleVenue.trim(),
      postponedReason: undefined,
    });
    setReschedulingId(null);
    toast.success("Partido reprogramado");
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
    const groupName = match.groupId
      ? tournament.groups?.find((g) => g.id === match.groupId)?.name || ""
      : "";
    const roundLabel = match.phase === "playoff"
      ? `Ronda ${match.round}`
      : match.round === 0
        ? "Extra"
        : `J${match.round}`;

    return (
      <div key={match.id} className={`rounded-lg border overflow-hidden ${isPostponed ? "border-amber-500/40" : ""}`}>
        {/* Recovery label */}
        {recoveryLabel && (
          <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-600" />
            <span className="text-xs font-medium text-amber-700">{recoveryLabel}</span>
          </div>
        )}

        {/* Card header — round + group badges on the left, status
            dropdown/badge anchored to the right corner. Decoupling status
            from the bottom row keeps "Cargar resultado" prominent on its
            own line and avoids the dropdown crowding it on narrow screens. */}
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b bg-muted/30">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {/* Round/jornada badge: hidden for anonymous public viewers
                (organizers + registered followers still see it). */}
            {isAuthenticated && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                {roundLabel}
              </Badge>
            )}
            {groupName && (
              <Badge variant="secondary" className="text-xs">
                {groupName}
              </Badge>
            )}
            {/* W: el marcador solo no lo delata (un 3-0 es un resultado
                normal), así que el tag sale del flag guardado en el partido. */}
            {match.walkover && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-amber-500/40 bg-amber-500/10 text-amber-700"
                title="Ganado por W: un equipo no se presentó"
              >
                W
              </Badge>
            )}
          </div>
          <div className="shrink-0">
            {canEdit && !isCompleted ? (
              <Select
                value={match.status}
                onValueChange={(value) => handleStatusChange(match.id, value as MatchStatus)}
              >
                <SelectTrigger className="h-7 w-auto text-xs gap-1 min-w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
                      <SelectItem value="reschedule">Reprogramar</SelectItem>
                      <SelectItem value="unscheduled">Enviar a Fechas</SelectItem>
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
          </div>
        </div>

        {/* Teams + score — stacked on mobile, inline on desktop */}
        <div className="p-3 sm:p-3">
          {/* Mobile: stacked layout */}
          <div className="flex sm:hidden flex-col gap-2">
            {/* Home team */}
            <div className="flex items-center gap-2">
              <TeamMark team={home} size={32} />
              <span className="font-semibold text-base flex-1">{home?.name || "TBD"}</span>
              {isCompleted && (
                <span className="font-bold text-lg tabular-nums">{match.homeScore}</span>
              )}
            </div>
            {/* Away team */}
            <div className="flex items-center gap-2">
              <TeamMark team={away} size={32} />
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
            {/* Action row — round/group/status moved up to the card header,
                so this row only holds the score CTA. Mostramos el botón
                tanto para partidos `scheduled` (carga inicial) como
                `completed` (edición correctiva). El form precarga los
                valores y recalcula stats/posiciones al guardar. */}
            {canEdit && (match.status === "scheduled" || match.status === "completed") && match.homeTeamId && match.awayTeamId && (
              <div className="flex justify-end mt-1">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/tournaments/${tournament.id}/matches/${match.id}`}>
                    {match.status === "completed" ? "Editar resultado" : "Cargar resultado"}
                  </Link>
                </Button>
              </div>
            )}
            {showEventsDialog(match) && (
              <div className="flex justify-end mt-1">
                <MatchEventsDialog match={match} tournament={tournament} />
              </div>
            )}
          </div>

          {/* Desktop: horizontal layout */}
          <div className="hidden sm:flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-1.5 truncate">
                <TeamMark team={home} size={28} />
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
                <TeamMark team={away} size={28} />
              </div>
            </div>

            {/* Right-side action: score CTA. Misma condición que mobile:
                mostramos para scheduled (carga) y completed (edición). */}
            {canEdit && (match.status === "scheduled" || match.status === "completed") && match.homeTeamId && match.awayTeamId && (
              <div className="shrink-0">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/tournaments/${tournament.id}/matches/${match.id}`}>
                    {match.status === "completed" ? "Editar resultado" : "Cargar resultado"}
                  </Link>
                </Button>
              </div>
            )}
            {showEventsDialog(match) && (
              <div className="shrink-0">
                <MatchEventsDialog match={match} tournament={tournament} />
              </div>
            )}
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

        {/* Reschedule inline inputs */}
        {reschedulingId === match.id && (
          <div className="px-3 py-2 bg-blue-500/5 border-t border-blue-500/20 space-y-2">
            <p className="text-xs font-medium text-blue-700">Reprogramar partido</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                className="h-7 text-xs w-auto"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
              <Input
                type="time"
                className="h-7 text-xs w-auto"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
              />
              <Input
                type="text"
                placeholder="Cancha / Estadio"
                className="h-7 text-xs flex-1 min-w-[120px]"
                value={rescheduleVenue}
                onChange={(e) => setRescheduleVenue(e.target.value)}
                list={`venues-${tournament.id}`}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={!rescheduleDate || !rescheduleTime || !rescheduleVenue.trim()}
                onClick={() => handleRescheduleConfirm(match.id)}
              >
                Confirmar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setReschedulingId(null)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Postpone reason display */}
        {isPostponed && match.postponedReason && postponingId !== match.id && reschedulingId !== match.id && (
          <div className="px-3 py-2 bg-amber-500/5 border-t border-amber-500/20 text-xs text-amber-700">
            Motivo: {match.postponedReason}
          </div>
        )}

        {/* Match details row: time, venue (read-only) */}
        {(match.time || match.venue) ? (
          <div className="flex items-center gap-x-4 px-3 py-2 bg-muted/30 border-t">
            {match.time && (
              <span className="flex items-center gap-1.5 text-sm font-medium shrink-0">
                <Clock className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                {formatTime12h(match.time)}
              </span>
            )}
            {match.venue && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground truncate min-w-0">
                <MapPin className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0" />
                <span className="truncate">{match.venue}</span>
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

      {/* Status tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${statusTab === "upcoming" ? "bg-background shadow font-medium" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setStatusTab("upcoming")}
        >
          Por jugar{upcomingCount > 0 ? ` (${upcomingCount})` : ""}
        </button>
        <button
          className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${statusTab === "completed" ? "bg-background shadow font-medium" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setStatusTab("completed")}
        >
          Jugados{completedCount > 0 ? ` (${completedCount})` : ""}
        </button>
        <button
          className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${statusTab === "postponed" ? "bg-background shadow font-medium" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setStatusTab("postponed")}
        >
          Aplazados{postponedCount > 0 ? ` (${postponedCount})` : ""}
        </button>
      </div>

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
            {filteredSorted.map((match) => renderMatchCard(match))}
          </CardContent>
        </Card>
      )}

      {/* Filtered view: empty tab */}
      {isFiltered && filteredSorted.length === 0 && visibleMatches.length > 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {emptyMessage}
        </div>
      )}

      {/* === Default view: grouped by jornada === */}
      {!isFiltered && (
        <>
          {allSections.filter((s) => s.matches.length > 0).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {emptyMessage}
            </div>
          ) : (
            allSections
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
            ))
          )}
        </>
      )}
    </>
  );
}

// --- Empty state for Elimination ---

function EliminationEmptySchedule({ tournament }: { tournament: Tournament }) {
  const { setTournamentMatches, updateTournamentProps } = useTournaments();
  const [showIdaVueltaDialog, setShowIdaVueltaDialog] = useState(false);
  const [pendingMode, setPendingMode] = useState<"random" | "manual">("random");

  const isPaid = tournament.plan === "paid";

  const numRounds = Math.log2(tournament.teamIds.length);
  const jornadasIda = numRounds;
  const jornadasIdaVuelta = numRounds * 2;

  const handleGenerate = (doubleRoundRobin: boolean) => {
    setShowIdaVueltaDialog(false);
    if (pendingMode === "random") {
      const shuffledTeams = shuffleArray(tournament.teamIds);
      const matches = generateEliminationMatches(shuffledTeams, tournament.id, doubleRoundRobin);
      setTournamentMatches(tournament.id, matches);
      toast.success("Bracket generado aleatoriamente");
    } else {
      const matches = generateEmptyEliminationBracket(tournament.teamIds.length, tournament.id, doubleRoundRobin);
      setTournamentMatches(tournament.id, matches);
      toast.success("Bracket creado. Asigna los equipos en la vista de bracket.");
    }
    updateTournamentProps(tournament.id, { doubleRoundRobin });
  };

  const handleClick = (mode: "random" | "manual") => {
    if (isPaid) {
      setPendingMode(mode);
      setShowIdaVueltaDialog(true);
    } else {
      // Free: only ida, no dialog
      setPendingMode(mode);
      handleGenerate(false);
    }
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
        <Button onClick={() => handleClick("random")} className="gap-2">
          <Shuffle className="h-4 w-4" />
          Aleatorio
        </Button>
        <Button variant="outline" onClick={() => handleClick("manual")} className="gap-2">
          <LayoutList className="h-4 w-4" />
          Asignar Equipos
        </Button>
      </div>

      <Dialog open={showIdaVueltaDialog} onOpenChange={setShowIdaVueltaDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Tipo de Bracket</DialogTitle>
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
                  Un partido por ronda ({jornadasIda} rondas)
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
                  Dos partidos por ronda ({jornadasIdaVuelta} jornadas)
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Empty state for Round-Robin / Group-Playoff ---

function RoundRobinEmptySchedule({
  tournament,
}: {
  tournament: Tournament;
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
          if (tournament.phaseConfigs?.length) {
            // Multi-phase: only generate Phase 1 matches + empty playoff bracket
            const phase1Groups = tournament.groups.filter((g) => g.phase === 1);
            const shuffledPhase1 = phase1Groups.map((g) => ({
              ...g,
              teamIds: shuffleArray(g.teamIds),
            }));
            matches = generateMultiPhaseMatches(
              shuffledPhase1,
              tournament.phaseConfigs,
              tournament.playoffConfig,
              tournament.id,
              doubleRoundRobin
            );
          } else {
            const shuffledGroups = tournament.groups.map((g) => ({
              ...g,
              teamIds: shuffleArray(g.teamIds),
            }));
            matches = generateGroupPlayoffMatches(shuffledGroups, tournament.playoffConfig, tournament.id, doubleRoundRobin);
          }
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
        <Button onClick={() => {
          if (tournament.plan === "paid") {
            setShowIdaVueltaDialog(true);
          } else {
            handleGenerate(false);
          }
        }} className="gap-2">
          <Shuffle className="h-4 w-4" />
          Generar Aleatorio
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
