/**
 * Los mensajes de error del marcador, en un solo lugar.
 *
 * Antes cada pantalla tenía el suyo y todos decían lo mismo: "Ingresa
 * marcadores validos". Ese mensaje no sirve, porque el error más común no es
 * escribir algo inválido sino dejar una casilla vacía —un 4-0 cargado como "4"
 * y nada— y ahí lo único que hace falta decir es qué equipo quedó sin marcador.
 *
 * Vive suelto acá porque lo usan TRES lugares que tienen que decir exactamente
 * lo mismo: el formulario del organizador, la pantalla del planillero externo,
 * y la ruta del servidor que recibe de ese link. Los dos primeros son
 * comodidad; el tercero es el que de verdad protege, porque un link de
 * planillero es un endpoint público y no se le puede creer nada al navegador.
 */

import { getSportCategory, type Sport } from "@/types";
import { getSportInfo } from "@/data/sports";

/** Cómo se llama lo que se anota, para nombrarlo en el error. */
export type ScoringUnit = "goles" | "puntos" | "carreras" | "sets";

/** Tope del marcador de un partido normal. Es el mismo que exige el servidor
 *  en la ruta del planillero: si el formulario dejara pasar más, el organizador
 *  vería un error recién al guardar. */
export const MAX_SCORE = 999;

/** Tope del marcador cuando el marcador son sets. Nadie gana ocho sets. */
export const MAX_SET_SCORE = 7;

/** Puntos máximos de un set. Mismo tope que exige el servidor. */
export const MAX_SET_POINTS = 99;

export function scoringUnitFor(sport: Sport | undefined | null): ScoringUnit {
  const unit = sport ? getSportInfo(sport)?.scoringUnit : undefined;
  if (unit === "goles" || unit === "carreras" || unit === "sets") return unit;
  return "puntos";
}

/** ¿En este deporte el marcador ES la cuenta de sets? Vóley, tenis, pádel y
 *  ping pong. */
export function scoresBySets(sport: Sport | undefined | null): boolean {
  return sport ? scoringUnitFor(sport) === "sets" : false;
}

export interface ScoreSide {
  /** Lo que hay escrito en la casilla, tal cual. */
  raw: string;
  /** Nombre del equipo, para nombrarlo en el error. */
  teamName: string;
}

export type ScoreParse =
  | { ok: true; home: number; away: number }
  | { ok: false; error: string };

function missingMessage(teamName: string, unit: ScoringUnit): string {
  if (unit === "sets") {
    return `Falta cuántos sets ganó ${teamName}. Si no ganó ninguno, escribí 0.`;
  }
  return `Falta el marcador de ${teamName}. Si no hizo ${unit}, escribí 0.`;
}

/** Valida UNA casilla. Devuelve el número, o el mensaje de lo que le falta. */
function parseSide(
  side: ScoreSide,
  unit: ScoringUnit,
  max: number
): { ok: true; value: number } | { ok: false; error: string } {
  const raw = side.raw.trim();

  if (raw === "") {
    return { ok: false, error: missingMessage(side.teamName, unit) };
  }

  const n = Number(raw);

  if (!Number.isFinite(n)) {
    return {
      ok: false,
      error: `El marcador solo acepta números. Revisá lo que escribiste en ${side.teamName}.`,
    };
  }
  if (n < 0) {
    return {
      ok: false,
      error: `El marcador de ${side.teamName} no puede ser negativo.`,
    };
  }
  // parseInt recortaba el 3.5 a 3 sin decir nada, y el resultado quedaba mal
  // cargado para siempre. Mejor frenar y que lo corrija quien está mirando.
  if (!Number.isInteger(n)) {
    return {
      ok: false,
      error: `El marcador de ${side.teamName} tiene que ser un número entero, sin decimales.`,
    };
  }
  if (n > max) {
    return {
      ok: false,
      error: `${n} ${unit} de ${side.teamName} no parece un marcador real. Revisá el número.`,
    };
  }

  return { ok: true, value: n };
}

/**
 * Valida el marcador de los dos equipos.
 *
 * El orden importa: primero las dos casillas vacías juntas (un mensaje solo),
 * después cada una por separado. Si no, cargar un partido en blanco contestaría
 * dos veces lo mismo.
 */
export function parseMatchScore(
  home: ScoreSide,
  away: ScoreSide,
  unit: ScoringUnit = "puntos"
): ScoreParse {
  const max = unit === "sets" ? MAX_SET_SCORE : MAX_SCORE;

  if (home.raw.trim() === "" && away.raw.trim() === "") {
    return {
      ok: false,
      error:
        unit === "sets"
          ? "Cargá el resultado del partido en sets (por ejemplo 2-1)."
          : "Falta el marcador de los dos equipos.",
    };
  }

  const h = parseSide(home, unit, max);
  if (!h.ok) return { ok: false, error: h.error };

  const a = parseSide(away, unit, max);
  if (!a.ok) return { ok: false, error: a.error };

  return { ok: true, home: h.value, away: a.value };
}

/**
 * Tenis, pádel y ping pong: el marcador ES la cuenta de sets, igual que en
 * vóley, pero acá no se guardan los parciales ni el "mejor de" del torneo.
 * Entonces solo se valida lo que es cierto en cualquier formato: que alguien
 * haya ganado, y que la cuenta de sets sea de este planeta.
 */
export function validateRacketScore(
  homeScore: number,
  awayScore: number
): string | null {
  const total = homeScore + awayScore;

  if (total === 0) {
    return "Cargá el resultado del partido en sets (por ejemplo 2-1).";
  }
  if (homeScore === awayScore) {
    return `Un partido a sets no puede quedar ${homeScore}-${awayScore}: alguno de los dos se lo llevó.`;
  }
  if (total > MAX_SET_SCORE) {
    return `Un partido no llega a ${total} sets, y cargaste ${homeScore}-${awayScore}. Revisá el marcador.`;
  }
  // El formato más largo que se juega es a 7 sets, y ahí el ganador se lleva 4.
  if (Math.max(homeScore, awayScore) > 4) {
    return `Nadie gana ${Math.max(homeScore, awayScore)} sets en un partido, y cargaste ${homeScore}-${awayScore}. Revisá el marcador.`;
  }

  return null;
}

/**
 * Básquet: no hay empate. Si el tiempo reglamentario termina igual se juegan
 * tiempos extra hasta que alguien gane, así que un 70-70 es un marcador mal
 * cargado o un partido que todavía no terminó.
 */
export function validateBasketballScore(
  homeScore: number,
  awayScore: number
): string | null {
  if (homeScore === awayScore) {
    return `En básquet no hay empate: un partido no puede terminar ${homeScore}-${awayScore}. Si terminaron iguales se juega tiempo extra; cargá el marcador final.`;
  }
  return null;
}

/**
 * La validación completa del marcador para los deportes que NO son vóley
 * (vóley tiene la suya en lib/volleyball-sets.ts, porque además cuadra los
 * parciales). Devuelve el marcador listo para guardar, o el mensaje.
 */
export function validateScoreForSport(
  home: ScoreSide,
  away: ScoreSide,
  sport: Sport | undefined | null
): ScoreParse {
  const unit = scoringUnitFor(sport);
  const parsed = parseMatchScore(home, away, unit);
  if (!parsed.ok) return parsed;

  // Raqueta: el marcador son sets y no hay empate posible.
  if (sport && getSportCategory(sport) === "no-stats") {
    const error = validateRacketScore(parsed.home, parsed.away);
    if (error) return { ok: false, error };
  }

  if (sport && getSportCategory(sport) === "basketball") {
    const error = validateBasketballScore(parsed.home, parsed.away);
    if (error) return { ok: false, error };
  }

  return parsed;
}
