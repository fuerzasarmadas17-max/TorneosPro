"use client";

import { FAIR_PLAY_POINTS } from "@/types";
import { Handshake } from "lucide-react";

/**
 * Selector del premio Juego Limpio de un partido.
 *
 * Lo comparten el form del organizador y la pantalla del anotador: los dos
 * cargan resultados y los dos pueden darlo, así que si el copy viviera en dos
 * lados terminarían explicando cosas distintas sobre un premio que cambia la
 * tabla de posiciones.
 *
 * Tres estados, siempre visibles: local, ninguno, visitante. "Ninguno" es un
 * botón y no la ausencia de elección a propósito — es opcional de verdad (hay
 * fechas donde ninguno lo merece), y sin el botón no habría forma de quitarlo
 * al corregir un partido.
 */
export function FairPlayPicker({
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  value,
  onChange,
}: {
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  /** Equipo premiado, o null si no se le dio a nadie. */
  value: string | null;
  onChange: (teamId: string | null) => void;
}) {
  const options: { key: string; label: string; teamId: string | null }[] = [
    ...(homeTeamId
      ? [{ key: homeTeamId, label: homeTeamName, teamId: homeTeamId }]
      : []),
    { key: "__none__", label: "Ninguno", teamId: null },
    ...(awayTeamId
      ? [{ key: awayTeamId, label: awayTeamName, teamId: awayTeamId }]
      : []),
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Handshake className="h-4 w-4 text-emerald-600" />
        <span className="font-semibold text-sm">Juego Limpio</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Se lo puede llevar uno de los dos equipos, o ninguno. Al equipo
        premiado le suma {FAIR_PLAY_POINTS} punto en la tabla.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => {
          const selected = value === o.teamId;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onChange(o.teamId)}
              className={`rounded-lg border px-2 py-2.5 text-sm transition-colors break-words ${
                selected
                  ? o.teamId === null
                    ? "bg-muted border-foreground/30 font-medium"
                    : "bg-emerald-50 border-emerald-600 text-emerald-700 font-semibold dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "border-border hover:border-muted-foreground/50"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
