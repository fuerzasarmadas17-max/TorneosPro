"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, MapPin, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tournament } from "@/types";
import { useTournaments } from "@/context/tournament-context";
import { buildTournamentColorMap } from "@/lib/tournament-colors";
import {
  startOfDay,
  toISO,
  addDays,
  mondayOf,
  WEEKDAYS,
  formatTime12h,
  formatDayLabel,
} from "@/lib/agenda-dates";

interface AgendaMatch {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  color: string;
  date: string;
  time?: string;
  venue?: string;
  homeName: string;
  awayName: string;
}

export function WeeklyAgenda({ tournaments }: { tournaments: Tournament[] }) {
  const { getTeamById } = useTournaments();
  const today = startOfDay(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const colorMap = useMemo(
    () => buildTournamentColorMap(tournaments.map((t) => t.id)),
    [tournaments]
  );

  // Todos los partidos PROGRAMADOS (con fecha) de los torneos activos,
  // agrupados por fecha ISO.
  const matchesByDate = useMemo(() => {
    const map = new Map<string, AgendaMatch[]>();
    for (const t of tournaments) {
      const color = colorMap.get(t.id) ?? "#2a78d6";
      for (const m of t.matches) {
        if (m.status !== "scheduled" || !m.date) continue;
        const item: AgendaMatch = {
          matchId: m.id,
          tournamentId: t.id,
          tournamentName: t.name,
          color,
          date: m.date,
          time: m.time,
          venue: m.venue,
          homeName: (m.homeTeamId && getTeamById(m.homeTeamId)?.name) || "Por definir",
          awayName: (m.awayTeamId && getTeamById(m.awayTeamId)?.name) || "Por definir",
        };
        const arr = map.get(m.date) ?? [];
        arr.push(item);
        map.set(m.date, arr);
      }
    }
    // Ordenar cada día por hora (los sin hora al final).
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
    }
    return map;
  }, [tournaments, colorMap, getTeamById]);

  const weekStart = mondayOf(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const selectedISO = toISO(selectedDate);
  const dayMatches = matchesByDate.get(selectedISO) ?? [];

  const selectedLabel = formatDayLabel(selectedDate);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Nav semana + día seleccionado */}
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => setSelectedDate((d) => addDays(d, -1))}
            aria-label="Día anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="min-w-0 text-center">
            <p className="text-sm font-semibold truncate">{selectedLabel}</p>
            {toISO(selectedDate) !== toISO(today) && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedDate(today)}
              >
                Volver a hoy
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
            aria-label="Día siguiente"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Tira semanal */}
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((d) => {
            const iso = toISO(d);
            const count = matchesByDate.get(iso)?.length ?? 0;
            const isSelected = iso === selectedISO;
            const isToday = iso === toISO(today);
            return (
              <button
                key={iso}
                onClick={() => setSelectedDate(d)}
                className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <span className="text-[10px] uppercase opacity-70">
                  {WEEKDAYS[(d.getDay() + 6) % 7]}
                </span>
                <span
                  className={`flex size-7 items-center justify-center rounded-full text-sm font-medium ${
                    isToday && !isSelected ? "ring-1 ring-primary text-primary" : ""
                  }`}
                >
                  {d.getDate()}
                </span>
                <span className="flex h-1.5 items-center">
                  {count > 0 && (
                    <span
                      className={`size-1.5 rounded-full ${
                        isSelected ? "bg-primary-foreground" : "bg-primary"
                      }`}
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Partidos del día */}
        {dayMatches.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <CalendarDays className="size-8 opacity-40" />
            <p className="text-sm">No hay partidos programados este día.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dayMatches.map((m) => (
              <Link
                key={m.matchId}
                href={`/tournaments/${m.tournamentId}/matches/${m.matchId}`}
                className="flex items-stretch gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <span
                  className="w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: m.color }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: m.color }}
                      aria-hidden
                    />
                    <span className="truncate">{m.tournamentName}</span>
                  </div>
                  <p className="text-sm font-medium leading-tight">
                    {m.homeName} <span className="text-muted-foreground">vs</span> {m.awayName}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {m.time && (
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatTime12h(m.time)}
                      </span>
                    )}
                    {m.venue && (
                      <span className="flex items-center gap-1 min-w-0">
                        <MapPin className="size-3 shrink-0" />
                        <span className="truncate">{m.venue}</span>
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
