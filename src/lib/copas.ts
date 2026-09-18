import { Match, Tournament, TournamentCup } from "@/types";
import {
  ClassifiedTeam,
  fairPlayEnabled,
  getCupChampion,
  getCupFinalFormat,
  nextPowerOf2,
  rankTeamsInGroup,
} from "@/data/helpers";

/**
 * Torneo con varias copas: después de los grupos, en vez de una sola llave hay
 * varias en paralelo, cada una alimentada por un bloque de puestos de cada
 * grupo (Oro ← 1º y 2º, Plata ← 3º y 4º…). El puesto que no reclama ninguna
 * copa se va a casa.
 *
 * Todo el diseño y las decisiones del dueño están en
 * `Por hacer/torneos/grupos-y-copas.md`. Lo que se calcula del campeón y de la
 * final de cada copa vive en `src/data/helpers.ts`, al lado de la llave única.
 */

/** Tope de copas "como para probar" (decisión del 2026-09-16). La base aguanta
 *  6: subirlo es cambiar este número, no correr otra migración. */
export const MAX_CUPS = 3;

/** Nombres que vienen puestos, en orden. El organizador los cambia si quiere. */
export const DEFAULT_CUP_NAMES = [
  "Copa Oro",
  "Copa Plata",
  "Copa Bronce",
  "Copa Estaño",
  "Copa Hierro",
  "Copa Madera",
];

export type CupDraft = Omit<TournamentCup, "id">;

/** Los grupos que alimentan las copas. En la v1 hay una sola fase de grupos
 *  antes de las copas, así que son los de la fase 1. */
function feedingGroups(tournament: Tournament) {
  return (tournament.groups ?? []).filter((g) => (g.phase ?? 1) === 1);
}

/**
 * ¿Este torneo puede jugarse con copas? Tiene que ser de grupos + playoffs y
 * de una sola fase de grupos: copas después de dos fases no van en la v1.
 */
export function canUseCups(tournament: Tournament): boolean {
  if (tournament.format !== "group-playoff") return false;
  if (feedingGroups(tournament).length === 0) return false;
  if ((tournament.groups ?? []).some((g) => (g.phase ?? 1) > 1)) return false;
  if (tournament.phaseConfigs?.some((pc) => pc.nextGroupCount)) return false;
  return true;
}

/** ¿Ya se puede cambiar la lista de copas? Mientras ninguna llave tenga un
 *  equipo puesto ni un resultado: cambiarlas borra las llaves. */
export function canEditCups(tournament: Tournament): boolean {
  return !tournament.matches.some(
    (m) =>
      m.phase === "playoff" &&
      (m.homeTeamId ||
        m.awayTeamId ||
        m.status === "completed" ||
        m.homeScore != null ||
        m.awayScore != null)
  );
}

/**
 * La tabla de un grupo, sin los descalificados. Un descalificado queda al
 * fondo y no entra a ninguna copa (7a del doc): sacarlo de la lista es lo
 * mismo, y así los puestos de los demás quedan como en la tabla.
 */
function rankedWithoutDisqualified(tournament: Tournament, groupId: string): string[] {
  const group = feedingGroups(tournament).find((g) => g.id === groupId);
  if (!group) return [];
  const dq = new Set(tournament.disqualifiedTeamIds ?? []);
  const groupMatches = tournament.matches.filter(
    (m) => m.phase === "group" && m.groupId === group.id
  );
  return rankTeamsInGroup(
    group.teamIds,
    groupMatches,
    tournament.sport,
    fairPlayEnabled(tournament)
  ).filter((id) => !dq.has(id));
}

/**
 * Los clasificados de una copa, en el orden en que se siembran: los de puesto
 * más alto primero, intercalando grupos (3ºA, 3ºB, 4ºA, 4ºB para una Plata de
 * 3º a 4º). Es lo mismo que `getClassifiedTeamsRanked` para la llave única,
 * pero con un rango de puestos en vez de "los N primeros".
 */
export function getCupClassified(
  tournament: Tournament,
  cup: Pick<TournamentCup, "positionFrom" | "positionTo">
): ClassifiedTeam[] {
  const groups = feedingGroups(tournament);
  const ranked = groups.map((g) => ({
    group: g,
    ids: rankedWithoutDisqualified(tournament, g.id),
  }));
  const out: ClassifiedTeam[] = [];
  for (let pos = cup.positionFrom; pos <= cup.positionTo; pos++) {
    for (const { group, ids } of ranked) {
      const teamId = ids[pos - 1];
      if (!teamId) continue;
      out.push({
        teamId,
        fromGroupId: group.id,
        fromGroupName: group.name,
        position: pos,
      });
    }
  }
  return out;
}

export interface CupPreview {
  cup: CupDraft;
  /** Cuántos equipos van a entrar. */
  teams: number;
  /** Descansos en la primera ronda (la llave se completa a potencia de 2). */
  byes: number;
  /** Descalificados que habrían caído en esta copa y no entran. */
  disqualifiedTeamIds: string[];
}

/**
 * Cómo quedaría cada copa con los grupos como están hoy. Es el aviso de antes
 * de generar (4.3 del doc): una copa coja por grupos desparejos o por un
 * descalificado se tiene que ver antes, no cuando el bracket ya salió raro.
 *
 * Los conteos no dependen de quién va primero, así que sirve también con los
 * grupos a medio jugar.
 */
export function previewCups(tournament: Tournament, cups: CupDraft[]): CupPreview[] {
  const dq = new Set(tournament.disqualifiedTeamIds ?? []);
  const groups = feedingGroups(tournament);
  return cups.map((cup) => {
    let teams = 0;
    const disqualifiedTeamIds: string[] = [];
    for (const g of groups) {
      const activos = g.teamIds.filter((id) => !dq.has(id)).length;
      for (let pos = cup.positionFrom; pos <= cup.positionTo; pos++) {
        if (pos <= activos) teams++;
      }
      // Los descalificados van al fondo, en el orden en que están en el grupo.
      const dqDelGrupo = g.teamIds.filter((id) => dq.has(id));
      dqDelGrupo.forEach((id, i) => {
        const pos = activos + i + 1;
        if (pos >= cup.positionFrom && pos <= cup.positionTo) {
          disqualifiedTeamIds.push(id);
        }
      });
    }
    const byes = teams >= 2 ? nextPowerOf2(teams) - teams : 0;
    return { cup, teams, byes, disqualifiedTeamIds };
  });
}

/** El grupo más grande: ningún puesto de copa puede pasarse de ahí. */
function largestGroupSize(tournament: Tournament): number {
  return Math.max(0, ...feedingGroups(tournament).map((g) => g.teamIds.length));
}

/**
 * Copas propuestas para arrancar: bloques de 2 puestos (Oro 1-2, Plata 3-4,
 * Bronce 5-6), o de 1 si los grupos son chicos para tantas copas.
 */
export function defaultCups(tournament: Tournament, count: number): CupDraft[] {
  const n = Math.max(2, Math.min(MAX_CUPS, count));
  const block = largestGroupSize(tournament) >= n * 2 ? 2 : 1;
  return Array.from({ length: n }, (_, i) => ({
    name: DEFAULT_CUP_NAMES[i],
    sortOrder: i + 1,
    positionFrom: i * block + 1,
    positionTo: i * block + block,
  }));
}

/**
 * Lo que está mal en la lista de copas, en palabras para el organizador, o
 * null si está bien. Los mismos candados están en la base; acá se revisan
 * antes para poder explicar el problema en vez de mostrar un error.
 */
export function validateCups(tournament: Tournament, cups: CupDraft[]): string | null {
  if (cups.length < 2) return "Tiene que haber al menos 2 copas.";
  if (cups.length > MAX_CUPS) return `Por ahora el máximo es ${MAX_CUPS} copas.`;

  const nombres = new Set<string>();
  for (const c of cups) {
    const nombre = c.name.trim();
    if (!nombre) return "Todas las copas tienen que tener nombre.";
    const clave = nombre.toLocaleLowerCase("es");
    if (nombres.has(clave)) return `Hay dos copas que se llaman "${nombre}".`;
    nombres.add(clave);
  }

  const maxPuesto = largestGroupSize(tournament);
  for (const c of cups) {
    if (!Number.isInteger(c.positionFrom) || !Number.isInteger(c.positionTo) || c.positionFrom < 1) {
      return `Revisá los puestos de ${c.name.trim()}.`;
    }
    if (c.positionTo < c.positionFrom) {
      return `En ${c.name.trim()} el puesto "hasta" no puede ser menor que el "desde".`;
    }
    if (c.positionFrom > maxPuesto) {
      return `Ningún grupo tiene ${c.positionFrom} equipos: ${c.name.trim()} quedaría vacía.`;
    }
  }

  const ordenadas = [...cups].sort((a, b) => a.positionFrom - b.positionFrom);
  for (let i = 1; i < ordenadas.length; i++) {
    const prev = ordenadas[i - 1];
    const cur = ordenadas[i];
    if (cur.positionFrom <= prev.positionTo) {
      return `${prev.name.trim()} y ${cur.name.trim()} se pisan: un mismo puesto no puede ir a dos copas.`;
    }
  }

  for (const p of previewCups(tournament, cups)) {
    if (p.teams < 2) {
      return `${p.cup.name.trim()} quedaría con ${p.teams === 0 ? "ningún equipo" : "un solo equipo"}. Cada copa necesita al menos 2.`;
    }
  }
  return null;
}

/** La copa de un partido, si es de una copa. */
export function getMatchCup(tournament: Tournament, match: Match): TournamentCup | undefined {
  if (!match.cupId) return undefined;
  return tournament.cups?.find((c) => c.id === match.cupId);
}

/**
 * El torneo visto desde una copa: los partidos de grupos más la llave de esa
 * copa, y el formato de la final como hay que leerlo hoy en esa copa. Con esto
 * las pantallas de la llave única (el bracket, el armador de cruces) sirven
 * tal cual para cada copa.
 *
 * Ojo: no pasarle esto a `getFinalSeriesChampion`. El campeón de una copa se
 * pide con `getCupChampion` sobre el torneo entero.
 */
export function scopeToCup(tournament: Tournament, cup: TournamentCup): Tournament {
  const size = getCupClassified(tournament, cup).length;
  return {
    ...tournament,
    matches: tournament.matches.filter(
      (m) => m.phase !== "playoff" || m.cupId === cup.id
    ),
    cups: [cup],
    playoffFinalFormat: getCupFinalFormat(tournament, cup.id),
    playoffConfig: {
      advancePerGroup: cup.positionTo - cup.positionFrom + 1,
      totalAdvancing: size,
    },
  };
}

/** Las copas con su campeón (null si su final no terminó), en orden. */
export function getCupChampions(
  tournament: Tournament
): { cup: TournamentCup; championId: string | null }[] {
  return (tournament.cups ?? []).map((cup) => ({
    cup,
    championId: getCupChampion(tournament, cup.id),
  }));
}
