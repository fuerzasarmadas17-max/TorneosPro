/**
 * Emparejamiento campaña ↔ torneo: la única definición.
 *
 * Vive acá y no dentro del endpoint porque hay DOS consumidores que tienen que
 * dar exactamente el mismo resultado:
 *
 *   1. `/api/ads/resolve` — lo que el espectador ve de verdad.
 *   2. El inventario de `/admin/ads` — lo que el admin cree que el espectador ve.
 *
 * Si el panel tuviera su propia copia, el día que cambie una regla mostraría
 * torneos donde la publicidad ya no sale, y la pantalla que existe para dejar
 * de estar ciego pasaría a mentir con confianza. Ese tipo de duplicación ya
 * causó un bug real en este repo (el esqueleto del bracket de playoffs estaba
 * copiado en tres lugares y uno se quedó atrás).
 */

/** Los campos de una campaña que deciden a qué torneos les pega. */
export interface CampaignTargeting {
  id: string;
  target_mode: "rule" | "list";
  target_sports: string[];
  target_statuses: string[];
  target_scopes: string[];
  target_departments: string[];
  target_municipalities: string[];
}

/** Los atributos de un torneo contra los que se evalúa la regla. */
export interface TournamentTargeting {
  sport: string | null;
  status: string | null;
  scope: string | null;
  department: string | null;
  municipality: string | null;
}

/** Vigencia de una campaña. */
export interface CampaignSchedule {
  is_active: boolean;
  starts_at: string;
  ends_at: string;
}

/**
 * Un criterio de regla pega si está vacío (comodín) o contiene el valor del
 * torneo. Si el torneo no tiene el dato (ej. un torneo nacional sin
 * departamento), un filtro no vacío NO lo incluye — a propósito: el negocio
 * local no quiere pagar por audiencia de todo el país.
 */
export function ruleMatches(
  c: CampaignTargeting,
  t: TournamentTargeting
): boolean {
  const has = (arr: string[], val: string | null) =>
    arr.length === 0 || (val != null && arr.includes(val));
  return (
    has(c.target_sports, t.sport) &&
    has(c.target_statuses, t.status) &&
    has(c.target_scopes, t.scope) &&
    has(c.target_departments, t.department) &&
    has(c.target_municipalities, t.municipality)
  );
}

/**
 * ¿Esta campaña le pega a este torneo?
 *
 * `isListed` es la pertenencia ya resuelta en `ad_campaign_tournaments` para
 * este par campaña/torneo. Se recibe como booleano y no como colección porque
 * cada consumidor la tiene indexada al revés: el endpoint público consulta por
 * torneo (y obtiene campañas), el panel consulta todo (y agrupa por campaña).
 * Que cada uno resuelva su pertenencia y mande sí/no evita adaptadores.
 *
 * En modo lista la regla se ignora por completo.
 *
 * OJO: esto responde "le apunta", no "sale hoy". La vigencia es aparte
 * (`isCampaignLive`) — separadas a propósito, porque el panel necesita poder
 * mostrar a qué torneos le va a pegar una campaña que todavía no arrancó.
 */
export function campaignMatchesTournament(
  c: CampaignTargeting,
  t: TournamentTargeting,
  isListed: boolean
): boolean {
  return c.target_mode === "list" ? isListed : ruleMatches(c, t);
}

/** Prendida y dentro de su ventana de vigencia. Es lo que decide si sale. */
export function isCampaignLive(c: CampaignSchedule, now: Date = new Date()): boolean {
  return (
    c.is_active && new Date(c.starts_at) <= now && new Date(c.ends_at) > now
  );
}

/** Los cuatro estados posibles de una campaña. */
export type CampaignState = "live" | "expired" | "paused" | "scheduled";

/**
 * En qué estado está una campaña. El orden de los chequeos importa: "vencida"
 * gana sobre "pausada" porque una campaña apagada Y vencida ya no se renueva
 * apretando el interruptor — hay que darle fechas nuevas.
 */
export function campaignState(
  c: CampaignSchedule,
  now: Date = new Date()
): CampaignState {
  if (isCampaignLive(c, now)) return "live";
  if (new Date(c.ends_at) <= now) return "expired";
  if (!c.is_active) return "paused";
  return "scheduled";
}

export const CAMPAIGN_STATE_LABELS: Record<CampaignState, string> = {
  live: "Al aire",
  scheduled: "Programadas",
  paused: "Pausadas",
  expired: "Vencidas",
};

/**
 * Peso de una campaña en la rotación (share of voice).
 *
 * Piso de 1 para que una promo a $0 igual rote en vez de desaparecer. Está acá
 * y no duplicado en el picker para que el share que muestra el panel sea el
 * mismo con el que se sortea de verdad.
 */
export const AD_WEIGHT_FLOOR = 1;

export function campaignWeight(monthlyPrice: number): number {
  return Math.max(monthlyPrice, AD_WEIGHT_FLOOR);
}

/**
 * Reparte 100% entre las campañas que compiten por un torneo, proporcional al
 * peso. Es la probabilidad real de que a un visitante le toque cada una.
 */
export function sharesFor<T extends { monthly_price: number }>(
  pool: readonly T[]
): Map<T, number> {
  const shares = new Map<T, number>();
  const total = pool.reduce((s, c) => s + campaignWeight(c.monthly_price), 0);
  if (total <= 0) return shares;
  for (const c of pool) shares.set(c, campaignWeight(c.monthly_price) / total);
  return shares;
}
