import { getSportCategory, type Sport, type VolleyballSet } from "@/types";

/**
 * Marcador reglamentario de un partido ganado por W (walkover): el rival no se
 * presentó, o fue descalificado y quedaban partidos por jugar.
 *
 * Fuente única para las cuatro superficies que necesitan la regla:
 *   - la descalificación de un equipo (`disqualifyTeam`), que da por ganados
 *     los partidos pendientes,
 *   - el botón de W del organizador al cargar un resultado,
 *   - el botón de W del anotador con link,
 *   - los diálogos de "Sistema de Puntos" que le explican la regla al público.
 *
 * Los puntos de la tabla NO se deciden acá: salen de `getWinPoints(sport)` a
 * partir del marcador, así una W suma exactamente lo mismo que una victoria
 * normal (3 en fútbol y futsal, 2 en microfútbol).
 */
export interface WalkoverRule {
  /** Marcador del que se presentó. */
  winnerScore: number;
  /** Marcador del ausente. Siempre 0. */
  loserScore: number;
  /** Parciales de cada set. Solo vóley. */
  setPoints?: { winner: number; loser: number };
  /** Cuántos sets se dan por ganados. Solo vóley. */
  setCount?: number;
  /** Cómo se enuncia la regla en la UI. */
  description: string;
}

/** Parcial reglamentario de un set no jugado en vóley. */
const VOLLEYBALL_SET_POINTS = { winner: 25, loser: 0 };

export function getWalkoverRule(sport: Sport, bestOf?: 3 | 5): WalkoverRule {
  const category = getSportCategory(sport);

  if (category === "volleyball") {
    // Se ganan tantos sets como haga falta para llevarse el partido: 2 en
    // best-of-3, 3 en best-of-5. Cada uno con parcial de 25-0.
    const setCount = bestOf ? Math.ceil(bestOf / 2) : 2;
    return {
      winnerScore: setCount,
      loserScore: 0,
      setPoints: VOLLEYBALL_SET_POINTS,
      setCount,
      description: `${setCount} - 0 en sets, con parciales de ${VOLLEYBALL_SET_POINTS.winner}-${VOLLEYBALL_SET_POINTS.loser}`,
    };
  }

  if (category === "baseball") {
    return {
      winnerScore: 7,
      loserScore: 0,
      description: "7 - 0 en carreras",
    };
  }

  // Fútbol, futsal y microfútbol comparten el 3-0 reglamentario. Básquet y el
  // resto caen acá también: mantiene el comportamiento que ya tenía la
  // descalificación, que daba 3-0 a todo lo que no fuera vóley.
  return {
    winnerScore: 3,
    loserScore: 0,
    description: "3 - 0",
  };
}

/**
 * Sets a persistir para un walkover de vóley. Devuelve undefined para el resto
 * de los deportes, que no llevan parciales.
 */
export function buildWalkoverSets(
  rule: WalkoverRule,
  winnerIsHome: boolean
): VolleyballSet[] | undefined {
  if (!rule.setCount || !rule.setPoints) return undefined;

  return Array.from({ length: rule.setCount }, (_, i) => ({
    setNumber: i + 1,
    homePoints: winnerIsHome ? rule.setPoints!.winner : rule.setPoints!.loser,
    awayPoints: winnerIsHome ? rule.setPoints!.loser : rule.setPoints!.winner,
  }));
}
