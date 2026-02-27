"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tournament, Match } from "@/types";
import { useTournaments } from "@/context/tournament-context";
import { CalendarIcon, Clock, MapPin, Check } from "lucide-react";
import { toast } from "sonner";

interface DateOrganizerProps {
  tournament: Tournament;
}

export function DateOrganizer({ tournament }: DateOrganizerProps) {
  const { updateMatchDetails, getTeamById } = useTournaments();
  const [activeSection, setActiveSection] = useState("");

  const unscheduled = tournament.matches.filter((m) => m.status === "unscheduled");
  if (unscheduled.length === 0) return null;

  // Build sections grouped by phase+round
  const sections: { key: string; label: string; matches: Match[] }[] = [];

  const groupPhaseMatches = unscheduled.filter((m) => m.phase === "group");
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

  const effectiveActive = activeSection || sections[0]?.key || "";
  const currentSection = sections.find((s) => s.key === effectiveActive) || sections[0];

  const handleSchedule = (match: Match) => {
    updateMatchDetails(tournament.id, match.id, { status: "scheduled" });
    toast.success("Partido programado");
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

      {/* Jornada pills */}
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
            />
          ))}
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
}: {
  match: Match;
  tournament: Tournament;
  getTeamById: (id: string) => import("@/types").Team | undefined;
  updateMatchDetails: (tournamentId: string, matchId: string, details: Record<string, unknown>) => void;
  onSchedule: (match: Match) => void;
}) {
  const [venue, setVenue] = useState(match.venue || "");

  const home = match.homeTeamId ? getTeamById(match.homeTeamId) : null;
  const away = match.awayTeamId ? getTeamById(match.awayTeamId) : null;
  const isReady = !!(match.date && match.time && venue.trim());

  const commitVenue = () => {
    const trimmed = venue.trim();
    const capitalized = trimmed.replace(/\b\w/g, (c) => c.toUpperCase());
    setVenue(capitalized);
    updateMatchDetails(tournament.id, match.id, { venue: capitalized || undefined });
  };

  return (
    <div className="px-4 py-3 space-y-2">
      <p className="text-sm font-medium">
        {home?.name || "TBD"} <span className="text-muted-foreground font-normal">vs</span> {away?.name || "TBD"}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            type="date"
            className="h-8 sm:h-7 text-sm sm:text-xs w-[130px]"
            value={match.date || ""}
            onChange={(e) =>
              updateMatchDetails(tournament.id, match.id, { date: e.target.value || undefined })
            }
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            type="time"
            className="h-8 sm:h-7 text-sm sm:text-xs w-[100px]"
            value={match.time || ""}
            onChange={(e) =>
              updateMatchDetails(tournament.id, match.id, { time: e.target.value || undefined })
            }
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
