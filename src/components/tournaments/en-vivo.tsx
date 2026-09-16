"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TeamMark } from "@/components/teams/team-mark";
import { Match, Sponsor, Team, Tournament } from "@/types";
import { formatTime12h } from "@/lib/agenda-dates";

/**
 * Marcador en vivo para el público — PROTOTIPO para verlo en local.
 *
 * Todavía no existe el dato en vivo (la planilla no manda nada mientras se
 * juega), así que esto solo aparece con `?envivo=demo` en la URL, fuera de
 * producción, y arma marcadores inventados sobre partidos reales del torneo. Ver
 * `Por hacer/deportes/voley/PLANILLA-EN-VIVO-PUBLICO.md`.
 *
 * Idea del dueño, 2026-09-16: al cargar la página, un aviso "EN VIVO" con
 * cuántos partidos se están jugando. Al tocarlo se abre una hoja con los
 * patrocinadores arriba y abajo una tarjeta por partido, con scroll si son
 * muchos.
 */

export interface PartidoEnVivo {
  match: Match;
  /** Sets ganados por cada lado. */
  setsLocal: number;
  setsVisita: number;
  /** El set que se está jugando y cómo va. */
  setActual: number;
  puntosLocal: number;
  puntosVisita: number;
  /** Cuándo mandó la planilla el último dato. */
  actualizadoEn: number;
}

/** Marcadores inventados sobre partidos reales, para ver la pantalla. */
export function partidosDeMuestra(tournament: Tournament): PartidoEnVivo[] {
  const candidatos = tournament.matches.filter(
    (m) => m.homeTeamId && m.awayTeamId && m.status !== "completed"
  );
  const base = candidatos.length > 0 ? candidatos : tournament.matches.filter((m) => m.homeTeamId && m.awayTeamId);
  const ahora = Date.now();
  const muestras = [
    { sl: 1, sv: 0, set: 2, pl: 14, pv: 11, hace: 40 },
    { sl: 0, sv: 0, set: 1, pl: 8, pv: 9, hace: 95 },
    { sl: 1, sv: 1, set: 3, pl: 12, pv: 12, hace: 20 },
    { sl: 0, sv: 1, set: 2, pl: 21, pv: 23, hace: 150 },
  ];
  return base.slice(0, 4).map((match, i) => ({
    match,
    setsLocal: muestras[i].sl,
    setsVisita: muestras[i].sv,
    setActual: muestras[i].set,
    puntosLocal: muestras[i].pl,
    puntosVisita: muestras[i].pv,
    actualizadoEn: ahora - muestras[i].hace * 1000,
  }));
}

function haceCuanto(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `hace ${s} segundos`;
  const m = Math.round(s / 60);
  return m === 1 ? "hace 1 minuto" : `hace ${m} minutos`;
}

function PuntoRojo() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
    </span>
  );
}

export function EnVivo({
  partidos,
  sponsors,
  getTeamById,
  abiertoAlInicio = false,
}: {
  partidos: PartidoEnVivo[];
  sponsors: Sponsor[];
  getTeamById: (id: string) => Team | undefined;
  /** Solo para las capturas del prototipo. */
  abiertoAlInicio?: boolean;
}) {
  const [abierto, setAbierto] = useState(abiertoAlInicio);
  // Re-dibuja cada 10 s para que "actualizado hace X" avance solo.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  if (partidos.length === 0) return null;

  return (
    <>
      {/* El aviso que se ve al cargar la página. */}
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-left transition-colors hover:bg-red-500/15"
      >
        <span className="flex items-center gap-3">
          <PuntoRojo />
          <span>
            <span className="block text-sm font-bold tracking-wide text-red-500">EN VIVO</span>
            <span className="block text-sm text-muted-foreground">
              {partidos.length === 1
                ? "1 partido jugándose ahora"
                : `${partidos.length} partidos jugándose ahora`}
            </span>
          </span>
        </span>
        <span className="text-sm font-semibold text-primary">Ver marcadores →</span>
      </button>

      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent side="bottom" className="flex max-h-[90dvh] flex-col gap-0 rounded-t-2xl p-0 sm:mx-auto sm:max-w-lg">
          <SheetHeader className="border-b pb-3">
            <SheetTitle className="flex items-center gap-2">
              <PuntoRojo /> En vivo
            </SheetTitle>
            <SheetDescription>
              {partidos.length === 1 ? "1 partido" : `${partidos.length} partidos`} jugándose ahora
            </SheetDescription>
          </SheetHeader>

          {/* Patrocinadores arriba, fijos: no se van con el scroll. */}
          {sponsors.length > 0 && (
            <div className="border-b px-4 py-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Patrocinadores
              </p>
              <div className="flex gap-2 overflow-x-auto">
                {sponsors.map((s) => (
                  <div
                    key={s.id}
                    className="h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-primary/30 bg-muted/30"
                  >
                    <img src={s.imageUrl} alt="Patrocinador" className="h-full w-full object-contain p-1.5" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Una tarjeta por partido, con scroll si son muchos. */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {partidos.map((p) => {
              const home = p.match.homeTeamId ? getTeamById(p.match.homeTeamId) : undefined;
              const away = p.match.awayTeamId ? getTeamById(p.match.awayTeamId) : undefined;
              const ganaLocal = p.setsLocal > p.setsVisita;
              const ganaVisita = p.setsVisita > p.setsLocal;
              return (
                <div
                  key={p.match.id}
                  className="space-y-2.5 rounded-xl border border-red-500/40 bg-gradient-to-b from-red-500/[0.06] to-transparent p-3"
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {[p.match.time ? formatTime12h(p.match.time) : null, p.match.venue]
                        .filter(Boolean)
                        .join(" · ") || "Hoy"}
                    </span>
                    <span className="flex items-center gap-1.5 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
                      <span className="h-1.5 w-1.5 rounded-full bg-white" /> EN VIVO
                    </span>
                  </div>

                  {[
                    { team: home, sets: p.setsLocal, gana: ganaLocal, pierde: ganaVisita },
                    { team: away, sets: p.setsVisita, gana: ganaVisita, pierde: ganaLocal },
                  ].map((fila, i) => (
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
                      Set {p.setActual}, jugándose
                    </span>
                    <span className="text-lg font-extrabold tabular-nums">
                      {p.puntosLocal} – {p.puntosVisita}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground">Actualizado {haceCuanto(p.actualizadoEn)}</p>
                </div>
              );
            })}
          </div>

          <div className="border-t p-3">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold text-primary"
            >
              <RefreshCw className="h-4 w-4" /> Actualizar
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
