import { useMemo } from "react";
import { Match, MatchEventType, Tournament, TournamentGroup, getStatDefinition, getSportCategory } from "@/types";
import { normalizePlayerName } from "@/lib/name-utils";

// Apariciones al plato requeridas por partido jugado para calificar al
// ranking de bateadores (beisbol/softball/wiffleball). La MLB usa 3.1
// (502 PA en 162 juegos); bajamos a 2.7 por lo corto de estas ligas.
const QUALIFY_RATE = 2.7;

// Fracción de los partidos del equipo en que un jugador debe haber
// participado para calificar al ranking DEFENSIVO (Líderes Defensiva). A
// diferencia del bateo, la defensa NO se puede calificar por volumen de
// lances (PO+A+E) porque dependen mucho de la posición: un jardinero
// recibe pocas bolas aunque sea titular. Por eso la base es "participó en
// suficientes juegos", no "manejó suficientes lances".
const DEFENSE_QUALIFY_PCT = 0.6;

/**
 * Tramo del torneo sobre el que se calculan las estadísticas.
 *
 * En béisbol/softbol/wiffleball la postemporada arranca DESDE CERO: un jonrón
 * de playoffs no cuenta para el título de bateo de la temporada regular. El
 * corte va sobre la lista de partidos y no sobre los totales, porque un
 * promedio no se puede partir después: si alguien batea .400 en la regular y
 * .200 en playoffs, su promedio de postemporada es .200, no una resta.
 *
 * `undefined` = todo el torneo junto, que es como se comportaba antes de
 * existir esto y como siguen viéndolo los deportes que no separan temporadas.
 */
export type StatsSegment = "regular" | "postemporada";

/**
 * Fase de cada grupo, por id. `tournament_groups.phase` es el ÚNICO lugar
 * donde vive el número de fase: `matches.phase` sólo distingue `"group"` de
 * `"playoff"`, así que un partido de la fase 2 de grupos está etiquetado
 * igual que uno de la fase 1. Sin este mapa, filtrar por `match.phase` metería
 * toda la fase 2 dentro de la temporada regular sin que se note.
 */
function groupPhaseFrom(
  groups: TournamentGroup[] | undefined
): Map<string, number> {
  const m = new Map<string, number>();
  for (const g of groups ?? []) m.set(g.id, g.phase ?? 1);
  return m;
}

/** Postemporada = playoffs, o grupos de fase 2 en adelante. */
function isPostseasonMatch(match: Match, phases: Map<string, number>): boolean {
  if (match.phase === "playoff") return true;
  if (match.groupId) return (phases.get(match.groupId) ?? 1) >= 2;
  return false;
}

/**
 * Con qué pestaña abrir: la que está en juego. Si ya se jugó algo de
 * postemporada abre ahí, si no en regular, para que el organizador no tenga
 * que buscar dónde está parado.
 */
export function currentSegment(tournament: Tournament): StatsSegment {
  const phases = groupPhaseFrom(tournament.groups);
  const started = tournament.matches.some(
    (m) => m.status === "completed" && isPostseasonMatch(m, phases)
  );
  return started ? "postemporada" : "regular";
}

export interface PlayerStatEntry {
  playerName: string;
  playerId?: string | null;
  teamId: string;
  count: number;
}

export interface TeamStatEntry {
  teamId: string;
  value: number;
  matchesPlayed: number;
}

export interface CardEntry {
  eventId: string;
  matchId: string;
  playerName: string;
  teamId: string;
  type: "yellow_card" | "red_card" | "ejection" | "blue_card";
  paid: boolean;
}

export interface StatLeaderboard {
  statKey: MatchEventType;
  label: string;
  pluralLabel: string;
  computed: boolean;
  leaders: PlayerStatEntry[];
  teamLeaders: TeamStatEntry[];
}

export interface BaseballPlayerStats {
  playerName: string;
  playerId?: string | null;
  teamId: string;
  ab: number;
  h: number; // total hits = singles + doubles + triples + hr
  singles: number;
  doubles: number;
  triples: number;
  hr: number;
  bb: number;
  k: number;
  rbi: number;
  r: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  // PA = apariciones al plato aproximadas (AB + BB). Se muestra en la tabla.
  pa: number;
  // ¿Califica al ranking? Estándar MLB: necesita QUALIFY_RATE apariciones al
  // plato por cada partido que jugó su equipo dentro del tramo que se mira.
  // Los que no califican no encabezan el ranking; se ordenan por OPS puro
  // solo entre los calificados, evitando que un OPS inflado en muestra chica
  // se trepe a la cima. El umbral crece solo a medida que avanzan los juegos.
  qualified: boolean;
}

// Fildeo por jugador (beisbol/softball/wiffleball): PO/A/E y % de fildeo.
export interface BaseballFieldingStats {
  playerName: string;
  playerId?: string | null;
  teamId: string;
  po: number; // outs (putouts)
  a: number;  // asistencias
  e: number;  // errores
  tc: number; // lances totales = PO + A + E
  fld: number; // % de fildeo = (PO + A) / TC
  gamesAppeared: number; // partidos completados en que el jugador tuvo algún evento
  qualified: boolean;    // participó en >= DEFENSE_QUALIFY_PCT de los juegos del equipo
}

export function useTournamentStats(
  tournament: Tournament,
  segment?: StatsSegment
) {
  return useMemo(() => {
    const enabledStats = tournament.enabledStats || [];

    // Recorte del tramo, UNA sola vez y acá arriba: de este punto para abajo
    // todo el hook trabaja sobre `matches` y nunca sobre `tournament.matches`.
    // Filtrar dentro de cada bucle sería la forma segura de olvidarse de uno
    // (hay cuatro) y dejar una estadística mezclando los dos tramos.
    const groups = tournament.groups;
    const allMatches = tournament.matches;
    const matches = (() => {
      if (!segment) return allMatches;
      const phases = groupPhaseFrom(groups);
      const wantPost = segment === "postemporada";
      return allMatches.filter(
        (m) => isPostseasonMatch(m, phases) === wantPost
      );
    })();

    // Clave de agrupación de estadísticas: por `player_id` cuando existe, si no
    // por nombre normalizado + equipo (fallback para eventos sin id: viejos sin
    // backfill o nombres sueltos). Con el backfill hecho, casi todo cae en el
    // camino por id, lo que deja las stats atadas al jugador (sobreviven a un
    // renombre) y une variantes de mayúsculas/espacios del mismo jugador.
    const playerKey = (
      playerId: string | null | undefined,
      playerName: string,
      teamId: string
    ) =>
      playerId
        ? `id:${playerId}`
        : `name:${normalizePlayerName(playerName)}::${teamId}`;

    // Separate computed stats from event-based stats
    const eventStats: MatchEventType[] = [];
    const computedStats: MatchEventType[] = [];
    for (const statKey of enabledStats) {
      const def = getStatDefinition(statKey);
      if (def?.computed) {
        computedStats.push(statKey);
      } else {
        eventStats.push(statKey);
      }
    }

    // Build player event maps
    const maps = new Map<MatchEventType, Map<string, PlayerStatEntry>>();
    for (const statKey of eventStats) {
      maps.set(statKey, new Map());
    }

    // Build team computed maps
    const teamMaps = new Map<MatchEventType, Map<string, TeamStatEntry>>();
    for (const statKey of computedStats) {
      const m = new Map<string, TeamStatEntry>();
      for (const teamId of tournament.teamIds) {
        m.set(teamId, { teamId, value: 0, matchesPlayed: 0 });
      }
      teamMaps.set(statKey, m);
    }

    for (const match of matches) {
      if (match.status !== "completed") continue;

      // Computed stats from scores
      if (
        computedStats.length > 0 &&
        match.homeTeamId &&
        match.awayTeamId &&
        match.homeScore !== null &&
        match.awayScore !== null
      ) {
        // Juego limpio: no sale del marcador sino del premio que cargó quien
        // anotó el partido. `matchesPlayed` cuenta los partidos jugados por
        // cada equipo (no los premios) para que el ranking pueda mostrar
        // "3 de 8" sin recorrer los partidos otra vez.
        if (computedStats.includes("fair_play")) {
          const fpMap = teamMaps.get("fair_play")!;
          const home = fpMap.get(match.homeTeamId);
          const away = fpMap.get(match.awayTeamId);
          if (home) home.matchesPlayed++;
          if (away) away.matchesPlayed++;
          if (match.fairPlayTeamId) {
            const winner = fpMap.get(match.fairPlayTeamId);
            if (winner) winner.value++;
          }
        }

        if (computedStats.includes("goals_against")) {
          const gaMap = teamMaps.get("goals_against")!;
          const home = gaMap.get(match.homeTeamId);
          const away = gaMap.get(match.awayTeamId);
          if (home) {
            home.value += match.awayScore;
            home.matchesPlayed++;
          }
          if (away) {
            away.value += match.homeScore;
            away.matchesPlayed++;
          }
        }
      }

      // Event-based stats from events
      if (!match.events) continue;
      for (const event of match.events) {
        const statMap = maps.get(event.type);
        if (!statMap) continue;

        const key = playerKey(event.playerId, event.playerName, event.teamId);
        const existing = statMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          statMap.set(key, {
            playerName: event.playerName,
            playerId: event.playerId ?? null,
            teamId: event.teamId,
            count: 1,
          });
        }
      }
    }

    // Collect individual card entries
    const cardEntries: CardEntry[] = [];
    for (const match of matches) {
      if (match.status !== "completed" || !match.events) continue;
      for (const event of match.events) {
        if (event.type === "yellow_card" || event.type === "red_card" || event.type === "ejection" || event.type === "blue_card") {
          cardEntries.push({
            eventId: event.id,
            matchId: match.id,
            playerName: event.playerName,
            teamId: event.teamId,
            type: event.type,
            paid: !!event.paid,
          });
        }
      }
    }

    const leaderboards: StatLeaderboard[] = enabledStats
      .map((statKey) => {
        const def = getStatDefinition(statKey);
        if (!def) return null;

        if (def.computed) {
          const teamMap = teamMaps.get(statKey);
          if (!teamMap) return null;
          // Cada stat de equipo tiene su propio "mejor": en malla menos
          // vencida gana quien menos goles recibió, en juego limpio quien más
          // premios juntó.
          // Sin recortar: quien consume decide cuántos mostrar. Recortar acá
          // rompía el filtro por equipo (ver `leaders` más abajo).
          const higherIsBetter = statKey === "fair_play";
          const teamLeaders = Array.from(teamMap.values())
            .filter((t) => t.matchesPlayed > 0)
            .sort((a, b) => (higherIsBetter ? b.value - a.value : a.value - b.value));

          return {
            statKey,
            label: def.label,
            pluralLabel: def.pluralLabel,
            computed: true,
            leaders: [] as PlayerStatEntry[],
            teamLeaders: teamLeaders,
          };
        }

        const statMap = maps.get(statKey);
        if (!statMap) return null;
        // Lista completa ordenada, sin recortar. El recorte lo hace cada
        // consumidor: la card muestra top 5, el modal top 10, el PDF el topN
        // elegido, y al filtrar por equipo se muestran todos sus jugadores.
        // Recortar acá dejaba fuera del filtro por equipo a los jugadores que
        // no entraban en el top 10 global del torneo.
        const leaders = Array.from(statMap.values())
          .sort((a, b) => b.count - a.count);

        return {
          statKey,
          label: def.label,
          pluralLabel: def.pluralLabel,
          computed: false,
          leaders,
          teamLeaders: [] as TeamStatEntry[],
        };
      })
      .filter((lb): lb is StatLeaderboard => lb !== null);

    const hasStats = leaderboards.some(
      (lb) => lb.leaders.length > 0 || lb.teamLeaders.length > 0
    );

    // Baseball / softball / wiffleball: per-player AVG / OBP / SLG / OPS
    const isBaseball = getSportCategory(tournament.sport) === "baseball";
    const baseballMap = new Map<string, BaseballPlayerStats>();
    const fieldingMap = new Map<string, BaseballFieldingStats>();
    // Partidos en que cada jugador participó (tuvo >= 1 evento). Base del
    // umbral de calificación DEFENSIVA.
    const playerGames = new Map<string, number>();
    // Partidos completados por equipo, contados SOLO dentro del tramo que se
    // está mirando (`matches` ya viene recortado). Es la base de los dos
    // umbrales de calificación: el de bateo (QUALIFY_RATE) y el defensivo
    // (DEFENSE_QUALIFY_PCT). Si esto contara el torneo entero, en postemporada
    // la tabla saldría vacía: con 3 juegos de playoffs nadie alcanzaría un
    // mínimo pensado para una temporada completa.
    const teamGames = new Map<string, number>();

    if (isBaseball) {
      for (const match of matches) {
        if (match.status !== "completed") continue;
        if (match.homeTeamId)
          teamGames.set(match.homeTeamId, (teamGames.get(match.homeTeamId) || 0) + 1);
        if (match.awayTeamId)
          teamGames.set(match.awayTeamId, (teamGames.get(match.awayTeamId) || 0) + 1);
      }
      for (const match of matches) {
        if (match.status !== "completed" || !match.events) continue;
        // Jugadores ya contados como "participó" en ESTE partido, para no
        // sumar el mismo juego dos veces al tener varios eventos.
        const seenThisMatch = new Set<string>();
        for (const event of match.events) {
          const key = playerKey(event.playerId, event.playerName, event.teamId);
          if (!seenThisMatch.has(key)) {
            seenThisMatch.add(key);
            playerGames.set(key, (playerGames.get(key) || 0) + 1);
          }
          let entry = baseballMap.get(key);
          if (!entry) {
            entry = {
              playerName: event.playerName,
              playerId: event.playerId ?? null,
              teamId: event.teamId,
              ab: 0, h: 0, singles: 0, doubles: 0, triples: 0, hr: 0,
              bb: 0, k: 0, rbi: 0, r: 0,
              avg: 0, obp: 0, slg: 0, ops: 0,
              pa: 0, qualified: false,
            };
            baseballMap.set(key, entry);
          }
          switch (event.type) {
            case "at_bat": entry.ab++; break;
            case "hit": entry.singles++; entry.h++; break;
            case "double": entry.doubles++; entry.h++; break;
            case "triple": entry.triples++; entry.h++; break;
            case "home_run": entry.hr++; entry.h++; break;
            case "walk": entry.bb++; break;
            case "strikeout": entry.k++; break;
            case "rbi": entry.rbi++; break;
            case "run_scored": entry.r++; break;
          }

          // Fildeo (defensiva): PO / A / E por jugador.
          if (event.type === "putout" || event.type === "assist" || event.type === "error") {
            let f = fieldingMap.get(key);
            if (!f) {
              f = {
                playerName: event.playerName,
                playerId: event.playerId ?? null,
                teamId: event.teamId,
                po: 0, a: 0, e: 0, tc: 0, fld: 0,
                gamesAppeared: 0, qualified: false,
              };
              fieldingMap.set(key, f);
            }
            if (event.type === "putout") f.po++;
            else if (event.type === "assist") f.a++;
            else f.e++;
          }
        }
      }

      for (const e of baseballMap.values()) {
        e.avg = e.ab > 0 ? e.h / e.ab : 0;
        const obpDen = e.ab + e.bb;
        e.obp = obpDen > 0 ? (e.h + e.bb) / obpDen : 0;
        const totalBases = e.singles + 2 * e.doubles + 3 * e.triples + 4 * e.hr;
        e.slg = e.ab > 0 ? totalBases / e.ab : 0;
        e.ops = e.obp + e.slg;
        // Apariciones al plato aproximadas.
        e.pa = e.ab + e.bb;
      }
    }

    const baseballPlayerStats = Array.from(baseballMap.values()).filter(
      (e) => e.ab > 0 || e.bb > 0 || e.h > 0
    );

    // Calificación al ranking, estándar MLB: un bateador califica si acumula
    // al menos QUALIFY_RATE apariciones al plato por cada partido que jugó
    // su equipo. En la MLB son 3.1 PA/juego (502 en 162 juegos); bajamos a
    // 2.7 porque las ligas de este tipo son mucho más cortas y 3.1 dejaría
    // la tabla casi vacía. El umbral es dinámico: crece con los partidos, así
    // que en la jornada 1 casi cualquier titular califica y para playoffs
    // (acumulado) solo los que jugaron con regularidad. El orden es por AVG,
    // y el OPS desempata a los que comparten promedio; los calificados van
    // primero y los no calificados después (con el mismo criterio), para que
    // nadie encabece por un promedio inflado en muestra chica.
    for (const e of baseballPlayerStats) {
      const games = teamGames.get(e.teamId) || 0;
      e.qualified = games > 0 && e.pa >= QUALIFY_RATE * games;
    }
    baseballPlayerStats.sort((a, b) => {
      if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
      if (b.avg !== a.avg) return b.avg - a.avg;
      return b.ops - a.ops;
    });

    // Fildeo: % = (PO + A) / lances. Calificación por juegos participados
    // (no por lances, para no castigar a jardineros/pitchers por posición).
    // Orden: calificados primero, luego por FLD% desc, desempate por más
    // lances (más trabajo defenido con el mismo % vale más).
    const baseballFieldingStats = Array.from(fieldingMap.values()).filter(
      (f) => f.po > 0 || f.a > 0 || f.e > 0
    );
    for (const f of baseballFieldingStats) {
      f.tc = f.po + f.a + f.e;
      f.fld = f.tc > 0 ? (f.po + f.a) / f.tc : 0;
      f.gamesAppeared = playerGames.get(playerKey(f.playerId, f.playerName, f.teamId)) || 0;
      const games = teamGames.get(f.teamId) || 0;
      f.qualified = games > 0 && f.gamesAppeared >= DEFENSE_QUALIFY_PCT * games;
    }
    baseballFieldingStats.sort((a, b) => {
      if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
      if (b.fld !== a.fld) return b.fld - a.fld;
      return b.tc - a.tc;
    });

    return { leaderboards, hasStats, cardEntries, baseballPlayerStats, baseballFieldingStats };
    // `tournament.groups` va en las dependencias porque de ahí sale la fase de
    // cada partido; sin él, cambiar de pestaña no recalcularía nada.
  }, [
    tournament.matches,
    tournament.groups,
    tournament.enabledStats,
    tournament.teamIds,
    tournament.sport,
    segment,
  ]);
}
