/**
 * Filtrado de la lista de campañas.
 *
 * Vive aparte de los componentes porque hay dos listas que lo necesitan —la
 * pestaña Campañas y la vista "Por campaña" del inventario— y porque con
 * decenas de campañas el criterio de "qué hay que atender hoy" es lo que
 * convierte una lista larga en algo usable.
 */

import { campaignState, type CampaignSchedule } from "./targeting";

/** Estado de cobro tal como lo arma el panel desde `ad_payments`. */
export type PayState = "paid" | "pending" | "none";

export interface FilterableCampaign extends CampaignSchedule {
  id: string;
  advertiser_name: string;
}

export interface CampaignFilterValue {
  /** Texto libre contra el nombre del anunciante. */
  query: string;
  /** `all` o uno de los CampaignState. */
  state: string;
  /** `all` | `paid` | `pending` | `none`. */
  pay: string;
  /** Solo las que vencen dentro de `EXPIRING_DAYS`. La cola de renovación. */
  expiringSoon: boolean;
}

export const EMPTY_CAMPAIGN_FILTER: CampaignFilterValue = {
  query: "",
  state: "all",
  pay: "all",
  expiringSoon: false,
};

/** Ventana de "vence pronto". Una semana es lo que da para llamar y cobrar. */
export const EXPIRING_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isExpiringSoon(
  c: CampaignSchedule,
  now: Date = new Date()
): boolean {
  if (campaignState(c, now) !== "live") return false;
  const days = (new Date(c.ends_at).getTime() - now.getTime()) / DAY_MS;
  return days <= EXPIRING_DAYS;
}

export function isCampaignFilterActive(f: CampaignFilterValue): boolean {
  return (
    f.query.trim() !== "" ||
    f.state !== "all" ||
    f.pay !== "all" ||
    f.expiringSoon
  );
}

export function filterCampaigns<T extends FilterableCampaign>(
  campaigns: readonly T[],
  f: CampaignFilterValue,
  /** `campaign_id → estado de cobro`. Sin entrada = sin link generado. */
  payStatus: Readonly<Record<string, "paid" | "pending">> = {},
  now: Date = new Date()
): T[] {
  const q = f.query.trim().toLowerCase();
  return campaigns.filter((c) => {
    if (q && !c.advertiser_name.toLowerCase().includes(q)) return false;
    if (f.state !== "all" && campaignState(c, now) !== f.state) return false;
    if (f.pay !== "all") {
      const pay: PayState = payStatus[c.id] ?? "none";
      if (pay !== f.pay) return false;
    }
    if (f.expiringSoon && !isExpiringSoon(c, now)) return false;
    return true;
  });
}

/**
 * Cuántas campañas hay en cada estado y en cada estado de cobro.
 *
 * Se muestran junto a cada opción del filtro para poder leer la distribución
 * sin aplicarlo — con muchas campañas, saber que hay 3 vencidas sin renovar
 * vale más que tener que buscarlas.
 */
export function campaignFilterCounts<T extends FilterableCampaign>(
  campaigns: readonly T[],
  payStatus: Readonly<Record<string, "paid" | "pending">> = {},
  now: Date = new Date()
): {
  state: Record<string, number>;
  pay: Record<PayState, number>;
  expiringSoon: number;
  total: number;
} {
  const state: Record<string, number> = {
    live: 0,
    scheduled: 0,
    paused: 0,
    expired: 0,
  };
  const pay: Record<PayState, number> = { paid: 0, pending: 0, none: 0 };
  let expiring = 0;
  for (const c of campaigns) {
    state[campaignState(c, now)]++;
    pay[(payStatus[c.id] ?? "none") as PayState]++;
    if (isExpiringSoon(c, now)) expiring++;
  }
  return { state, pay, expiringSoon: expiring, total: campaigns.length };
}
