"use client";

import { useEffect, useRef, useState } from "react";
import { Star, X } from "lucide-react";

/** Jugador elegido como MVP. El equipo va junto al nombre porque dos jugadores
 *  de equipos distintos pueden llamarse igual, y sin el equipo el evento no se
 *  puede guardar (`match_events.team_id` es obligatorio). */
export interface MvpSelection {
  teamId: string;
  playerName: string;
}

/** Un equipo con los nombres que se pueden elegir dentro de él. */
export interface MvpPickerTeam {
  teamId: string;
  teamName: string;
  /** Nombres candidatos (plantilla + historial), ya deduplicados. */
  options: string[];
}

/**
 * Selector de MVP: UN jugador entre los equipos que se le pasen, o ninguno.
 *
 * Lo usan dos pantallas distintas — el MVP de un partido (dos equipos) y el
 * MVP del torneo (todos los inscritos, en el modal del campeón).
 *
 * Lo comparten el form del organizador y la pantalla del anotador, igual que
 * `FairPlayPicker` — los dos cargan resultados y los dos pueden elegirlo, y si
 * el copy viviera en dos lados terminarían explicando cosas distintas.
 *
 * Por qué un selector propio y no una fila más de la lista de estadísticas:
 * las demás stats se cargan con una fila "agregar jugador" que se repite
 * (tres goles = tres filas). El MVP es uno solo por partido, así que la fila
 * repetible sería una invitación a elegir dos.
 *
 * Acepta texto libre, como el resto de los selectores de jugador: hay equipos
 * sin plantilla cargada, y ahí escribir el nombre a mano es la única opción.
 * Cuando el nombre no está en la lista hay que decir de qué equipo es, por eso
 * aparecen las dos opciones "Usar «X» en <equipo>".
 */
export function MvpPicker({
  teams,
  value,
  onChange,
  title = "MVP del partido",
  help = "El mejor jugador del partido. Uno solo, de cualquiera de los dos equipos. Es opcional: si nadie se destacó, dejalo vacío.",
}: {
  /** Los equipos entre los que se puede elegir. En un partido son dos; en el
   *  MVP del torneo, todos los inscritos. */
  teams: MvpPickerTeam[];
  /** Jugador elegido, o null si no se le dio a nadie. */
  value: MvpSelection | null;
  onChange: (mvp: MvpSelection | null) => void;
  title?: string;
  help?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const teamNameOf = (teamId: string) =>
    teams.find((t) => t.teamId === teamId)?.teamName ?? "";

  const q = query.trim().toLowerCase();
  const match = (name: string) => !q || name.toLowerCase().includes(q);

  const groups = teams.map((t) => ({
    ...t,
    options: t.options.filter(match),
  }));

  const hasResults = groups.some((g) => g.options.length > 0);
  // Texto escrito que no coincide exacto con ningún nombre conocido: se ofrece
  // guardarlo tal cual, eligiendo equipo.
  const typed = query.trim();
  const isKnown = teams.some((t) =>
    t.options.some((n) => n.toLowerCase() === typed.toLowerCase())
  );
  // Con muchos equipos (el MVP del torneo los lista todos) ofrecer "usar este
  // nombre en X" para cada uno sería una lista interminable: se ofrece solo
  // cuando son pocos, que es el caso del partido.
  const freeTextTeams = typed && !isKnown && teams.length <= 2 ? teams : [];

  const pick = (teamId: string, playerName: string) => {
    onChange({ teamId, playerName });
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Star className="h-4 w-4 text-amber-500" />
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground">{help}</p>

      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500 bg-amber-50 px-3 py-2.5 dark:bg-amber-950/40">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-amber-700 dark:text-amber-400">
              {value.playerName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {teamNameOf(value.teamId)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-background"
          >
            <X className="h-3 w-3" />
            Quitar
          </button>
        </div>
      ) : (
        <div ref={containerRef} className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              // Enter dentro del form del organizador dispara el submit; acá
              // solo estamos buscando un nombre.
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder="Elegir jugador"
            autoComplete="off"
            maxLength={60}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {open && (hasResults || freeTextTeams.length > 0) && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover shadow-md">
              {groups.map((g) =>
                g.options.length === 0 ? null : (
                  <div key={g.teamId}>
                    <p className="sticky top-0 bg-popover px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.teamName}
                    </p>
                    {g.options.map((name) => (
                      <button
                        key={`${g.teamId}-${name}`}
                        type="button"
                        className="w-full cursor-pointer px-3 py-1.5 text-left text-sm hover:bg-accent"
                        // onMouseDown (no onClick) para ganarle al blur del
                        // input, igual que en PlayerCombobox.
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pick(g.teamId, name);
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )
              )}
              {freeTextTeams.map((t) => (
                <button
                  key={`free-${t.teamId}`}
                  type="button"
                  className="w-full cursor-pointer border-t px-3 py-1.5 text-left text-sm hover:bg-accent"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(t.teamId, typed);
                  }}
                >
                  Usar <span className="font-medium">«{typed}»</span> en{" "}
                  {t.teamName}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
