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
 * Peso de una campaña comercial en la rotación (share of voice).
 *
 * Piso de 1 para que una comercial a la que todavía no le pusieron precio no
 * divida por cero. Ya no la hace rotar de verdad: sin precio es relleno y
 * `sharesFor` la deja en 0 mientras haya alguien más. Ver `campaignTier`.
 */
export const AD_WEIGHT_FLOOR = 1;

export function campaignWeight(monthlyPrice: number): number {
  return Math.max(monthlyPrice, AD_WEIGHT_FLOOR);
}

/** Lo mínimo que hay que saber de una campaña para repartirle rotación. */
export interface CampaignEconomics {
  monthly_price: number;
  /** Campaña social: no se cobra y no reparte plata (ver `is_nonprofit`). */
  is_nonprofit?: boolean;
}

/**
 * En qué liga juega una campaña a la hora de repartir apariciones.
 *
 *   paid   — comercial con precio. Compite por plata, proporcional al monto.
 *   social — campaña social marcada. No paga, pero se comprometió a salir, así
 *            que tiene cupo propio garantizado.
 *   filler — comercial en $0: o es la promo de la casa ("pauta con nosotros"),
 *            o una comercial a la que le falta el precio. Solo llena hueco.
 *
 * `is_nonprofit` manda sobre el precio: una social con monto cargado sigue
 * siendo social.
 */
export type CampaignTier = "paid" | "social" | "filler";

export function campaignTier(c: CampaignEconomics): CampaignTier {
  if (c.is_nonprofit) return "social";
  return c.monthly_price > 0 ? "paid" : "filler";
}

/**
 * Cuánto del inventario de un torneo se les reserva a las campañas sociales
 * cuando compiten contra alguien que paga. Se reparte en partes iguales entre
 * las sociales al aire.
 *
 * Existe porque el sorteo por plata las borraba: una gratis pesaba 1 contra los
 * $85.000 de una comercial, o sea una aparición cada 85 mil cargas. En los
 * papeles "rotaba"; en la práctica no salía nunca, y a una causa que aceptamos
 * publicar le habíamos prometido pantalla.
 *
 * El costo es explícito: quien paga cede este 20%. Por eso es una constante con
 * nombre y no un número suelto — el día que se renegocie, se cambia acá y el
 * panel del admin muestra el share nuevo sin tocar nada más.
 */
export const SOCIAL_RESERVED_SHARE = 0.2;

/**
 * Reparte 100% entre las campañas que compiten por un torneo. Es la
 * probabilidad real de que a un visitante le toque cada una.
 *
 * Tres ligas, en orden de prioridad:
 *
 *   1. Si hay comerciales con precio, se llevan el 80% (o el 100% si no hay
 *      ninguna social), repartido proporcional a lo que paga cada una.
 *   2. Las sociales se reparten en partes iguales el 20% reservado. Si no hay
 *      nadie pagando, se llevan todo: no hay a quién quitarle.
 *   3. Las de relleno (comerciales en $0, incluida la promo de la casa) solo
 *      salen cuando no hay ni pagas ni sociales elegibles. Ahí se reparten el
 *      100% en partes iguales.
 *
 * Las que quedan fuera reciben 0 explícito, no ausencia: el panel del admin
 * necesita poder mostrar "0%" para que se entienda que la campaña le apunta al
 * torneo pero no va a salir mientras haya otra.
 */
export function sharesFor<T extends CampaignEconomics>(
  pool: readonly T[]
): Map<T, number> {
  const shares = new Map<T, number>();
  if (pool.length === 0) return shares;

  const paid = pool.filter((c) => campaignTier(c) === "paid");
  const social = pool.filter((c) => campaignTier(c) === "social");
  const filler = pool.filter((c) => campaignTier(c) === "filler");

  for (const c of pool) shares.set(c, 0);

  // Nadie con precio y ninguna social: el relleno se reparte el torneo.
  if (paid.length === 0 && social.length === 0) {
    for (const c of filler) shares.set(c, 1 / filler.length);
    return shares;
  }

  const socialShare =
    social.length === 0 ? 0 : paid.length === 0 ? 1 : SOCIAL_RESERVED_SHARE;
  const paidShare = 1 - socialShare;

  for (const c of social) shares.set(c, socialShare / social.length);

  if (paid.length > 0) {
    const total = paid.reduce((s, c) => s + campaignWeight(c.monthly_price), 0);
    if (total > 0) {
      for (const c of paid) {
        shares.set(c, (campaignWeight(c.monthly_price) / total) * paidShare);
      }
    }
  }

  return shares;
}
