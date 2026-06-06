"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tournament, Match } from "@/types";
import { useTournaments } from "@/context/tournament-context";
import { getRoundLabel } from "@/data/helpers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Clock, MapPin, Check, ArrowRight, Filter } from "lucide-react";
import { toast } from "sonner";

/** Normalizes user input into HH:MM format. Accepts: "1630", "16:30", "430pm", "4:30 PM", etc. */
function normalizeTime(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return "";

  const isPM = s.includes("pm") || s.includes("p");
  const isAM = s.includes("am") || s.includes("a");
  const digits = s.replace(/[^0-9:]/g, "");

  let h: number, m: number;

  if (digits.includes(":")) {
    const [hh, mm] = digits.split(":");
    h = parseInt(hh, 10);
    m = parseInt(mm || "0", 10);
  } else if (digits.length <= 2) {
    h = parseInt(digits, 10);
    m = 0;
  } else if (digits.length === 3) {
    h = parseInt(digits[0], 10);
    m = parseInt(digits.slice(1), 10);
  } else {
    h = parseInt(digits.slice(0, 2), 10);
    m = parseInt(digits.slice(2, 4), 10);
  }

  if (isNaN(h)) return "";

  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;

  h = Math.min(h, 23);
  m = isNaN(m) ? 0 : Math.min(m, 59);

  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

interface DateOrganizerProps {
  tournament: Tournament;
  /** When set, only show unscheduled matches that belong to this phase
   *  (group-stage matches whose groupId resolves to this phase number).
   *  Used by the Pieza E completion modal to scope dates to a specific
   *  phase. Omit for the global behavior. */
  phaseFilter?: number;
}

export function DateOrganizer({ tournament, phaseFilter }: DateOrganizerProps) {
  const { updateMatchDetails, getTeamById } = useTournaments();
  const [activeSection, setActiveSection] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("all");

  // Pre-build groupId→phase map so the phaseFilter predicate is cheap.
  const groupIdToPhase = new Map<string, number>();
  if (tournament.groups) {
    for (const g of tournament.groups) {
      groupIdToPhase.set(g.id, g.phase ?? 1);
    }
  }

  const matchBelongsToPhase = (m: Match) => {
    if (phaseFilter === undefined) return true;
    if (m.phase === "group" && m.groupId) {
      return (groupIdToPhase.get(m.groupId) ?? 1) === phaseFilter;
    }
    // Non-group matches aren't tied to a phase number — they're excluded
    // when a phaseFilter is requested.
    return false;
  };

  const allUnscheduled = tournament.matches.filter(
    (m) => m.status === "unscheduled" && matchBelongsToPhase(m)
  );
  if (allUnscheduled.length === 0) return null;

  // Team filter: lets the organizer quickly see which crossings are still
  // pending for a given team.
  const teamOptions = tournament.teamIds
    .map((id) => ({ id, name: getTeamById(id)?.name || id }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const unscheduled = teamFilter === "all"
    ? allUnscheduled
    : allUnscheduled.filter(
        (m) => m.homeTeamId === teamFilter || m.awayTeamId === teamFilter
      );

  // Build sections grouped by phase+round
  const sections: { key: string; label: string; matches: Match[] }[] = [];

  const groupPhaseMatches = unscheduled.filter((m) => m.phase === "group");
  const playoffPhaseMatches = unscheduled.filter((m) => m.phase === "playoff");
  const regularMatches = unscheduled.filter((m) => !m.phase);

  if (regularMatches.length > 0) {
    const rounds = new Map<number, Match[]>();
    for (const m of regularMatches) {
      const arr = rounds.get(m.round) || [];
      arr.push(m);
      rounds.set(m.round, arr);
    }
    for (const [round, matches] of Array.from(rounds.entries()).sort(([a], [b]) => a - b)) {
      sections.push({
        key: `r-${round}`,
        label: round === 0 ? "Extras" : `J${round}`,
        matches,
      });
    }
  }

  if (groupPhaseMatches.length > 0) {
    const groupIdToPhase = new Map<string, number>();
    if (tournament.phaseConfigs?.length && tournament.groups) {
      for (const g of tournament.groups) {
        if (g.phase) groupIdToPhase.set(g.id, g.phase);
      }
    }

    if (groupIdToPhase.size > 0) {
      const phaseMatches = new Map<number, Match[]>();
      for (const m of groupPhaseMatches) {
        const phase = m.groupId ? (groupIdToPhase.get(m.groupId) || 1) : 1;
        const arr = phaseMatches.get(phase) || [];
        arr.push(m);
        phaseMatches.set(phase, arr);
      }
      for (const [phase, pMatches] of Array.from(phaseMatches.entries()).sort(([a], [b]) => a - b)) {
        const rounds = new Map<number, Match[]>();
        for (const m of pMatches) {
          const arr = rounds.get(m.round) || [];
          arr.push(m);
          rounds.set(m.round, arr);
        }
        for (const [round, matches] of Array.from(rounds.entries()).sort(([a], [b]) => a - b)) {
          sections.push({
            key: `p${phase}-r${round}`,
            label: round === 0 ? `Extras F${phase}` : `J${round} F${phase}`,
            matches,
          });
        }
      }
    } else {
      const rounds = new Map<number, Match[]>();
      for (const m of groupPhaseMatches) {
        const arr = rounds.get(m.round) || [];
        arr.push(m);
        rounds.set(m.round, arr);
      }
      for (const [round, matches] of Array.from(rounds.entries()).sort(([a], [b]) => a - b)) {
        sections.push({
          key: `g-r${round}`,
          label: round === 0 ? "Extras" : `J${round}`,
          matches,
        });
      }
    }
  }

  // Playoff bracket rounds (Cuartos / Semifinal / Final). Labels come from
  // getRoundLabel based on the total bracket rounds, using ALL playoff
  // matches (not just unscheduled) so the label stays stable as games get
  // scheduled and drop out of this list. For double-leg the raw round
  // count is doubled (ida + vuelta), so we collapse pairs and prefix the
  // label with "Ida " / "Vuelta ".
  if (playoffPhaseMatches.length > 0) {
    const allPlayoff = tournament.matches.filter((m) => m.phase === "playoff");
    const totalRawRounds = allPlayoff.length > 0
      ? Math.max(...allPlayoff.map((m) => m.round))
      : 1;
    const isDoubleLeg = !!tournament.playoffDoubleLeg;
    const totalBracketRounds = isDoubleLeg
      ? Math.ceil(totalRawRounds / 2)
      : totalRawRounds;

    const rounds = new Map<number, Match[]>();
    for (const m of playoffPhaseMatches) {
      const arr = rounds.get(m.round) || [];
      arr.push(m);
      rounds.set(m.round, arr);
    }
    for (const [round, matches] of Array.from(rounds.entries()).sort(([a], [b]) => a - b)) {
      const bracketRound = isDoubleLeg ? Math.ceil(round / 2) : round;
      const leg = isDoubleLeg ? (round % 2 === 1 ? "Ida — " : "Vuelta — ") : "";
      sections.push({
        key: `po-r${round}`,
        label: `${leg}${getRoundLabel(bracketRound, totalBracketRounds)}`,
        matches,
      });
    }
  }

  const effectiveActive = activeSection || sections[0]?.key || "";
  const currentSection = sections.find((s) => s.key === effectiveActive) || sections[0];

  const handleSchedule = (match: Match) => {
    updateMatchDetails(tournament.id, match.id, { status: "scheduled" });
    toast.success("Partido programado");
  };

  // All existing rounds > 0 for the jornada selector (from ALL matches, not just unscheduled)
  const availableRounds = Array.from(new Set(
    tournament.matches.filter((m) => m.round > 0).map((m) => m.round)
  )).sort((a, b) => a - b);

  const handleMoveToRound = (matchId: string, round: number) => {
    updateMatchDetails(tournament.id, matchId, { round });
    toast.success(`Partido movido a J${round}`);
  };

  // Calculate resting teams per section
  const allTeamIds = new Set(tournament.teamIds);
  const getRestingTeams = (sectionMatches: Match[]) => {
    const playing = new Set<string>();
    for (const m of sectionMatches) {
      if (m.homeTeamId) playing.add(m.homeTeamId);
      if (m.awayTeamId) playing.add(m.awayTeamId);
    }
    return Array.from(allTeamIds).filter((id) => !playing.has(id));
  };

  const usedVenues = Array.from(new Set(
    tournament.matches.map((m) => m.venue).filter(Boolean) as string[]
  ));

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <datalist id={`venues-${tournament.id}`}>
        {usedVenues.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <span className="font-semibold text-sm flex-1">Organizar fechas</span>
        <Badge variant="secondary" className="text-xs">
          {unscheduled.length} sin programar
        </Badge>
      </div>

      {/* Team filter */}
      {teamOptions.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/20">
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

      {teamFilter === "all" ? (
        <>
          {/* Jornada pills (sin filtro: navega jornada por jornada) */}
          <div className="flex gap-1.5 px-4 py-2 border-b bg-muted/30 overflow-x-auto">
            {sections.map((s) => (
              <button
                key={s.key}
                className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                  effectiveActive === s.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveSection(s.key)}
              >
                {s.label}
                <span className="ml-1 opacity-70">{s.matches.length}</span>
              </button>
            ))}
          </div>

          {/* Matches for active jornada */}
          {currentSection && (
            <div className="divide-y">
              {currentSection.matches.map((match) => (
                <MatchRow
                  key={match.id}
                  match={match}
                  tournament={tournament}
                  getTeamById={getTeamById}
                  updateMatchDetails={updateMatchDetails}
                  onSchedule={handleSchedule}
                  availableRounds={availableRounds}
                  onMoveToRound={handleMoveToRound}
                />
              ))}
              {/* Descanso indicator */}
              {currentSection.key !== "r-0" && (() => {
                const resting = getRestingTeams(currentSection.matches);
                if (resting.length === 0) return null;
                return (
                  <div className="px-4 py-2.5 text-xs text-muted-foreground">
                    Descanso: {resting.map((id) => getTeamById(id)?.name || "?").join(", ")}
                  </div>
                );
              })()}
            </div>
          )}
        </>
      ) : (
        /* Filtrado por equipo: todos los cruces pendientes en una sola lista,
           agrupados por jornada (sub-encabezado, sin pestañas) */
        <div>
          {sections.map((s) => (
            <div key={s.key}>
              <div className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-muted-foreground bg-muted/30 border-b">
                <span className="text-foreground">{s.label}</span>
                <span className="opacity-60">·</span>
                <span>
                  {s.matches.length} {s.matches.length === 1 ? "cruce" : "cruces"}
                </span>
              </div>
              <div className="divide-y">
                {s.matches.map((match) => (
                  <MatchRow
                    key={match.id}
                    match={match}
                    tournament={tournament}
                    getTeamById={getTeamById}
                    updateMatchDetails={updateMatchDetails}
                    onSchedule={handleSchedule}
                    availableRounds={availableRounds}
                    onMoveToRound={handleMoveToRound}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {sections.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          {teamOptions.find((t) => t.id === teamFilter)?.name ?? "Ese equipo"} no tiene cruces pendientes
        </div>
      )}
    </div>
  );
}

function MatchRow({
  match,
  tournament,
  getTeamById,
  updateMatchDetails,
  onSchedule,
  availableRounds,
  onMoveToRound,
}: {
  match: Match;
  tournament: Tournament;
  getTeamById: (id: string) => import("@/types").Team | undefined;
  updateMatchDetails: (tournamentId: string, matchId: string, details: Record<string, unknown>) => void;
  onSchedule: (match: Match) => void;
  availableRounds: number[];
  onMoveToRound: (matchId: string, round: number) => void;
}) {
  const [date, setDate] = useState(match.date || "");
  const [time, setTime] = useState(match.time || "");
  const [venue, setVenue] = useState(match.venue || "");

  const home = match.homeTeamId ? getTeamById(match.homeTeamId) : null;
  const away = match.awayTeamId ? getTeamById(match.awayTeamId) : null;
  const isReady = !!(date && time && venue.trim());

  const commitDate = () => {
    updateMatchDetails(tournament.id, match.id, { date: date || undefined });
  };

  const commitTime = () => {
    const normalized = normalizeTime(time);
    setTime(normalized);
    updateMatchDetails(tournament.id, match.id, { time: normalized || undefined });
  };

  const commitVenue = () => {
    const trimmed = venue.trim();
    const capitalized = trimmed.replace(/\b\w/g, (c) => c.toUpperCase());
    setVenue(capitalized);
    updateMatchDetails(tournament.id, match.id, { venue: capitalized || undefined });
  };

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {home?.name || "TBD"} <span className="text-muted-foreground font-normal">vs</span> {away?.name || "TBD"}
        </p>
        {match.round === 0 && availableRounds.length > 0 && (
          <Select onValueChange={(v) => onMoveToRound(match.id, parseInt(v, 10))}>
            <SelectTrigger className="h-7 w-auto text-xs gap-1">
              <ArrowRight className="h-3 w-3" />
              <SelectValue placeholder="Mover a..." />
            </SelectTrigger>
            <SelectContent>
              {availableRounds.map((r) => (
                <SelectItem key={r} value={String(r)}>J{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            type="date"
            className="h-8 sm:h-7 text-sm sm:text-xs w-[130px]"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onBlur={commitDate}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            type="time"
            className="h-8 sm:h-7 text-sm sm:text-xs w-[100px]"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            onBlur={commitTime}
            onKeyDown={(e) => { if (e.key === "Enter") commitTime(); }}
          />
        </div>
        <div className="flex items-center gap-1.5 flex-1 min-w-[120px]">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            type="text"
            placeholder="Lugar"
            className="h-8 sm:h-7 text-sm sm:text-xs"
            list={`venues-${tournament.id}`}
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            onBlur={commitVenue}
            onKeyDown={(e) => { if (e.key === "Enter") commitVenue(); }}
          />
        </div>
        <Button
          size="sm"
          className="h-8 sm:h-7 text-xs gap-1"
          disabled={!isReady}
          onClick={() => {
            commitDate();
            commitTime();
            commitVenue();
            onSchedule(match);
          }}
        >
          <Check className="h-3 w-3" />
          Programar
        </Button>
      </div>
    </div>
  );
}
