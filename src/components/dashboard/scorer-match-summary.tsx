"use client";

import { formatTime12h } from "@/lib/agenda-dates";

/** Un partido, ya resuelto a nombres, para las listas de anotadores. */
export interface MatchInfo {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  color: string;
  date: string;
  time: string;
  venue?: string;
  homeName: string;
  awayName: string;
  /** Para marcar los que el anotador ya cargó (siguen en el link). */
  isCompleted: boolean;
}

/**
 * Resumen de una línea de un partido. Lo comparten el panel de links activos
 * y el diálogo de crear, así las dos listas se leen igual.
 */
export function MatchSummary({ match }: { match: MatchInfo }) {
  return (
    <div className="flex-1 min-w-0">
      {/* Los nombres se llevan el ancho completo y bajan a dos líneas: con
          clubes de nombre largo, truncar en una sola se come al visitante
          entero y no se sabe contra quién juega. El chip "Cargado" va abajo
          por lo mismo — arriba le robaba el ancho a los equipos. */}
      <div className="text-sm font-medium leading-snug line-clamp-2">
        {match.homeName}{" "}
        <span className="text-muted-foreground font-normal">vs</span>{" "}
        {match.awayName}
      </div>
      <div className="flex items-center gap-1.5 min-w-0">
        {match.isCompleted && (
          <span className="shrink-0 rounded-full bg-green-600/10 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-500">
            Cargado
          </span>
        )}
        <span className="truncate text-[11px] text-muted-foreground">
          {match.tournamentName} · {formatTime12h(match.time)}
          {match.venue ? ` · ${match.venue}` : ""}
        </span>
      </div>
    </div>
  );
}
