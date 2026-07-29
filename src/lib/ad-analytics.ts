/**
 * Tipos y cálculo del reparto de publicidad con organizadores.
 *
 * Vive fuera del componente a propósito: acá se decide cuánta plata recibe
 * cada organizador, y eso tiene que poder leerse y probarse sin JSX alrededor.
 * Ver `Por hacer/monetizacion-analitica-publicidad.md`.
 */

/** Lo que devuelve la RPC `get_ad_analytics`. Cada corte viene YA agregado
 *  desde Postgres con su propio COUNT(DISTINCT): personas-día no se puede
 *  sumar entre filas (la misma persona el mismo día puede aparecer en dos
 *  campañas, dos torneos o dos organizadores). Acá no se agrega nada. */
export interface AdAnalytics {
  by_campaign: {
    campaign_id: string;
    impressions: number;
    clicks: number;
    persons: number;
    person_days: number;
    impressions_with_person: number;
  }[];
  by_tournament: {
    tournament_id: string;
    tournament_name: string | null;
    organizer_id: string | null;
    organizer_name: string | null;
    impressions: number;
    clicks: number;
    person_days: number;
  }[];
  by_organizer: AdOrganizerRow[];
  detail: AdDetailRow[];
  totals: {
    impressions: number;
    clicks: number;
    person_days: number;
    impressions_with_person: number;
  } | null;
}

export interface AdOrganizerRow {
  organizer_id: string;
  organizer_name: string | null;
  tournaments: number;
  impressions: number;
  clicks: number;
  person_days: number;
}

export interface AdDetailRow {
  campaign_id: string;
  tournament_id: string | null;
  tournament_name: string | null;
  organizer_id: string | null;
  organizer_name: string | null;
  impressions: number;
  clicks: number;
  person_days: number;
}

/** Rango de fechas del panel. `all` = sin filtro (histórico completo). */
export type DateRange = "current" | "previous" | "all";

export const DATE_RANGE_LABELS: Record<DateRange, string> = {
  current: "Mes en curso",
  previous: "Mes pasado",
  all: "Todo el histórico",
};

/** Límites del rango, en hora local, como ISO para la RPC. */
export function rangeBounds(range: DateRange): {
  from: string | null;
  to: string | null;
} {
  if (range === "all") return { from: null, to: null };
  const now = new Date();
  const monthOffset = range === "previous" ? -1 : 0;
  const from = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Porción del fondo que va a los organizadores. El otro 50% es de la app. */
export const ORGANIZER_SHARE = 0.5;

export interface ShareRow extends AdOrganizerRow {
  /** Participación sobre el total de personas-día repartibles, en 0..1. */
  share: number;
  /** Pesos colombianos, entero. La suma de todas las filas da exactamente
   *  `pool` — ver el reparto de residuos en `computeRevenueShare`. */
  amountCop: number;
}

export interface RevenueShare {
  rows: ShareRow[];
  /** Denominador del reparto: la SUMA de personas-día por organizador.
   *
   *  NO es `totals.person_days`, y la diferencia no es un error. El total
   *  global cuenta personas-día distintas en toda la plataforma, así que quien
   *  el mismo día ve torneos de dos organizadores aporta 1 al global pero 1 a
   *  cada uno. Por eso esta suma es siempre >= el global.
   *
   *  Para repartir hay que usar esta suma, porque es lo único que da 100%
   *  exacto: con el global los porcentajes sumarían más de 100% y el reparto
   *  excedería el fondo. */
  totalPersonDays: number;
  /** Plata para los organizadores: el fondo por `ORGANIZER_SHARE`. */
  pool: number;
  /** Pesos por persona-día. Informativo: los montos NO se calculan
   *  multiplicando por esto (ver el reparto de residuos), así que puede no
   *  cuadrar al peso contra las filas. */
  ratePerPersonDay: number;
}

/**
 * Reparte `pool` entre organizadores en proporción a sus personas-día.
 *
 * Los montos se reparten por RESIDUO MAYOR, no redondeando cada fila por
 * separado. Redondear fila por fila deja un descuadre contra el fondo (con 5
 * organizadores puede sobrar o faltar hasta $2-3), y un total que no cuadra
 * con lo que se va a transferir es una discusión asegurada cuando hay plata de
 * por medio. Acá cada fila recibe su piso entero y los pesos que sobran van de
 * a uno a las fracciones más grandes, así la suma da `pool` exacto.
 *
 * Empates de fracción: se resuelven por más personas-día y luego por
 * `organizer_id`, para que el resultado sea estable entre recargas y no cambie
 * a quién le tocó el peso extra.
 */
export function computeRevenueShare(
  organizers: AdOrganizerRow[],
  fundCop: number
): RevenueShare {
  const eligible = organizers.filter((o) => o.person_days > 0);
  const totalPersonDays = eligible.reduce((a, o) => a + o.person_days, 0);
  const pool = Math.floor(Math.max(0, fundCop) * ORGANIZER_SHARE);

  if (totalPersonDays === 0 || pool === 0) {
    return {
      rows: organizers.map((o) => ({ ...o, share: 0, amountCop: 0 })),
      totalPersonDays,
      pool,
      ratePerPersonDay: 0,
    };
  }

  const exact = eligible.map((o) => {
    const share = o.person_days / totalPersonDays;
    const raw = share * pool;
    return { row: o, share, floor: Math.floor(raw), frac: raw - Math.floor(raw) };
  });

  let remainder = pool - exact.reduce((a, e) => a + e.floor, 0);
  const byFrac = [...exact].sort(
    (a, b) =>
      b.frac - a.frac ||
      b.row.person_days - a.row.person_days ||
      a.row.organizer_id.localeCompare(b.row.organizer_id)
  );
  const bonus = new Map<string, number>();
  for (const e of byFrac) {
    if (remainder <= 0) break;
    bonus.set(e.row.organizer_id, 1);
    remainder--;
  }

  const rows: ShareRow[] = exact
    .map((e) => ({
      ...e.row,
      share: e.share,
      amountCop: e.floor + (bonus.get(e.row.organizer_id) ?? 0),
    }))
    .sort((a, b) => b.person_days - a.person_days);

  // Los que no aportaron personas-día en el período igual se listan, en cero:
  // que no aparezcan se lee como "se me perdió un organizador".
  for (const o of organizers) {
    if (o.person_days <= 0) rows.push({ ...o, share: 0, amountCop: 0 });
  }

  return {
    rows,
    totalPersonDays,
    pool,
    ratePerPersonDay: pool / totalPersonDays,
  };
}
