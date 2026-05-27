import { supabaseAdmin } from "@/lib/supabase-server";
import { getTournamentPriceInfo } from "@/lib/pricing";
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
    .select("id, sport, plan, tier, coupon_id")
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
  const listaOld = hasPaidBaseline
    ? getTournamentPriceInfo(currentCount).price
    : 0;
  const newInfo = getTournamentPriceInfo(newTotal);
  const listaNew = newInfo.price;

  // Recover the original discount fraction from the tournament's coupon.
  let d = 0;
  if (tournament.coupon_id) {
    const { data: coupon } = await supabaseAdmin
      .from("coupons")
      .select("type, value")
      .eq("id", tournament.coupon_id)
      .single();
    if (coupon) {
      if (coupon.type === "free_tournament") d = 1;
      else if (coupon.type === "percentage")
        d = Math.min(1, Math.max(0, (coupon.value ?? 0) / 100));
    }
  }

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
