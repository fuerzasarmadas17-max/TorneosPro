import { supabaseAdmin } from "@/lib/supabase-server";
import { getTournamentPriceInfo, TIER_PRICES, withCupsSurcharge } from "@/lib/pricing";
import { Sport, TournamentTier } from "@/types";

const INDIVIDUAL_SPORTS: Sport[] = ["tenis", "padel", "ping-pong"];

export interface UpgradeQuote {
  needsUpgrade: boolean;
  /** Amount to charge in COP (already accounts for the original coupon/bono). */
  cobro: number;
  newTier: TournamentTier;
  newTierLabel: string;
  newPrice: number;
  currentCount: number;
  isIndividual: boolean;
}

/**
 * Computes the cost of adding `addCount` teams to a tournament, honoring the
 * discount (bono) the tournament was originally created with. Runs server-side
 * so the amount can't be tampered with by the client.
 *
 *   cobro = (lista_nuevo − lista_actual) × (1 − d)
 *
 * where d is the original coupon's discount (0 none, 0.5 for 50%, 1 for 100%).
 */
export async function computeUpgradeQuote(
  tournamentId: string,
  addCount: number
): Promise<UpgradeQuote | null> {
  const { data: tournament } = await supabaseAdmin
    .from("tournaments")
    .select("id, sport, plan, tier, coupon_id, cups_surcharge_paid")
    .eq("id", tournamentId)
    .single();

  if (!tournament) return null;

  const { count } = await supabaseAdmin
    .from("tournament_teams")
    .select("team_id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);

  const currentCount = count ?? 0;
  const newTotal = currentCount + Math.max(0, addCount);

  const isIndividual = INDIVIDUAL_SPORTS.includes(tournament.sport as Sport);

  // A genuinely free tournament (free tier, no coupon) has no paid baseline.
  const hasPaidBaseline =
    Boolean(tournament.coupon_id) || tournament.plan === "paid";

  // El cupo comprado se lee del `tier` guardado, NO del conteo actual de
  // equipos. Si el organizador borró equipos, el cupo sigue siendo suyo: quien
  // pagó Pro (17-24) y bajó a 16 no puede volver a pagar los $30.000 para
  // llegar a 17. El `max` con el precio del conteo actual es un cinturón por si
  // el `tier` quedó desactualizado hacia abajo.
  const paidTierPrice = tournament.tier
    ? (TIER_PRICES[tournament.tier as TournamentTier] ?? 0)
    : 0;
  // Un torneo que ya pagó las copas lleva el recargo en los dos precios, así
  // la ampliación también lo cobra sobre la diferencia.
  const conCopas = (price: number) =>
    tournament.cups_surcharge_paid ? withCupsSurcharge(price) : price;
  const listaOld = hasPaidBaseline
    ? conCopas(Math.max(paidTierPrice, getTournamentPriceInfo(currentCount).price))
    : 0;
  const newInfo = getTournamentPriceInfo(newTotal);
  const listaNew = conCopas(newInfo.price);

  // Recover the original discount fraction from the tournament's coupon.
  const d = await getCouponDiscount(tournament.coupon_id);

  const needsUpgrade = listaNew > listaOld;
  const cobro = needsUpgrade
    ? Math.max(0, Math.round((listaNew - listaOld) * (1 - d)))
    : 0;

  return {
    needsUpgrade,
    cobro,
    newTier: newInfo.tier,
    newTierLabel: newInfo.tierLabel,
    newPrice: listaNew,
    currentCount,
    isIndividual,
  };
}

/**
 * El descuento del bono con el que se creó el torneo, como fracción: 0 sin
 * bono, 0.5 para uno del 50%, 1 para uno del 100% (o de torneo gratis). Es la
 * regla de todos los cobros posteriores a la creación: se cobran con el mismo
 * descuento con el que se creó el torneo.
 */
export async function getCouponDiscount(couponId: string | null | undefined): Promise<number> {
  if (!couponId) return 0;
  const { data: coupon } = await supabaseAdmin
    .from("coupons")
    .select("type, value")
    .eq("id", couponId)
    .single();
  if (!coupon) return 0;
  if (coupon.type === "free_tournament") return 1;
  if (coupon.type === "percentage")
    return Math.min(1, Math.max(0, (coupon.value ?? 0) / 100));
  return 0;
}
