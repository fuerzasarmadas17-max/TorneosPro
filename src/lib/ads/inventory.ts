/**
 * Inventario de publicidad: resolver las reglas a torneos concretos.
 *
 * El panel de campañas muestra el TARGETING ("Volleyball · Sucre · En curso"),
 * que es una regla, no una lista. Y las reglas son dinámicas: un torneo nuevo
 * que cumpla entra solo, sin que nadie lo decida. Por eso no se puede
 * responder "¿dónde está saliendo la Ferretería?" mirando esa pantalla.
 *
 * Esto cruza campañas × torneos una sola vez y devuelve las dos lecturas de la
 * misma matriz: por campaña (dónde sale cada una) y por torneo (qué lleva cada
 * uno, y cuáles están vacíos).
 *
 * El emparejamiento y el peso salen de `./targeting`, que es el mismo módulo
 * que usa el endpoint del espectador. Acá NO se re-implementa ninguna regla.
 */

import {
  campaignMatchesTournament,
  isCampaignLive,
  sharesFor,
  type CampaignSchedule,
  type CampaignTargeting,
  type TournamentTargeting,
} from "./targeting";

export interface InventoryCampaignInput
  extends CampaignTargeting,
    CampaignSchedule {
  advertiser_name: string;
  monthly_price: number;
}

export interface InventoryTournamentInput extends TournamentTargeting {
  id: string;
  name: string;
  /** Dueño del torneo. No participa del emparejamiento — está para filtrar la
   *  línea de tiempo por organizador. */
  createdBy?: string | null;
}

/** Un torneo donde sale (o saldrá) una campaña. */
export interface CampaignPlacement {
  tournamentId: string;
  tournamentName: string;
  tournamentStatus: string | null;
  /** Probabilidad de que a un visitante de ESE torneo le toque ESTA campaña.
   *  `null` si la campaña no está al aire: no compite, así que no tiene share. */
  share: number | null;
}

/** Una campaña que sale en un torneo. */
export interface TournamentPlacement {
  campaignId: string;
  advertiserName: string;
  share: number;
}

export interface CampaignInventoryRow {
  campaign: InventoryCampaignInput;
  live: boolean;
  /** Días hasta que venza. Negativo = ya venció. Null si no está prendida. */
  daysLeft: number;
  expired: boolean;
  /** Torneos a los que le apunta el targeting, esté al aire o no. */
  placements: CampaignPlacement[];
}

export interface TournamentInventoryRow {
  tournament: InventoryTournamentInput;
  /** Solo campañas AL AIRE: es lo que un visitante puede ver hoy. */
  campaigns: TournamentPlacement[];
}

export interface AdInventory {
  byCampaign: CampaignInventoryRow[];
  byTournament: TournamentInventoryRow[];
  /** Torneos en curso sin ninguna campaña al aire. El hueco vendible. */
  gapsInProgress: number;
  inProgressTotal: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Días calendario entre hoy y el fin de la vigencia, redondeado hacia arriba. */
function daysUntil(iso: string, now: Date): number {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / DAY_MS);
}

/**
 * Para cada torneo, qué campañas le apuntan. El cruce base del que salen todas
 * las vistas (inventario y línea de tiempo).
 */
function matchCampaignsToTournaments<
  C extends CampaignTargeting,
  T extends TournamentTargeting & { id: string },
>(
  campaigns: readonly C[],
  tournaments: readonly T[],
  listMap: Readonly<Record<string, string[]>>
): Map<string, C[]> {
  // Pertenencia de modo lista, indexada por campaña. Se arma una vez y no por
  // cada par: con 20 campañas × 23 torneos, reconstruir el set adentro del
  // bucle serían 460 sets idénticos.
  const listedBy = new Map<string, Set<string>>();
  for (const c of campaigns) listedBy.set(c.id, new Set(listMap[c.id] ?? []));

  const out = new Map<string, C[]>();
  for (const t of tournaments) {
    out.set(
      t.id,
      campaigns.filter((c) =>
        campaignMatchesTournament(c, t, listedBy.get(c.id)?.has(t.id) ?? false)
      )
    );
  }
  return out;
}

export function buildAdInventory(
  campaigns: readonly InventoryCampaignInput[],
  tournaments: readonly InventoryTournamentInput[],
  /** `campaign_id → tournament_id[]`, de `ad_campaign_tournaments`. */
  listMap: Readonly<Record<string, string[]>>,
  now: Date = new Date()
): AdInventory {
  const liveOf = new Map<InventoryCampaignInput, boolean>();
  for (const c of campaigns) liveOf.set(c, isCampaignLive(c, now));

  // Matriz: para cada torneo, qué campañas le apuntan. Se calcula una sola vez
  // y las dos vistas se derivan de acá.
  const matchesByTournament = matchCampaignsToTournaments(
    campaigns,
    tournaments,
    listMap
  );

  // Shares: solo entre las que están al aire. Una campaña pausada o vencida no
  // le quita rotación a nadie, así que incluirla repartiría un 100% ficticio.
  const shareByTournament = new Map<
    string,
    Map<InventoryCampaignInput, number>
  >();
  for (const t of tournaments) {
    const pool = (matchesByTournament.get(t.id) ?? []).filter((c) =>
      liveOf.get(c)
    );
    shareByTournament.set(t.id, sharesFor(pool));
  }

  const tournamentById = new Map(tournaments.map((t) => [t.id, t]));

  const byCampaign: CampaignInventoryRow[] = campaigns.map((c) => {
    const live = liveOf.get(c) ?? false;
    const placements: CampaignPlacement[] = [];
    for (const [tid, hits] of matchesByTournament) {
      if (!hits.includes(c)) continue;
      const t = tournamentById.get(tid);
      if (!t) continue;
      placements.push({
        tournamentId: tid,
        tournamentName: t.name,
        tournamentStatus: t.status,
        share: live ? (shareByTournament.get(tid)?.get(c) ?? null) : null,
      });
    }
    // Los torneos en curso primero: son donde la campaña está trabajando hoy.
    placements.sort((a, b) => {
      const rank = (s: string | null) => (s === "in-progress" ? 0 : 1);
      return (
        rank(a.tournamentStatus) - rank(b.tournamentStatus) ||
        a.tournamentName.localeCompare(b.tournamentName, "es")
      );
    });
    return {
      campaign: c,
      live,
      daysLeft: daysUntil(c.ends_at, now),
      expired: new Date(c.ends_at) <= now,
      placements,
    };
  });

  // Al aire primero, después programadas/pausadas, vencidas al final. Dentro
  // de cada grupo, lo que vence antes arriba: es la cola de renovación.
  byCampaign.sort((a, b) => {
    const rank = (r: CampaignInventoryRow) =>
      r.live ? 0 : r.expired ? 2 : 1;
    return rank(a) - rank(b) || a.daysLeft - b.daysLeft;
  });

  const byTournament: TournamentInventoryRow[] = tournaments.map((t) => {
    const shares = shareByTournament.get(t.id) ?? new Map();
    const campaignsHere: TournamentPlacement[] = [...shares.entries()]
      .map(([c, share]) => ({
        campaignId: c.id,
        advertiserName: c.advertiser_name,
        share,
      }))
      .sort((a, b) => b.share - a.share);
    return { tournament: t, campaigns: campaignsHere };
  });

  // En curso primero (es donde hay audiencia que vender), y dentro de eso los
  // que MÁS publicidad llevan arriba, para que el hueco se lea por contraste.
  byTournament.sort((a, b) => {
    const rank = (r: TournamentInventoryRow) =>
      r.tournament.status === "in-progress" ? 0 : 1;
    return (
      rank(a) - rank(b) ||
      b.campaigns.length - a.campaigns.length ||
      a.tournament.name.localeCompare(b.tournament.name, "es")
    );
  });

  const inProgress = byTournament.filter(
    (r) => r.tournament.status === "in-progress"
  );

  return {
    byCampaign,
    byTournament,
    gapsInProgress: inProgress.filter((r) => r.campaigns.length === 0).length,
    inProgressTotal: inProgress.length,
  };
}

/* ========================================================================
 * LÍNEA DE TIEMPO (vista tipo Gantt)
 *
 * La misma matriz campaña × torneo, pero puesta sobre un eje de meses: cada
 * torneo es una fila y cada campaña una barra que va de su inicio a su fin.
 * Responde de un vistazo lo que la tabla no podía — cuántas publicidades tiene
 * un torneo AL MISMO TIEMPO, y en qué tramos del calendario queda descubierto.
 * ===================================================================== */

const MONTHS_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

export interface TimelineMonth {
  key: string;
  /** "ago" */
  label: string;
  year: number;
  /** Ancho de la columna en % del eje. Los meses no duran lo mismo. */
  widthPct: number;
}

export interface TimelineBar {
  campaignId: string;
  advertiserName: string;
  monthlyPrice: number;
  live: boolean;
  expired: boolean;
  /** Posición dentro del eje visible, en %. */
  leftPct: number;
  widthPct: number;
  /** La campaña empieza antes / termina después de lo que se ve. */
  clippedStart: boolean;
  clippedEnd: boolean;
  /** Carril dentro de la fila. Dos campañas que se solapan en el tiempo van en
   *  carriles distintos; si no se solapan comparten carril. */
  lane: number;
  startsAt: string;
  endsAt: string;
}

export interface TimelineRow {
  tournament: InventoryTournamentInput;
  bars: TimelineBar[];
  /** Cuántos carriles necesita la fila (alto). */
  lanes: number;
  /** Campañas al aire HOY en este torneo. */
  liveNow: number;
}

export interface AdTimeline {
  months: TimelineMonth[];
  rows: TimelineRow[];
  /** Dónde cae hoy en el eje, en %. Null si hoy queda fuera del rango. */
  todayPct: number | null;
  empty: boolean;
}

/** Primer instante del mes de una fecha. */
function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Primer instante del mes siguiente. */
function nextMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

/**
 * Reparte las barras en carriles: la primera que quepa sin pisar a otra.
 * Empaquetado codicioso — dos campañas seguidas en el tiempo comparten carril
 * y la fila queda de un solo alto, que es el caso común.
 */
function assignLanes(
  bars: { startMs: number; endMs: number }[]
): number[] {
  const laneEnds: number[] = [];
  const lanes: number[] = [];
  bars.forEach((b) => {
    let lane = laneEnds.findIndex((end) => end <= b.startMs);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(b.endMs);
    } else {
      laneEnds[lane] = b.endMs;
    }
    lanes.push(lane);
  });
  return lanes;
}

export function buildAdTimeline(
  campaigns: readonly InventoryCampaignInput[],
  tournaments: readonly InventoryTournamentInput[],
  listMap: Readonly<Record<string, string[]>>,
  now: Date = new Date()
): AdTimeline {
  if (campaigns.length === 0 || tournaments.length === 0) {
    return { months: [], rows: [], todayPct: null, empty: true };
  }

  // El eje abarca todas las campañas, en meses enteros. Se fuerza a incluir el
  // mes en curso para que la línea de "hoy" siempre tenga dónde caer: sin eso,
  // un panel donde todo venció ya no mostraría dónde estamos parados.
  const starts = campaigns.map((c) => new Date(c.starts_at).getTime());
  const ends = campaigns.map((c) => new Date(c.ends_at).getTime());
  const first = monthStart(new Date(Math.min(...starts, now.getTime())));
  const last = nextMonth(new Date(Math.max(...ends, now.getTime())));

  const rangeStartMs = first.getTime();
  const rangeEndMs = last.getTime();
  const totalMs = rangeEndMs - rangeStartMs;

  const months: TimelineMonth[] = [];
  for (let d = new Date(first); d < last; d = nextMonth(d)) {
    const end = nextMonth(d);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: MONTHS_ES[d.getMonth()],
      year: d.getFullYear(),
      widthPct: ((end.getTime() - d.getTime()) / totalMs) * 100,
    });
  }

  const matches = matchCampaignsToTournaments(campaigns, tournaments, listMap);

  const rows: TimelineRow[] = tournaments.map((t) => {
    const hits = [...(matches.get(t.id) ?? [])].sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );

    const spans = hits.map((c) => {
      const s = new Date(c.starts_at).getTime();
      const e = new Date(c.ends_at).getTime();
      return {
        startMs: Math.max(s, rangeStartMs),
        endMs: Math.min(e, rangeEndMs),
        clippedStart: s < rangeStartMs,
        clippedEnd: e > rangeEndMs,
      };
    });

    const lanes = assignLanes(spans);

    const bars: TimelineBar[] = hits.map((c, i) => {
      const sp = spans[i];
      return {
        campaignId: c.id,
        advertiserName: c.advertiser_name,
        monthlyPrice: c.monthly_price,
        live: isCampaignLive(c, now),
        expired: new Date(c.ends_at) <= now,
        leftPct: ((sp.startMs - rangeStartMs) / totalMs) * 100,
        // Piso de ancho para que una campaña de un día no quede invisible.
        widthPct: Math.max(
          ((sp.endMs - sp.startMs) / totalMs) * 100,
          0.6
        ),
        clippedStart: sp.clippedStart,
        clippedEnd: sp.clippedEnd,
        lane: lanes[i],
        startsAt: c.starts_at,
        endsAt: c.ends_at,
      };
    });

    return {
      tournament: t,
      bars,
      lanes: Math.max(1, lanes.length ? Math.max(...lanes) + 1 : 0),
      liveNow: bars.filter((b) => b.live).length,
    };
  });

  const todayMs = now.getTime();
  const todayPct =
    todayMs >= rangeStartMs && todayMs <= rangeEndMs
      ? ((todayMs - rangeStartMs) / totalMs) * 100
      : null;

  return { months, rows, todayPct, empty: false };
}
