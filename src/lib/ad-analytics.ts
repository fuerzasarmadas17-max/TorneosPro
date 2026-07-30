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
  by_campaign_organizer: AdCampaignOrganizerRow[];
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
  organizer_excluded: boolean;
  tournaments: number;
  impressions: number;
  clicks: number;
  person_days: number;
}

/** Celda campaña × organizador: la base del reparto. */
export interface AdCampaignOrganizerRow extends AdOrganizerRow {
  campaign_id: string;
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

/** Porción de lo que paga cada campaña que va a los organizadores que le
 *  entregaron audiencia. El otro 50% es de la app. */
export const ORGANIZER_SHARE = 0.5;

/** Lo que se le cobra a una campaña por el período que se está liquidando. */
export interface CampaignRevenue {
  campaignId: string;
  /** COP. Ya prorrateado a los días que la campaña estuvo al aire, si aplica. */
  amountCop: number;
}

/** Qué le tocó a un organizador dentro de UNA campaña. */
export interface CampaignSlice {
  campaignId: string;
  personDays: number;
  /** Participación en esa campaña, 0..1. */
  share: number;
  /** COP. Cero si el organizador no es elegible: su parte queda con la
   *  plataforma, no se reparte entre los demás. */
  amountCop: number;
  /** Lo que le habría tocado si fuera elegible. Sirve para mostrarle al
   *  organizador cuánto está dejando sobre la mesa por no cumplir requisitos. */
  wouldBeCop: number;
}

export interface OrganizerPayout {
  organizerId: string;
  organizerName: string | null;
  eligible: boolean;
  /** Motivo de la no-elegibilidad, para mostrarlo en el panel. */
  reason: string | null;
  /** Solo las campañas donde aportó personas-día. */
  slices: CampaignSlice[];
  /** Personas-día sumadas sobre las campañas donde aportó. OJO: es una suma de
   *  celdas campaña × organizador, así que cuenta dos veces a quien vio dos
   *  campañas el mismo día. Sirve para ordenar la tabla, NO para repartir —
   *  cada campaña ya reparte con su propio denominador. */
  personDaysAcrossCampaigns: number;
  /** COP a transferirle: la suma de sus tajadas. */
  totalCop: number;
}

export interface CampaignPool {
  campaignId: string;
  /** COP para organizadores en esta campaña. */
  poolCop: number;
  /** Denominador: personas-día de esta campaña sumadas por organizador. */
  personDays: number;
  /** COP por persona-día en esta campaña. Cada campaña tiene su propia tarifa:
   *  una campaña departamental chica paga mucho más por persona-día que una
   *  nacional grande, porque su bolsa se divide entre menos audiencia. */
  ratePerPersonDay: number;
  /** COP que quedan con la plataforma por organizadores no elegibles. */
  retainedCop: number;
}

export interface RevenueShare {
  /** Todos los organizadores con aporte, elegibles o no, de mayor a menor. */
  organizers: OrganizerPayout[];
  perCampaign: CampaignPool[];
  /** Suma de las bolsas de todas las campañas. */
  poolCop: number;
  /** Suma de lo que hay que transferir. */
  payableCop: number;
  /** Lo que queda con la plataforma por no-elegibles. Siempre se cumple:
   *  payableCop + retainedCop === poolCop. */
  retainedCop: number;
}

/** Decide si un organizador cobra. Hoy el panel solo conoce la bandera de
 *  cuenta excluida; el umbral mensual de monetización llega con el Paso 3. */
export type EligibilityFn = (
  row: AdCampaignOrganizerRow
) => { eligible: boolean; reason: string | null };

/** Elegibilidad por defecto: cobra todo el que no esté excluido a mano. */
export const defaultEligibility: EligibilityFn = (row) =>
  row.organizer_excluded
    ? { eligible: false, reason: "Cuenta excluida del reparto" }
    : { eligible: true, reason: null };

/**
 * Reparte por RESIDUO MAYOR. Devuelve un monto entero por índice, cuya suma da
 * exactamente `pool`.
 *
 * Redondear cada fila por separado descuadra contra la bolsa (con 5 filas,
 * hasta $2-3 de más o de menos), y un total que no cuadra con lo que se va a
 * transferir es una discusión asegurada cuando hay plata de por medio. Acá cada
 * fila recibe su piso entero y los pesos que sobran van de a uno a las
 * fracciones más grandes.
 *
 * Los empates se resuelven por fracción, luego por peso y luego por la clave de
 * desempate, para que el resultado no cambie entre recargas: a quién le tocó el
 * peso extra tiene que ser estable.
 */
function largestRemainder(
  weights: number[],
  pool: number,
  tieBreak: string[]
): number[] {
  const total = weights.reduce((a, w) => a + w, 0);
  if (total <= 0 || pool <= 0) return weights.map(() => 0);

  const parts = weights.map((w, i) => {
    const raw = (w / total) * pool;
    const floor = Math.floor(raw);
    return { i, w, floor, frac: raw - floor };
  });

  let remainder = pool - parts.reduce((a, p) => a + p.floor, 0);
  const order = [...parts].sort(
    (a, b) => b.frac - a.frac || b.w - a.w || tieBreak[a.i].localeCompare(tieBreak[b.i])
  );

  const out = parts.map((p) => p.floor);
  for (const p of order) {
    if (remainder <= 0) break;
    out[p.i] += 1;
    remainder--;
  }
  return out;
}

/**
 * Reparte lo que pagó cada campaña entre los organizadores que le entregaron
 * audiencia A ELLA.
 *
 * POR QUÉ POR CAMPAÑA Y NO CON UN FONDO ÚNICO
 * Las campañas están segmentadas. Una dirigida a Córdoba solo se muestra en
 * torneos de Córdoba, así que con un fondo único repartido por audiencia total
 * de la plataforma, el organizador más grande cobraba de una campaña a la que
 * no le aportó ni una persona, y los que entregaron el 100% de esa audiencia
 * recibían migajas. Cada campaña reparte lo suyo; el pago de un organizador es
 * la suma de sus tajadas.
 *
 * EL DENOMINADOR INCLUYE A LOS NO ELEGIBLES
 * El porcentaje de quien no califica se queda con la plataforma, NO se
 * redistribuye entre los que sí. Por eso el denominador de cada campaña son
 * todos los que aportaron: si fueran solo los elegibles, absorberían esa parte
 * y cobrarían más que su aporte real.
 */
export function computeRevenueShare(
  rows: AdCampaignOrganizerRow[],
  revenues: CampaignRevenue[],
  isEligible: EligibilityFn = defaultEligibility
): RevenueShare {
  const revenueByCampaign = new Map(revenues.map((r) => [r.campaignId, r.amountCop]));

  const byCampaign = new Map<string, AdCampaignOrganizerRow[]>();
  for (const r of rows) {
    if (r.person_days <= 0) continue;
    const list = byCampaign.get(r.campaign_id);
    if (list) list.push(r);
    else byCampaign.set(r.campaign_id, [r]);
  }

  const perCampaign: CampaignPool[] = [];
  const payouts = new Map<string, OrganizerPayout>();

  for (const [campaignId, cells] of byCampaign) {
    const revenue = Math.max(0, revenueByCampaign.get(campaignId) ?? 0);
    const pool = Math.floor(revenue * ORGANIZER_SHARE);
    const personDays = cells.reduce((a, c) => a + c.person_days, 0);

    // El reparto se hace sobre TODAS las celdas, elegibles o no, para que los
    // porcentajes sean el aporte real y la suma cierre en `pool`.
    const amounts = largestRemainder(
      cells.map((c) => c.person_days),
      pool,
      cells.map((c) => c.organizer_id)
    );

    let retained = 0;
    cells.forEach((cell, i) => {
      const { eligible, reason } = isEligible(cell);
      const wouldBe = amounts[i];
      const amount = eligible ? wouldBe : 0;
      if (!eligible) retained += wouldBe;

      let payout = payouts.get(cell.organizer_id);
      if (!payout) {
        payout = {
          organizerId: cell.organizer_id,
          organizerName: cell.organizer_name,
          eligible,
          reason,
          slices: [],
          personDaysAcrossCampaigns: 0,
          totalCop: 0,
        };
        payouts.set(cell.organizer_id, payout);
      }
      payout.slices.push({
        campaignId,
        personDays: cell.person_days,
        share: personDays > 0 ? cell.person_days / personDays : 0,
        amountCop: amount,
        wouldBeCop: wouldBe,
      });
      payout.personDaysAcrossCampaigns += cell.person_days;
      payout.totalCop += amount;
    });

    perCampaign.push({
      campaignId,
      poolCop: pool,
      personDays,
      ratePerPersonDay: personDays > 0 ? pool / personDays : 0,
      retainedCop: retained,
    });
  }

  const organizers = [...payouts.values()].sort(
    (a, b) =>
      b.totalCop - a.totalCop ||
      b.personDaysAcrossCampaigns - a.personDaysAcrossCampaigns ||
      a.organizerId.localeCompare(b.organizerId)
  );

  const poolCop = perCampaign.reduce((a, c) => a + c.poolCop, 0);
  const retainedCop = perCampaign.reduce((a, c) => a + c.retainedCop, 0);

  return {
    organizers,
    perCampaign: perCampaign.sort((a, b) => b.poolCop - a.poolCop),
    poolCop,
    payableCop: poolCop - retainedCop,
    retainedCop,
  };
}

// ============================================================================
// Corte mensual congelado
// ============================================================================

/** Primer día del mes de un rango, en formato DATE de Postgres. `null` para
 *  rangos que no son un mes (el histórico completo no se puede cerrar). */
export function periodMonthOf(range: DateRange): string | null {
  if (range === "all") return null;
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + (range === "previous" ? -1 : 0), 1);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}-01`;
}

/** ¿Ya terminó ese mes? Un mes en curso no se puede cerrar: las personas-día
 *  seguirían subiendo después de congelar y el corte quedaría corto. */
export function isMonthClosable(periodMonth: string | null): boolean {
  if (!periodMonth) return false;
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  return periodMonth < current;
}

/** Fila que se le manda a `close_ad_period`. Solo van los que cobran: el no
 *  elegible no genera corte, su parte queda con la plataforma. */
export interface SettlementInput {
  organizer_id: string;
  person_days: number;
  amount_cop: number;
  breakdown: {
    campaign_id: string;
    person_days: number;
    share: number;
    amount_cop: number;
  }[];
}

export function toSettlementInputs(share: RevenueShare): SettlementInput[] {
  return share.organizers
    .filter((o) => o.eligible && o.totalCop > 0)
    .map((o) => ({
      organizer_id: o.organizerId,
      person_days: o.personDaysAcrossCampaigns,
      amount_cop: o.totalCop,
      breakdown: o.slices.map((s) => ({
        campaign_id: s.campaignId,
        person_days: s.personDays,
        share: s.share,
        amount_cop: s.amountCop,
      })),
    }));
}

/** Un corte ya cerrado, como vive en `ad_settlements`. */
export interface AdSettlement {
  id: string;
  period_month: string;
  organizer_id: string;
  person_days: number;
  amount_cop: number;
  breakdown: SettlementInput["breakdown"];
  status: "issued" | "approved" | "paid" | "void";
  paid_at: string | null;
  closed_at: string;
}

export const SETTLEMENT_STATUS_LABELS: Record<AdSettlement["status"], string> = {
  issued: "Emitida",
  approved: "Aprobada",
  paid: "Pagada",
  void: "Anulada",
};
