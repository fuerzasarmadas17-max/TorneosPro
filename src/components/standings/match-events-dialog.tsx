"use client";

import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TeamMark } from "@/components/teams/team-mark";
import { useTournaments } from "@/context/tournament-context";
import { fetchMatchEventsByMatchIds } from "@/lib/db/tournaments";
import { mapMatchEvent } from "@/lib/db/mappers";
import { getShortName } from "@/lib/name-utils";
import { cn } from "@/lib/utils";
import { STAT_CATALOG, type Match, type MatchEvent, type MatchEventType, type Tournament } from "@/types";
import { Goal, Handshake, ListChecks, Volleyball } from "lucide-react";

/** Un jugador con su cantidad dentro de un tipo de estadística. */
interface PlayerTally {
  name: string;
  count: number;
}

/** Un tipo de estadística con lo que aportó cada equipo. */
interface StatBlock {
  key: MatchEventType;
  label: string;
  home: PlayerTally[];
  away: PlayerTally[];
}

/**
 * Ícono de cada tipo de evento. Las tarjetas se dibujan como una tarjeta de
 * verdad (un rectángulo del color que corresponde) en vez de un ícono
 * genérico: es lo que la gente reconoce de un vistazo en una ficha de
 * partido.
 */
function StatIcon({ type }: { type: MatchEventType }) {
  const card = (className: string) => (
    <span className={cn("inline-block h-3.5 w-2.5 rounded-[2px]", className)} />
  );

  switch (type) {
    case "goal":
      return <Goal className="h-3.5 w-3.5 text-emerald-600" />;
    case "assist":
      return <Handshake className="h-3.5 w-3.5 text-sky-600" />;
    case "yellow_card":
      return card("bg-amber-400");
    case "red_card":
      return card("bg-red-500");
    case "blue_card":
      return card("bg-blue-500");
    case "point":
    case "ace":
    case "block":
      return <Volleyball className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />;
  }
}

/**
 * Arma los bloques del resumen: un bloque por tipo de estadística, con los
 * jugadores de cada equipo ya contados ("Juan Pérez ×2" en vez de repetirlo).
 *
 * El orden lo fija STAT_CATALOG y no el orden de llegada de los eventos, para
 * que Goles salga siempre antes que Tarjetas. Los tipos `computed` (malla
 * menos vencida) se omiten: se derivan del marcador, no son eventos de
 * jugador.
 */
function buildBlocks(
  events: MatchEvent[],
  homeTeamId: string | null | undefined,
  awayTeamId: string | null | undefined,
  enabled?: MatchEventType[]
): StatBlock[] {
  const tally = (teamId: string | null | undefined, type: MatchEventType): PlayerTally[] => {
    if (!teamId) return [];
    const byPlayer = new Map<string, number>();
    for (const e of events) {
      if (e.type !== type || e.teamId !== teamId) continue;
      const name = e.playerName?.trim() || "Sin nombre";
      byPlayer.set(name, (byPlayer.get(name) ?? 0) + 1);
    }
    return [...byPlayer.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  };

  const blocks: StatBlock[] = [];
  for (const stat of STAT_CATALOG) {
    if (stat.computed) continue;
    // `enabled` vacío/ausente = el torneo no restringió estadísticas.
    if (enabled?.length && !enabled.includes(stat.key)) continue;

    const home = tally(homeTeamId, stat.key);
    const away = tally(awayTeamId, stat.key);
    if (home.length === 0 && away.length === 0) continue;

    blocks.push({ key: stat.key, label: stat.pluralLabel, home, away });
  }
  return blocks;
}

/** Columna de jugadores de un equipo dentro de un bloque. `align` la pega al
 *  borde que corresponde, para que el bloque se lea como una ficha simétrica. */
function PlayerColumn({
  players,
  align,
}: {
  players: PlayerTally[];
  align: "left" | "right";
}) {
  if (players.length === 0) {
    return <div aria-hidden className="min-w-0" />;
  }
  return (
    <ul className={cn("min-w-0 space-y-0.5", align === "right" && "text-right")}>
      {players.map((p) => (
        <li key={p.name} className="truncate text-sm">
          {/* Mismo criterio que Estadísticas y la nómina: nombre completo en
              desktop, primer nombre + apellido en mobile. */}
          <span className="sm:hidden">{getShortName(p.name)}</span>
          <span className="hidden sm:inline">{p.name}</span>
          {p.count > 1 && <span className="text-muted-foreground"> ×{p.count}</span>}
        </li>
      ))}
    </ul>
  );
}

/**
 * Modal con el resumen de un partido jugado (goles, asistencias, tarjetas)
 * para quien NO es organizador — el organizador ya tiene la pantalla de
 * carga/edición de resultado.
 *
 * Los eventos se piden al abrir el modal, un request por partido, y quedan
 * cacheados en el state mientras el componente viva. La alternativa era
 * leerlos de `match.events` del contexto, pero eso obliga a traerse los
 * eventos de TODOS los partidos al abrir el torneo — justo lo que queremos
 * evitar en mobile.
 */
export function MatchEventsDialog({
  match,
  tournament,
}: {
  match: Match;
  tournament: Tournament;
}) {
  const { getTeamById } = useTournaments();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<MatchEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const home = match.homeTeamId ? getTeamById(match.homeTeamId) : null;
  const away = match.awayTeamId ? getTeamById(match.awayTeamId) : null;
  const homeWon = (match.homeScore ?? 0) > (match.awayScore ?? 0);
  const awayWon = (match.awayScore ?? 0) > (match.homeScore ?? 0);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const map = await fetchMatchEventsByMatchIds([match.id]);
      setEvents((map.get(match.id) ?? []).map(mapMatchEvent));
    } catch (err) {
      console.error("No se pudieron cargar los eventos del partido", err);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    // Solo la primera apertura pega a la red; reabrir reusa lo cacheado.
    if (next && events === null && !loading) load();
  };

  const blocks = events
    ? buildBlocks(events, match.homeTeamId, match.awayTeamId, tournament.enabledStats)
    : [];

  const shell = (children: ReactNode) => (
    <div className="py-10 text-center text-sm text-muted-foreground">{children}</div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ListChecks className="h-3.5 w-3.5" />
          Ver detalle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>
            {home?.name || "TBD"} {match.homeScore} - {match.awayScore} {away?.name || "TBD"}
          </DialogTitle>
        </DialogHeader>

        {/* Marcador: los dos escudos enfrentados con el resultado al centro.
            El equipo perdedor va atenuado, que es como se lee un resultado
            de un vistazo. */}
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-4">
          <div className={cn("flex flex-1 flex-col items-center gap-1.5 text-center", awayWon && "opacity-60")}>
            <TeamMark team={home} size={40} />
            <span className="line-clamp-2 text-xs font-medium leading-tight">
              {home?.name || "TBD"}
            </span>
          </div>

          <div className="shrink-0 text-center">
            <div className="flex items-baseline gap-1.5 text-2xl font-bold tabular-nums">
              <span className={cn(!homeWon && "text-muted-foreground")}>{match.homeScore}</span>
              <span className="text-base text-muted-foreground">-</span>
              <span className={cn(!awayWon && "text-muted-foreground")}>{match.awayScore}</span>
            </div>
            {match.sets && match.sets.length > 0 && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {match.sets.map((s) => `${s.homePoints}-${s.awayPoints}`).join(" · ")}
              </p>
            )}
          </div>

          <div className={cn("flex flex-1 flex-col items-center gap-1.5 text-center", homeWon && "opacity-60")}>
            <TeamMark team={away} size={40} />
            <span className="line-clamp-2 text-xs font-medium leading-tight">
              {away?.name || "TBD"}
            </span>
          </div>
        </div>

        {loading ? (
          shell("Cargando estadísticas…")
        ) : failed ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No se pudieron cargar las estadísticas.
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={load}>
              Reintentar
            </Button>
          </div>
        ) : blocks.length === 0 ? (
          shell("El organizador no cargó estadísticas de este partido.")
        ) : (
          <div className="space-y-3">
            {blocks.map((block) => (
              <div key={block.key}>
                {/* Etiqueta del tipo, centrada entre las dos columnas: el
                    bloque se lee como una fila de ficha de partido, local a
                    la izquierda y visitante a la derecha. */}
                <div className="flex items-center gap-2">
                  <span className="h-px flex-1 bg-border" />
                  <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <StatIcon type={block.key} />
                    {block.label}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-3">
                  <PlayerColumn players={block.home} align="left" />
                  <PlayerColumn players={block.away} align="right" />
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
