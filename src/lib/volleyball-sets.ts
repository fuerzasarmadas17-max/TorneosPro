/**
 * La regla de los sets de vóley, en un solo lugar.
 *
 * En vóley el marcador del partido ES la cuenta de sets ganados: un 2-1 son
 * exactamente tres sets, dos de uno y uno del otro. Si el resultado y los sets
 * no dicen lo mismo, uno de los dos está mal — y como la tabla de posiciones
 * desempata por ratio de sets y de puntos, un partido cargado a medias
 * desordena todo el torneo sin que nadie note por qué.
 *
 * El empate SÍ existe: en los relámpagos de dos y tres días es práctica común
 * cortar el partido con la serie igualada (1-1 en un partido a 3, 1-1 o 2-2 en
 * uno a 5). Lo que no existe es el empate en playoffs, porque ahí alguien tiene
 * que pasar de ronda, ni el 0-0, que no es un empate sino un partido sin cargar.
 *
 * Vive suelto acá porque lo usan TRES lugares y tienen que decir exactamente lo
 * mismo: el formulario del organizador, la pantalla del planillero externo, y
 * la ruta del servidor que recibe de ese link. Los dos primeros son comodidad;
 * el tercero es el que de verdad protege, porque un link de planillero es un
 * endpoint público y no se le puede creer nada al navegador.
 */

import { MAX_SET_POINTS } from "@/lib/score-errors";

export interface SetScore {
  homePoints: number;
  awayPoints: number;
}

export interface VolleyballRules {
  /** Sets que hay que ganar para llevarse el partido: 2 en uno a 3, 3 en uno
   *  a 5. Es `Math.ceil(bestOf / 2)`. */
  setsToWin: number;
  /** Si la serie puede quedar igualada. Falso en playoffs. */
  allowDraw: boolean;
}

/**
 * ¿Se puede empatar este partido?
 *
 * Solo en fase de grupos y liga. En un cuadro de eliminación un empate deja la
 * llave trabada —nadie pasa—, así que ahí se rechaza de entrada en vez de
 * dejar el torneo a medio resolver.
 */
export function volleyballDrawAllowed(
  format: string | null | undefined,
  phase: string | null | undefined
): boolean {
  return format !== "elimination" && phase !== "playoff";
}

/** Cuántos sets se juegan con un marcador dado. Un 2-1 son 3, un 1-1 son 2. */
export function setsForScore(homeScore: number, awayScore: number): number {
  return homeScore + awayScore;
}

/**
 * Devuelve el mensaje de error, o `null` si está todo bien.
 *
 * El mensaje se le muestra tal cual a quien está cargando, así que dice qué
 * pasó y con qué números, no "datos inválidos".
 */
export function validateVolleyballSets(
  homeScore: number,
  awayScore: number,
  sets: SetScore[],
  rules: VolleyballRules
): string | null {
  const { setsToWin, allowDraw } = rules;

  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) ||
      homeScore < 0 || awayScore < 0) {
    return "El resultado del partido tiene que ser dos números.";
  }

  const total = setsForScore(homeScore, awayScore);

  // Cubre el 0-0: no es un empate, es un partido que nadie cargó.
  if (total === 0) {
    return "Cargá el resultado del partido en sets (por ejemplo 2-1).";
  }

  // Un marcador imposible se rechaza ANTES de pedir los sets: si no, un 3-1 en
  // un partido a 3 contestaría "falta el marcador de cada set", que manda a
  // corregir donde no está el problema.
  const maxSets = setsToWin * 2 - 1;
  if (total > maxSets) {
    return `En un partido a ${maxSets} sets no existe un ${homeScore}-${awayScore}.`;
  }

  if (sets.length === 0) {
    return "Falta el marcador de cada set. En vóley el resultado no se puede guardar sin ellos.";
  }

  for (let i = 0; i < sets.length; i++) {
    const s = sets[i];
    if (
      !Number.isInteger(s.homePoints) || !Number.isInteger(s.awayPoints) ||
      s.homePoints < 0 || s.awayPoints < 0
    ) {
      return `Set ${i + 1}: faltan los puntos de alguno de los dos equipos.`;
    }
    if (s.homePoints === 0 && s.awayPoints === 0) {
      return `Set ${i + 1}: falta cargarlo. Si ese set no se jugó, corregí el resultado del partido.`;
    }
    if (s.homePoints === s.awayPoints) {
      return `Set ${i + 1}: un set no puede terminar empatado (${s.homePoints}-${s.awayPoints}).`;
    }
  }

  // El caso que más se equivoca: cargar un 2-0 y dejar tres sets escritos, o
  // un 2-1 con solo dos. La cuenta no admite interpretación.
  if (sets.length !== total) {
    return `Un ${homeScore}-${awayScore} son ${total} ${total === 1 ? "set" : "sets"}, y cargaste ${sets.length}.`;
  }

  const homeWon = sets.filter((s) => s.homePoints > s.awayPoints).length;
  const awayWon = sets.length - homeWon;

  if (homeWon !== homeScore || awayWon !== awayScore) {
    return `Los sets que cargaste dan ${homeWon}-${awayWon}, pero el resultado dice ${homeScore}-${awayScore}. Tienen que coincidir.`;
  }

  // Hasta acá el marcador es coherente consigo mismo. Falta lo otro: que sea un
  // resultado posible en un partido a `setsToWin`. Sin esto entra un 3-1 en un
  // partido a 3 sets, que cuadra pero no existe.
  if (homeScore === awayScore) {
    if (!allowDraw) {
      return "En esta fase el partido no puede quedar empatado: alguno de los dos tiene que pasar de ronda.";
    }
    if (homeScore >= setsToWin) {
      return `Un empate no puede llegar a ${setsToWin} sets: el que llega ${setsToWin} ya ganó el partido.`;
    }
    return null;
  }

  const ganador = Math.max(homeScore, awayScore);
  if (ganador !== setsToWin) {
    return `En un partido a ${setsToWin * 2 - 1} sets el ganador se lleva ${setsToWin}, y cargaste ${homeScore}-${awayScore}.`;
  }

  return null;
}

/** Puntos con los que se cierra un set normal, y el decisivo (el último de un
 *  partido que llegó al final). Se usan solo para AVISAR: hay relámpagos que
 *  juegan los sets a 21 o a 15, y bloquearlos dejaría al organizador sin poder
 *  cargar su propio torneo. */
export const SET_TARGET_POINTS = 25;
export const DECIDING_SET_TARGET_POINTS = 15;

export interface SetWarning {
  setNumber: number;
  message: string;
}

/**
 * Avisos de los parciales: lo que probablemente esté mal tipeado, pero que no
 * se puede afirmar. No bloquean el guardado.
 *
 * Un 25-24 casi siempre es un 25-23 mal escrito, porque un set se gana por dos
 * de diferencia. Y un 21-19 puede ser un set jugado a 21 —perfectamente
 * normal en un relámpago— o un 25-19 al que le comieron un dígito. Se avisa y
 * decide quien está mirando la planilla.
 */
export function volleyballSetWarnings(
  sets: SetScore[],
  setsToWin: number
): SetWarning[] {
  const maxSets = setsToWin * 2 - 1;
  const warnings: SetWarning[] = [];

  for (let i = 0; i < sets.length; i++) {
    const s = sets[i];
    if (
      !Number.isInteger(s.homePoints) || !Number.isInteger(s.awayPoints) ||
      s.homePoints < 0 || s.awayPoints < 0 ||
      s.homePoints === s.awayPoints
    ) {
      continue; // Lo agarra la validación que sí bloquea.
    }

    const isDeciding = sets.length === maxSets && i === sets.length - 1;
    const target = isDeciding ? DECIDING_SET_TARGET_POINTS : SET_TARGET_POINTS;
    const ganador = Math.max(s.homePoints, s.awayPoints);
    const parcial = `${s.homePoints}-${s.awayPoints}`;

    if (ganador < target) {
      warnings.push({
        setNumber: i + 1,
        message: isDeciding
          ? `Set ${i + 1}: el set decisivo se juega a ${target}, y cargaste ${parcial}.`
          : `Set ${i + 1}: un set se gana llegando a ${target}, y cargaste ${parcial}.`,
      });
      continue;
    }

    if (ganador - Math.min(s.homePoints, s.awayPoints) < 2) {
      warnings.push({
        setNumber: i + 1,
        message: `Set ${i + 1}: un set se gana por dos puntos de diferencia, y cargaste ${parcial}.`,
      });
    }
  }

  return warnings;
}

export interface SetPointsSide {
  /** Lo que hay escrito en la casilla, tal cual. */
  raw: string;
  /** Nombre del equipo, para nombrarlo en el error. */
  teamName: string;
}

/**
 * Valida las dos casillas de puntos de UN set.
 *
 * Antes decía "faltan los puntos de alguno de los dos equipos", que obliga a
 * mirar las dos casillas para encontrar la vacía. Ahora nombra la que falta.
 */
export function parseSetPoints(
  setNumber: number,
  home: SetPointsSide,
  away: SetPointsSide
):
  | { ok: true; homePoints: number; awayPoints: number }
  | { ok: false; error: string } {
  const sides: [SetPointsSide, "home" | "away"][] = [
    [home, "home"],
    [away, "away"],
  ];
  const values: Record<"home" | "away", number> = { home: 0, away: 0 };

  for (const [side, key] of sides) {
    const raw = side.raw.trim();
    if (raw === "") {
      return {
        ok: false,
        error: `Set ${setNumber}: faltan los puntos de ${side.teamName}.`,
      };
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      return {
        ok: false,
        error: `Set ${setNumber}: los puntos de ${side.teamName} tienen que ser un número.`,
      };
    }
    if (n < 0) {
      return {
        ok: false,
        error: `Set ${setNumber}: los puntos de ${side.teamName} no pueden ser negativos.`,
      };
    }
    if (!Number.isInteger(n)) {
      return {
        ok: false,
        error: `Set ${setNumber}: los puntos de ${side.teamName} tienen que ser un número entero, sin decimales.`,
      };
    }
    if (n > MAX_SET_POINTS) {
      return {
        ok: false,
        error: `Set ${setNumber}: ${n} puntos de ${side.teamName} no parece un parcial real. Revisá el número.`,
      };
    }
    values[key] = n;
  }

  return { ok: true, homePoints: values.home, awayPoints: values.away };
}
