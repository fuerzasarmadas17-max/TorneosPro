import { supabaseAdmin } from "@/lib/supabase-server";
import { getCupsSurcharge, TIER_PRICES } from "@/lib/pricing";
import { replaceTournamentCups } from "@/lib/db/tournaments";
import { getCouponDiscount } from "@/lib/payments/upgrade";
import { TournamentCup, TournamentTier } from "@/types";

export interface CupsQuote {
  /** El torneo ya pagó el recargo: prender copas otra vez no cobra nada. */
  alreadyPaid: boolean;
  /** El recargo a precio de lista (15% del precio del torneo). Es lo que
   *  sube el precio del torneo, se cobre o no. */
  listSurcharge: number;
  /** Lo que se cobra de verdad: el recargo con el mismo descuento del bono con
   *  que se creó el torneo. 0 con bono del 100%. */
  cobro: number;
}

/**
 * Cuánto cuesta prender las copas en este torneo. Corre en el servidor para
 * que el monto no se pueda tocar desde el navegador.
 *
 * Misma regla que las ampliaciones de equipos (`computeUpgradeQuote`):
 *
 *   cobro = recargo × (1 − d)
 *
 * con d el descuento del bono original. Con bono del 100% no se cobra, pero el
 * precio del torneo sube igual: si el torneo está fiado contra publicidad, la
 * deuda crece sola, porque se deriva del precio (ver
 * `Por hacer/publicidad/como-funciona-monetizar.md`).
 */
export async function computeCupsQuote(tournamentId: string): Promise<CupsQuote | null> {
  const { data: t } = await supabaseAdmin
    .from("tournaments")
    .select("id, tier, price, coupon_id, cups_surcharge_paid")
    .eq("id", tournamentId)
    .single();
  if (!t) return null;

  const listPrice = t.tier
    ? (TIER_PRICES[t.tier as TournamentTier] ?? Number(t.price) ?? 0)
    : Number(t.price) || 0;
  const listSurcharge = getCupsSurcharge(listPrice);
  const d = await getCouponDiscount(t.coupon_id as string | null);
  return {
    alreadyPaid: Boolean(t.cups_surcharge_paid),
    listSurcharge,
    cobro: Math.max(0, Math.round(listSurcharge * (1 - d))),
  };
}

/**
 * Deja el recargo como pagado y le suma al precio del torneo el recargo de
 * lista. Idempotente: si ya estaba pagado no vuelve a sumar.
 */
export async function markCupsSurchargePaid(
  tournamentId: string,
  listSurcharge: number
): Promise<boolean> {
  const { data: t } = await supabaseAdmin
    .from("tournaments")
    .select("price, cups_surcharge_paid")
    .eq("id", tournamentId)
    .single();
  if (!t) return false;
  if (t.cups_surcharge_paid) return true;
  const { error } = await supabaseAdmin
    .from("tournaments")
    .update({
      cups_surcharge_paid: true,
      price: (Number(t.price) || 0) + listSurcharge,
    })
    .eq("id", tournamentId)
    .eq("cups_surcharge_paid", false);
  return !error;
}

/**
 * Después de un pago aprobado: crea las copas que el organizador había armado
 * antes de ir a pagar. Hace lo mismo que `configureCups` en el navegador —
 * borra las llaves vacías y guarda las copas — pero solo si ninguna llave tiene
 * equipos todavía. Si ya tiene (se armó algo mientras pagaba), el recargo
 * queda pagado igual y el organizador arma las copas de nuevo desde la
 * pestaña, sin volver a pagar.
 */
export async function applyPaidCups(
  tournamentId: string,
  cups: Omit<TournamentCup, "id">[]
): Promise<void> {
  const { data: playoff } = await supabaseAdmin
    .from("matches")
    .select("id, home_team_id, away_team_id, status, home_score, away_score")
    .eq("tournament_id", tournamentId)
    .eq("phase", "playoff");
  const enMarcha = (playoff ?? []).some(
    (m) =>
      m.home_team_id ||
      m.away_team_id ||
      m.status === "completed" ||
      m.home_score != null ||
      m.away_score != null
  );
  if (enMarcha) return;
  const ids = (playoff ?? []).map((m) => m.id as string);
  if (ids.length > 0) {
    await supabaseAdmin.from("matches").delete().in("id", ids);
  }
  await replaceTournamentCups(tournamentId, cups, supabaseAdmin);
}
