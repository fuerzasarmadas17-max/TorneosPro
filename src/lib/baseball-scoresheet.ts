import { MatchEventType, getStatDefinition } from "@/types";

/**
 * Lógica compartida de la planilla (scoresheet) de béisbol/softball/wiffleball.
 *
 * La usan tanto el organizador (match-result-form) como el link de anotador
 * (score/[token]) para que la convención de hits sea idéntica en ambos lados.
 *
 * Convención MLB: la celda "H" es el TOTAL de hits del bateador (incluye
 * sencillos, 2B, 3B y HR). Los extra-base (double/triple/home_run) son un
 * subset que se cuenta aparte. Los sencillos no se almacenan: se deducen
 * como `hit - double - triple - home_run`.
 */

export interface PlayerStats {
  [statKey: string]: number;
}

/** Evento mínimo necesario para reconstruir/serializar la planilla. */
export interface ScoresheetEvent {
  teamId: string;
  playerName: string;
  type: MatchEventType;
}

const HIT_TYPES: MatchEventType[] = ["hit", "double", "triple", "home_run"];

/**
 * Reconstruye la matriz jugador×stat desde los eventos guardados de un equipo.
 * Cualquier hit suma al total `H`; los extra-base además guardan su tipo.
 */
export function buildScoresheetData(
  events: ReadonlyArray<ScoresheetEvent>,
  teamId: string | null
): Record<string, PlayerStats> {
  if (!teamId) return {};
  const data: Record<string, PlayerStats> = {};
  for (const e of events) {
    if (e.teamId !== teamId) continue;
    if (!data[e.playerName]) data[e.playerName] = {};
    const player = data[e.playerName];
    if (HIT_TYPES.includes(e.type)) {
      player.hit = (player.hit ?? 0) + 1;
    }
    if (e.type === "double" || e.type === "triple" || e.type === "home_run") {
      player[e.type] = (player[e.type] ?? 0) + 1;
      continue;
    }
    if (e.type !== "hit") {
      player[e.type] = (player[e.type] ?? 0) + 1;
    }
  }
  return data;
}

/**
 * Expande la matriz jugador×stat de un equipo a eventos individuales.
 * Resta los extra-base del total H para no inflar el conteo (la app cuenta
 * cada event hit/double/triple/home_run como hit). Si H_total < 2B+3B+HR,
 * fuerza sencillos a 0 (el scoresheet ya muestra la advertencia visual).
 */
export function buildScoresheetEventsForTeam(
  data: Record<string, PlayerStats>,
  teamId: string | null,
  players: ReadonlyArray<{ name: string }>,
  stats: MatchEventType[]
): ScoresheetEvent[] {
  if (!teamId) return [];
  const nonComputedStats = stats.filter((s) => !getStatDefinition(s)?.computed);
  const events: ScoresheetEvent[] = [];
  for (const player of players) {
    const v = data[player.name] || {};
    const hTotal = v.hit || 0;
    const singlesOnly = Math.max(
      0,
      hTotal - (v.double || 0) - (v.triple || 0) - (v.home_run || 0)
    );
    for (const statKey of nonComputedStats) {
      const count = statKey === "hit" ? singlesOnly : v[statKey] || 0;
      for (let i = 0; i < count; i++) {
        events.push({ teamId, playerName: player.name, type: statKey });
      }
    }
  }
  return events;
}
