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

// ============================================================================
// El mes es el mes COLOMBIANO
// ============================================================================
// Antes esto usaba la hora del dispositivo (`new Date(y, m, 1)`). Funcionaba
// porque quien abre el panel está en Colombia, pero es una suposición que nadie
// escribió: desde otro huso el navegador contaría un mes corrido unas horas
// respecto del que usa la base, y `close_ad_period` rechazaría el cierre con
// "Personas-día no coinciden" sin que se entienda por qué.
//
// Colombia no tiene horario de verano desde 1993: es UTC-5 todo el año, así que
// alcanza con un desplazamiento fijo. Del lado de la base el equivalente es
// `co_day()` / `co_start()` (ver 20260808e_dia_colombiano.sql); los dos tienen
// que moverse juntos.

const COLOMBIA_OFFSET_HOURS = 5;

/** Instante en que empieza (en Colombia) el mes `monthIndex0` de `year`. */
function colombiaMonthStart(year: number, monthIndex0: number): number {
  return Date.UTC(year, monthIndex0, 1, COLOMBIA_OFFSET_HOURS);
}

/** Año y mes que corren AHORA en Colombia, sin importar dónde esté el equipo. */
function colombiaNow(): { year: number; month: number } {
  const shifted = new Date(Date.now() - COLOMBIA_OFFSET_HOURS * 3600_000);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() };
}

/** Primer día del mes en curso en Colombia, en el formato DATE de Postgres. */
export function currentPeriodMonth(): string {
  const { year, month } = colombiaNow();
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

/** Límites del rango, como ISO para la RPC. */
export function rangeBounds(range: DateRange): {
  from: string | null;
  to: string | null;
} {
  if (range === "all") return { from: null, to: null };
  const { year, month } = colombiaNow();
  const offset = range === "previous" ? -1 : 0;
  return {
    from: new Date(colombiaMonthStart(year, month + offset)).toISOString(),
    to: new Date(colombiaMonthStart(year, month + offset + 1)).toISOString(),
  };
}

/** Porción de lo que paga cada campaña que va a los organizadores que le
 *  entregaron audiencia. El otro 50% es de la app. */
export const ORGANIZER_SHARE = 0.5;

/**
 * Cuánto de lo que pagó una campaña le corresponde a UN mes.
 *
 * Se divide lo cobrado entre el tiempo que la campaña estuvo al aire, y cada
 * mes se lleva lo de su parte. Una campaña de $310.000 al aire del 15 de julio
 * al 14 de agosto deja $170.000 en julio y $140.000 en agosto.
 *
 * Sin esto, esa campaña aparecería con $310.000 completos en julio y otros
 * $310.000 en agosto: se repartiría el 50% de $620.000 cuando solo entraron
 * $310.000, prometiéndole a los organizadores el doble de lo que hay.
 *
 * `paidCop` es lo COBRADO (suma de pagos aprobados), no el precio de lista
 * (decisión 2026-07-29). Si el anunciante no pagó, no hay nada que dividir y
 * todos los meses dan 0 — nunca se reparte plata que no entró.
 *
 * Se usa la proporción de tiempo y no un conteo de días para no tener que
 * decidir qué hacer con los días parciales: una campaña que arranca a media
 * tarde aporta esa media tarde.
 *
 * Redondea hacia abajo a propósito: entre dos meses puede perderse un peso, y
 * que sea de la plataforma y no de un organizador.
 */
export function proratedRevenue(
  paidCop: number,
  startsAt: string,
  endsAt: string,
  /** Primer día del mes ("2026-07-01"), o `null` para no prorratear. */
  periodMonth: string | null
): number {
  if (paidCop <= 0) return 0;

  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (!(end > start)) return 0;

  // Sin mes (histórico completo) no hay nada que recortar.
  if (!periodMonth) return Math.floor(paidCop);

  // Límites del mes colombiano, igual que `rangeBounds` y que `co_start()` en la
  // base. Tienen que coincidir los tres: es la misma ventana en la que se
  // contaron las personas-día.
  const [y, m] = periodMonth.split("-").map(Number);
  const monthStart = colombiaMonthStart(y, m - 1);
  const monthEnd = colombiaMonthStart(y, m);

  const overlap = Math.min(end, monthEnd) - Math.max(start, monthStart);
  if (overlap <= 0) return 0;

  return Math.floor(paidCop * (overlap / (end - start)));
}

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

/** Elegibilidad por defecto: cobra todo el que no esté excluido a mano.
 *
 *  Es el fallback para cuando no se pudo cargar el estado de monetización. Es
 *  deliberadamente PERMISIVO, y por eso el panel avisa cuando está actuando: si
 *  fuera restrictivo, un fallo de red se vería como "nadie clasificó" y el
 *  reparto entero en cero. */
export const defaultEligibility: EligibilityFn = (row) =>
  row.organizer_excluded
    ? { eligible: false, reason: "Cuenta excluida del reparto" }
    : { eligible: true, reason: null };

// ============================================================================
// Requisitos para monetizar
// ============================================================================

/** Lo que devuelve la RPC `get_monetization_status`. */
export interface MonetizationStatus {
  month: string;
  config: MonetizationConfig;
  organizers: MonetizationRow[];
}

export interface MonetizationConfig {
  min_tournaments_in_progress: number;
  min_teams: number;
  min_person_days: number;
  min_active_days: number;
  min_matches_with_result: number;
  min_account_age_days: number;
  require_profile: boolean;
  /** Exigir datos de pago. Arranca en `false`: la pantalla para llenarlos no
   *  existe todavía, así que prenderlo dejaría a todos sin clasificar por un
   *  motivo que nadie puede resolver. */
  require_payout_info: boolean;
}

export interface MonetizationRow {
  organizer_id: string;
  organizer_name: string | null;
  excluded: boolean;
  person_days: number;
  active_days: number;
  matches_with_result: number;
  max_teams: number;
  tournaments_in_progress: number;
  account_age_days: number;
  profile_complete: boolean;
  payout_info_complete: boolean;
  /** Un admin revisó y aprobó sus datos de pago. Nadie cobra sin esto. */
  payout_approved: boolean;
  /** `missing` = ni se inscribió. */
  payout_status: "missing" | "pending" | "approved" | "rejected";
  /** Qué tiene que corregir, cuando el estado es `rejected`. */
  rejection_reason: string | null;
  /** Claves de lo que le falta para el nivel 2. */
  missing: MissingKey[];
  /** 0 = ni ve la sección · 1 = la ve con su progreso · 2 = liquidable. */
  level: 0 | 1 | 2;
  eligible: boolean;
}

export type MissingKey =
  | "matches_with_result"
  | "person_days"
  | "active_days"
  | "account_age_days"
  | "profile"
  | "payout_info"
  | "payout_approval"
  | "excluded";

export const MISSING_LABELS: Record<MissingKey, string> = {
  matches_with_result: "Pocos partidos con resultado",
  person_days: "Audiencia insuficiente",
  active_days: "Audiencia en muy pocos días",
  account_age_days: "Cuenta muy nueva",
  profile: "Perfil sin nombre o logo",
  payout_info: "Faltan los datos de pago",
  payout_approval: "Datos de pago sin aprobar",
  excluded: "Cuenta excluida del reparto",
};

/** Datos para transferirle a un organizador. SENSIBLE: cédula y cuenta. */
export interface OrganizerPayoutInfo {
  user_id: string;
  full_name: string;
  document_type: "CC" | "CE" | "NIT";
  document_number: string;
  bank: string;
  account_type: "ahorros" | "corriente";
  account_number: string;
}

/** Cuenta enmascarada para mostrar en pantalla: `****4321`. Nunca hay razón
 *  para pintar un número de cuenta completo en una lista. */
export function maskAccount(accountNumber: string): string {
  const digits = accountNumber.replace(/\s/g, "");
  return digits.length <= 4 ? digits : "****" + digits.slice(-4);
}

/** Motivo corto para la tabla: el primero que falta, y cuántos más. */
export function missingLabel(missing: MissingKey[]): string {
  if (missing.length === 0) return "";
  const first = MISSING_LABELS[missing[0]] ?? missing[0];
  return missing.length > 1 ? `${first} (+${missing.length - 1})` : first;
}

/**
 * Elegibilidad real, a partir del estado de monetización.
 *
 * Un organizador que no aparece en el estado no clasifica: si tiene audiencia de
 * publicidad pero la RPC no lo devolvió, algo no cuadra y lo seguro es no
 * pagarle hasta entender qué pasó.
 */
export function eligibilityFrom(status: MonetizationStatus): EligibilityFn {
  const byId = new Map(status.organizers.map((o) => [o.organizer_id, o]));
  return (row) => {
    const o = byId.get(row.organizer_id);
    if (!o) return { eligible: false, reason: "Sin datos de requisitos" };
    return o.eligible
      ? { eligible: true, reason: null }
      : { eligible: false, reason: missingLabel(o.missing) || "No clasifica" };
  };
}

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
  if (range === "current") return currentPeriodMonth();
  const { year, month } = colombiaNow();
  const prev = new Date(colombiaMonthStart(year, month - 1) + 3600_000);
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** ¿Ya terminó ese mes? Un mes en curso no se puede cerrar: las personas-día
 *  seguirían subiendo después de congelar y el corte quedaría corto. */
export function isMonthClosable(periodMonth: string | null): boolean {
  if (!periodMonth) return false;
  // Contra el mes colombiano: el 1 de septiembre a la medianoche de Bogotá
  // agosto ya se puede cerrar, aunque en UTC todavía sea agosto.
  return periodMonth < currentPeriodMonth();
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

/** Lo que le habría tocado si clasificara. Para un organizador elegible es
 *  igual a `totalCop`; para uno que no clasifica es lo que queda con la
 *  plataforma por su audiencia. */
export function wouldBeTotal(o: OrganizerPayout): number {
  return o.slices.reduce((a, s) => a + s.wouldBeCop, 0);
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
  /** Número de la transferencia según el banco. Obligatorio para marcar
   *  "Pagada" — sin él, ese estado es una afirmación que nadie puede verificar
   *  después. Lo exige la base, no solo el formulario. */
  payment_reference: string | null;
  closed_at: string;
}

/** Una línea del archivo de pagos: a quién, cuánto y a qué cuenta. */
export interface PayoutBatchRow {
  organizerName: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  bank: string;
  accountType: string;
  accountNumber: string;
  amountCop: number;
}

/**
 * Arma el CSV para cargar en el banco.
 *
 * ⚠️ El formato exacto lo define cada banco. Este archivo lleva las columnas que
 * todos piden, en texto plano y separadas por punto y coma —no por coma— porque
 * en Excel en español la coma es el separador decimal y el archivo se abre
 * corrido en una sola columna.
 *
 * Los montos van sin puntos ni símbolo: "125000", no "$125.000". Un banco que
 * recibe "$125.000" lo lee como 125 pesos, o lo rechaza.
 */
export function buildPayoutCsv(rows: PayoutBatchRow[]): string {
  const head = [
    "Organizador",
    "Nombre titular",
    "Tipo documento",
    "Documento",
    "Banco",
    "Tipo cuenta",
    "Numero cuenta",
    "Valor",
  ];

  // El punto y coma dentro de un nombre partiría la fila; se cambia por coma.
  const clean = (v: string) => v.replace(/[;\r\n]/g, ",").trim();

  return [
    head.join(";"),
    ...rows.map((r) =>
      [
        clean(r.organizerName),
        clean(r.fullName),
        clean(r.documentType),
        clean(r.documentNumber),
        clean(r.bank),
        clean(r.accountType),
        clean(r.accountNumber),
        String(r.amountCop),
      ].join(";")
    ),
  ].join("\n");
}

export const SETTLEMENT_STATUS_LABELS: Record<AdSettlement["status"], string> = {
  issued: "Emitida",
  approved: "Aprobada",
  paid: "Pagada",
  void: "Anulada",
};

// ============================================================================
// La vista del organizador
// ============================================================================
// DURANTE EL MES NO SE LE MUESTRA PLATA. Solo audiencia.
//
// La versión anterior le mostraba una proyección en pesos con la etiqueta
// "estimado". Se quitó por dos razones que apuntan al mismo lado:
//
//   1. Un número con pesos adelante se lee como promesa por más que diga
//      "estimado". Y baja: si otro organizador suma audiencia a la misma
//      campaña, la tarifa cae para todos. Enseñar $47.300 el día 10 y $31.000
//      el día 20 arruina la relación aunque las dos cifras estén bien.
//   2. Sin monto ni tarifa durante el mes, no queda ningún número que se pueda
//      invertir para deducir cuánto pagó el anunciante.
//
// La plata aparece en el histórico, cuando el mes se cierra y el monto queda
// congelado. Ahí ya no es una estimación: es lo que se le va a transferir.
//
// Consecuencia: la RPC sigue devolviendo `paid_cop` y `total_person_days`
// porque es la misma función, pero esta capa ya no los mira. Es información que
// entra al servidor y no sale.

/** Una campaña donde el organizador aportó audiencia. ⚠️ SOLO SERVIDOR: trae lo
 *  que pagó el anunciante y la audiencia total de la campaña. */
export interface MyEarningsCampaignRow {
  campaign_id: string;
  /** `null` si la campaña se eliminó y quedaron sus eventos. */
  advertiser_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
  /** Campaña social: no se cobra, así que nunca va a repartir. */
  is_nonprofit: boolean;
  my_person_days: number;
  total_person_days: number;
  paid_cop: number;
  revenue_override_cop: number | null;
  tournaments: {
    tournament_id: string;
    tournament_name: string | null;
    person_days: number;
  }[];
}

/** ⚠️ SOLO SERVIDOR. Lo que devuelve `get_my_ad_earnings`. */
export interface MyEarningsIngredients {
  month: string;
  campaigns: MyEarningsCampaignRow[];
}

/** Una fila de la tabla del mes. Esto sí viaja al navegador: audiencia y nada
 *  más. */
export interface MyAudienceCampaign {
  campaignId: string;
  advertiserName: string | null;
  nonprofit: boolean;
  myPersonDays: number;
  tournaments: {
    tournamentId: string;
    tournamentName: string | null;
    personDays: number;
  }[];
}

/**
 * No lleva un total de personas: sumar las campañas cuenta dos veces a quien vio
 * dos el mismo día, y ese total tampoco cuadra con el requisito de audiencia,
 * que se mide sobre las visitas a los torneos. Serían dos números del mismo mes
 * sin forma de saber cuál mirar.
 */
export interface MyAudienceSummary {
  month: string;
  campaigns: MyAudienceCampaign[];
}

export const EMPTY_AUDIENCE: MyAudienceSummary = { month: "", campaigns: [] };

/** Se queda con lo único que el organizador puede ver del mes en curso.
 *  ⚠️ SOLO SERVIDOR: la entrada trae datos que no deben salir. */
export function computeMyAudience(
  data: MyEarningsIngredients | null
): MyAudienceSummary {
  if (!data) return EMPTY_AUDIENCE;

  return {
    month: data.month,
    campaigns: data.campaigns
      .map((c) => ({
        campaignId: c.campaign_id,
        advertiserName: c.advertiser_name,
        nonprofit: c.is_nonprofit,
        myPersonDays: c.my_person_days,
        tournaments: c.tournaments.map((t) => ({
          tournamentId: t.tournament_id,
          tournamentName: t.tournament_name,
          personDays: t.person_days,
        })),
      }))
      .sort((a, b) => b.myPersonDays - a.myPersonDays),
  };
}

// ----------------------------------------------------------------------------
// Cortes cerrados, como los ve el organizador
// ----------------------------------------------------------------------------

/**
 * Un corte cerrado. Acá SÍ hay plata: el mes terminó y el monto quedó congelado.
 *
 * ⚠️ NO LLEVA EL TOTAL DE PERSONAS-DÍA, a propósito.
 * `ad_settlements.person_days` es la SUMA de las celdas campaña × organizador:
 * quien vio dos campañas el mismo día cuenta dos veces. Es el número correcto
 * para el admin —es el que se congeló— pero al lado del requisito de audiencia,
 * que se mide distinto, serían dos cifras que no cuadran sin explicación
 * posible. La audiencia por campaña sí se muestra: esa no se suma con nada.
 *
 * Tampoco lleva el `share`. Con el porcentaje y el monto se deduce lo que pagó
 * el anunciante (monto ÷ % ÷ 50%); con la tarifa por persona no, porque le
 * faltaría la audiencia total de la campaña.
 */
export interface MySettlement {
  id: string;
  periodMonth: string;
  amountCop: number;
  status: AdSettlement["status"];
  paidAt: string | null;
  campaigns: {
    campaignId: string;
    personDays: number;
    ratePerPersonDay: number;
    amountCop: number;
  }[];
}

/** ⚠️ SOLO SERVIDOR: la entrada trae `share`, que es lo que no debe salir. */
export function toMySettlement(s: AdSettlement): MySettlement {
  return {
    id: s.id,
    periodMonth: s.period_month,
    amountCop: s.amount_cop,
    status: s.status,
    paidAt: s.paid_at,
    campaigns: (s.breakdown ?? []).map((b) => ({
      campaignId: b.campaign_id,
      personDays: b.person_days,
      ratePerPersonDay:
        b.person_days > 0 ? Math.floor(b.amount_cop / b.person_days) : 0,
      amountCop: b.amount_cop,
    })),
  };
}

