"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TeamMark } from "@/components/teams/team-mark";
import type { Sponsor, Team, Tournament } from "@/types";
import { formatTime12h } from "@/lib/agenda-dates";
import {
  ROTACION_PATROCINADORES_MS,
  grupoDePatrocinadores,
  type PartidoEnVivoDato,
} from "@/lib/volley/en-vivo";

/**
 * La hoja del marcador en vivo: patrocinadores arriba, fijos, y una tarjeta por
 * partido abajo, con scroll. Se carga aparte (ver `en-vivo.tsx`).
 *
 * Ver `Por hacer/deportes/voley/PLANILLA-EN-VIVO-PUBLICO.md`, secciones 2 y 6.
 */

function haceCuanto(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `hace ${s} segundos`;
  const m = Math.round(s / 60);
  return m === 1 ? "hace 1 minuto" : `hace ${m} minutos`;
}

export default function HojaEnVivo({
  abierto,
  onOpenChange,
  titulo,
  tournament,
  partidos,
  sponsors,
  getTeamById,
}: {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  titulo: string;
  tournament: Tournament;
  partidos: PartidoEnVivoDato[];
  sponsors: Sponsor[];
  getTeamById: (id: string) => Team | undefined;
}) {
  // Re-dibuja cada 10 s para que "actualizado hace X" avance solo.
  const [, setTick] = useState(0);
  // La vuelta de la rotación de patrocinadores.
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    if (!abierto) return;
    const reloj = setInterval(() => setTick((t) => t + 1), 10_000);
    const rotacion = setInterval(() => setVuelta((v) => v + 1), ROTACION_PATROCINADORES_MS);
    return () => {
      clearInterval(reloj);
      clearInterval(rotacion);
    };
  }, [abierto]);

  const enPantalla = grupoDePatrocinadores(sponsors.length, vuelta).map((i) => sponsors[i]);

  return (
    <Sheet open={abierto} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[90dvh] flex-col gap-0 rounded-t-2xl p-0 sm:mx-auto sm:max-w-lg"
      >
        <SheetHeader className="border-b pb-3">
          <SheetTitle className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            En vivo
          </SheetTitle>
          <SheetDescription>{titulo}</SheetDescription>
        </SheetHeader>

        {/* Patrocinadores arriba, fijos: no se van con el scroll. Siempre 3 (o
            todos si son menos), rotando de a 3 cada 2 minutos. */}
        {enPantalla.length > 0 && (
          <div className="border-b px-4 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Patrocinadores
            </p>
            <div className="flex gap-2">
              {enPantalla.map((s) => {
                const logo = (
                  // eslint-disable-next-line @next/next/no-img-element -- mismos logos que el banner del torneo, ya bajados
                  <img src={s.imageUrl} alt="Patrocinador" className="h-full w-full object-contain p-1.5" />
                );
                const clase =
                  "block h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-primary/30 bg-muted/30";
                return s.linkUrl?.trim() ? (
                  <a key={s.id} href={s.linkUrl} target="_blank" rel="noopener noreferrer" className={clase}>
                    {logo}
                  </a>
                ) : (
                  <div key={s.id} className={clase}>
                    {logo}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {partidos.map((p) => {
            const match = tournament.matches.find((m) => m.id === p.matchId);
            if (!match) return null;
            const home = match.homeTeamId ? getTeamById(match.homeTeamId) : undefined;
            const away = match.awayTeamId ? getTeamById(match.awayTeamId) : undefined;
            const { sets, setEnJuego } = p.foto;
            const filas = [
              { team: home, sets: sets.home, pierde: sets.home < sets.away },
              { team: away, sets: sets.away, pierde: sets.away < sets.home },
            ];
            const cuando =
              [match.time ? formatTime12h(match.time) : null, match.venue]
                .filter(Boolean)
                .join(" · ") || "Hoy";
            return (
              <div
                key={p.matchId}
                className="space-y-2.5 rounded-xl border border-red-500/40 bg-gradient-to-b from-red-500/[0.06] to-transparent p-3"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{cuando}</span>
                  <span className="flex items-center gap-1.5 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" /> EN VIVO
                  </span>
                </div>

                {filas.map((fila, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <TeamMark team={fila.team} size={28} />
                    <span
                      className={`flex-1 truncate text-base ${fila.pierde ? "font-medium text-muted-foreground" : "font-semibold"}`}
                    >
                      {fila.team?.name ?? "TBD"}
                    </span>
                    <span
                      className={`text-2xl tabular-nums ${fila.pierde ? "font-semibold text-muted-foreground" : "font-extrabold"}`}
                    >
                      {fila.sets}
                    </span>
                  </div>
                ))}

                <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {setEnJuego ? `Set ${setEnJuego.n}, jugándose` : "Entre sets"}
                  </span>
                  {setEnJuego && (
                    <span className="text-lg font-extrabold tabular-nums">
                      {setEnJuego.home} – {setEnJuego.away}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Actualizado {haceCuanto(p.actualizadoEn)}
                </p>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
