"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { Sponsor, Team, Tournament } from "@/types";
import type { PartidoEnVivoDato } from "@/lib/volley/en-vivo";

/**
 * El marcador en vivo del público: el aviso "EN VIVO" en la página del torneo.
 *
 * Diseño aprobado por el dueño el 2026-09-16: al cargar la página, un aviso con
 * cuántos partidos se están jugando. Al tocarlo se abre una hoja con los
 * patrocinadores arriba y una tarjeta por partido abajo, con scroll.
 *
 * Si no hay ningún partido en vivo no se dibuja nada: la página queda como
 * siempre.
 *
 * Ver `Por hacer/deportes/voley/PLANILLA-EN-VIVO-PUBLICO.md`.
 */

// La hoja se baja recién cuando alguien toca el aviso: el que no la abre no
// paga nada por ella (sección 6.1 del documento).
const HojaEnVivo = dynamic(() => import("./en-vivo-hoja"), { ssr: false });

function PuntoRojo() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
    </span>
  );
}

export function EnVivo({
  tournament,
  partidos,
  sponsors,
  getTeamById,
  abiertoAlInicio = false,
}: {
  tournament: Tournament;
  partidos: PartidoEnVivoDato[];
  sponsors: Sponsor[];
  getTeamById: (id: string) => Team | undefined;
  /** Solo para las capturas del prototipo. */
  abiertoAlInicio?: boolean;
}) {
  const [abierto, setAbierto] = useState(abiertoAlInicio);
  // Una vez abierta se deja montada, para que cerrar tenga su animación.
  const [montada, setMontada] = useState(abiertoAlInicio);

  // Solo los partidos que la página conoce: una foto de un partido borrado o de
  // otro torneo no tiene equipos que mostrar.
  const visibles = partidos.filter((p) =>
    tournament.matches.some((m) => m.id === p.matchId)
  );
  if (visibles.length === 0) return null;

  const cuantos =
    visibles.length === 1
      ? "1 partido jugándose ahora"
      : `${visibles.length} partidos jugándose ahora`;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMontada(true);
          setAbierto(true);
        }}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-left transition-colors hover:bg-red-500/15"
      >
        <span className="flex items-center gap-3">
          <PuntoRojo />
          <span>
            <span className="block text-sm font-bold tracking-wide text-red-500">EN VIVO</span>
            <span className="block text-sm text-muted-foreground">{cuantos}</span>
          </span>
        </span>
        <span className="text-sm font-semibold text-primary">Ver marcadores →</span>
      </button>

      {montada && (
        <HojaEnVivo
          abierto={abierto}
          onOpenChange={setAbierto}
          titulo={cuantos}
          tournament={tournament}
          partidos={visibles}
          sponsors={sponsors}
          getTeamById={getTeamById}
        />
      )}
    </>
  );
}

/**
 * Marcadores INVENTADOS sobre partidos reales, para ver la pantalla en local
 * con `?envivo=demo`. Nunca se usa en producción.
 */
export function partidosDeMuestra(tournament: Tournament): PartidoEnVivoDato[] {
  const conEquipos = tournament.matches.filter((m) => m.homeTeamId && m.awayTeamId);
  const sinJugar = conEquipos.filter((m) => m.status !== "completed");
  const base = sinJugar.length > 0 ? sinJugar : conEquipos;
  const ahora = Date.now();
  const muestras = [
    { sl: 1, sv: 0, set: 2, pl: 14, pv: 11, hace: 20 },
    { sl: 0, sv: 0, set: 1, pl: 8, pv: 9, hace: 45 },
    { sl: 1, sv: 1, set: 3, pl: 12, pv: 12, hace: 120 },
    { sl: 0, sv: 1, set: 2, pl: 21, pv: 23, hace: 150 },
  ];
  return base.slice(0, muestras.length).map((m, i) => ({
    matchId: m.id,
    foto: {
      sets: { home: muestras[i].sl, away: muestras[i].sv },
      setEnJuego: { n: muestras[i].set, home: muestras[i].pl, away: muestras[i].pv },
    },
    actualizadoEn: new Date(ahora - muestras[i].hace * 1000).toISOString(),
  }));
}
