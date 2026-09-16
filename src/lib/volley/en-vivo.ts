/**
 * El marcador en vivo: lo que comparten la planilla que lo manda, el servidor
 * que lo guarda y la página del torneo que lo muestra.
 *
 * Ver `Por hacer/deportes/voley/PLANILLA-EN-VIVO-PUBLICO.md`.
 */

import {
  type Lado,
  type Planilla,
  estadoDelSet,
  setsGanados,
} from "./planilla";

/** Cada cuánto manda la planilla si el marcador cambió. Es UNA constante a
 *  propósito: si el rendimiento lo pide (sección 4.1 del documento), pasar a
 *  60 segundos es cambiar este número y desplegar. */
export const ENVIO_EN_VIVO_CADA_MS = 30_000;

/** Cada cuánto manda aunque no pase nada, para que el partido no salga del en
 *  vivo en un set trabado. */
export const LATIDO_EN_VIVO_CADA_MS = 120_000;

/** Pasado esto sin un envío, el partido sale del en vivo. Vuelve solo con el
 *  próximo envío. */
export const EN_VIVO_VENCE_MS = 5 * 60_000;

/** Cada cuánto la página del torneo vuelve a preguntar. Igual a la copia
 *  compartida del servidor: preguntar más seguido traería la misma copia. */
export const REFRESCO_EN_VIVO_MS = 30_000;

/**
 * La foto del partido. Completa, no un incremento: si un envío se pierde, el
 * siguiente pone todo al día.
 */
export interface FotoEnVivo {
  /** Sets ganados por cada equipo. */
  sets: Record<Lado, number>;
  /** El set que se está jugando, o null entre dos sets. */
  setEnJuego: { n: number; home: number; away: number } | null;
}

/** Un partido en vivo, como lo devuelve la puerta del público. */
export interface PartidoEnVivoDato {
  matchId: string;
  foto: FotoEnVivo;
  /** Cuándo llegó el último envío, en ISO. */
  actualizadoEn: string;
}

/** Arma la foto a partir de la planilla. `null` si todavía no arrancó nada. */
export function fotoDeLaPlanilla(planilla: Planilla): FotoEnVivo | null {
  if (!planilla.setActual && planilla.setsCerrados.length === 0) return null;
  const set = planilla.setActual;
  const puntos = set ? estadoDelSet(set).puntos : null;
  return {
    sets: setsGanados(planilla),
    setEnJuego:
      set && puntos ? { n: set.numero, home: puntos.home, away: puntos.away } : null,
  };
}

function enteroEntre(v: unknown, min: number, max: number): boolean {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}

/** El link del planillero es público: se revisa que la foto sea una foto y no
 *  cualquier cosa. Devuelve la foto limpia o `null`. */
export function limpiarFoto(v: unknown): FotoEnVivo | null {
  if (!v || typeof v !== "object") return null;
  const f = v as Record<string, unknown>;
  const s = f.sets as Record<string, unknown> | undefined;
  if (!s || !enteroEntre(s.home, 0, 5) || !enteroEntre(s.away, 0, 5)) return null;
  let setEnJuego: FotoEnVivo["setEnJuego"] = null;
  if (f.setEnJuego !== null && f.setEnJuego !== undefined) {
    const c = f.setEnJuego as Record<string, unknown>;
    if (!enteroEntre(c.n, 1, 9) || !enteroEntre(c.home, 0, 99) || !enteroEntre(c.away, 0, 99)) {
      return null;
    }
    setEnJuego = { n: c.n as number, home: c.home as number, away: c.away as number };
  }
  return { sets: { home: s.home as number, away: s.away as number }, setEnJuego };
}

/**
 * Qué patrocinadores se ven en la vuelta `n` de la rotación.
 *
 * Siempre 3 (o todos, si son 3 o menos). De a 3 en orden y, cuando se acaban,
 * se sigue desde el principio. Con 5: ABC → DEA → BCD → EAB → CDE → ABC. En una
 * vuelta completa todos salen la misma cantidad de veces. Devuelve índices.
 */
export const PATROCINADORES_VISIBLES = 3;
export const ROTACION_PATROCINADORES_MS = 120_000;

export function grupoDePatrocinadores(total: number, n: number): number[] {
  if (total <= PATROCINADORES_VISIBLES) {
    return Array.from({ length: total }, (_, i) => i);
  }
  return Array.from(
    { length: PATROCINADORES_VISIBLES },
    (_, k) => (n * PATROCINADORES_VISIBLES + k) % total
  );
}
