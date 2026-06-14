import { TournamentFormat, TournamentTier } from "@/types";

// --- Free tier limits ---
export const FREE_TIER_LIMITS = {
  maxTeams: 10,
  allowedFormats: ["elimination"] as TournamentFormat[],
  statsEnabled: false,
  maxGroups: 0,
  maxActiveFree: 1,
  // scorer-links activos por torneo en plan gratuito
  maxScorerLinks: 1,
} as const;

export interface FreeTierCheck {
  isFree: boolean;
  reasons: string[]; // reasons why it's NOT free (empty if free)
}

export function checkFreeTier(input: {
  format: TournamentFormat;
  teamCount: number;
  enabledStatsCount: number;
  groupCount: number;
}): FreeTierCheck {
  const reasons: string[] = [];

  if (!FREE_TIER_LIMITS.allowedFormats.includes(input.format)) {
    reasons.push("Formato solo disponible en plan pago");
  }
  if (input.teamCount > FREE_TIER_LIMITS.maxTeams) {
    reasons.push(`Maximo ${FREE_TIER_LIMITS.maxTeams} equipos en plan gratis`);
  }
  if (input.enabledStatsCount > 0) {
    reasons.push("Estadisticas solo disponibles en plan pago");
  }
  if (input.groupCount > 0) {
    reasons.push("Grupos solo disponibles en plan pago");
  }

  return { isFree: reasons.length === 0, reasons };
}

// --- Tier-based pricing (one-time COP per tournament) ---

export const TIER_PRICES: Record<TournamentTier, number> = {
  basico: 40_000,
  medio: 70_000,
  pro: 100_000,
  premium: 130_000,
};

export const TIER_LABELS: Record<TournamentTier, string> = {
  basico: "Basico",
  medio: "Medio",
  pro: "Pro",
  premium: "Premium",
};

export const TIER_TEAM_RANGES: Record<TournamentTier, { min: number; max: number | null }> = {
  basico: { min: 1, max: 8 },
  medio: { min: 9, max: 16 },
  pro: { min: 17, max: 24 },
  premium: { min: 25, max: null },
};

/**
 * Cap de scorer-links **activos** por torneo (Por hacer/anotadores.md).
 * "Activo" = `revoked_at IS NULL AND expires_at > now()`. Expirados o
 * revocados liberan slot.
 *
 * Un valor de Number.POSITIVE_INFINITY representa "sin límite" — Premium
 * no tiene cap porque ya pagan el tier más alto.
 */
export const MAX_SCORER_LINKS_BY_TIER: Record<TournamentTier | "free", number> = {
  free: 1,
  basico: 3,
  medio: 5,
  pro: 10,
  premium: Number.POSITIVE_INFINITY,
};

export function getTier(teamCount: number): TournamentTier {
  if (teamCount <= 8) return "basico";
  if (teamCount <= 16) return "medio";
  if (teamCount <= 24) return "pro";
  return "premium";
}

export function getTierPrice(teamCount: number): number {
  return TIER_PRICES[getTier(teamCount)];
}

export interface TournamentPriceInfo {
  tier: TournamentTier;
  price: number;
  tierLabel: string;
  teamRange: { min: number; max: number | null };
}

export function getTournamentPriceInfo(teamCount: number): TournamentPriceInfo {
  const tier = getTier(teamCount);
  return {
    tier,
    price: TIER_PRICES[tier],
    tierLabel: TIER_LABELS[tier],
    teamRange: TIER_TEAM_RANGES[tier],
  };
}

// --- Utilities (kept for UI display) ---

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function calculateMatchCount(
  format: TournamentFormat,
  teamCount: number,
  groups: { teamCount: number }[],
  advanceCount: number
): number {
  switch (format) {
    case "elimination":
      return teamCount - 1;

    case "round-robin":
      if (groups.length > 0) {
        return groups.reduce(
          (sum, g) => sum + (g.teamCount * (g.teamCount - 1)) / 2,
          0
        );
      }
      return (teamCount * (teamCount - 1)) / 2;

    case "group-playoff": {
      const groupMatches = groups.reduce(
        (sum, g) => sum + (g.teamCount * (g.teamCount - 1)) / 2,
        0
      );
      const bracketSize = nextPowerOf2(advanceCount);
      const playoffMatches = bracketSize - 1;
      return groupMatches + playoffMatches;
    }

    default:
      return 0;
  }
}

export function distributeTeamsToGroups(
  teamCount: number,
  groupCount: number
): { teamCount: number }[] {
  const base = Math.floor(teamCount / groupCount);
  const remainder = teamCount % groupCount;
  return Array.from({ length: groupCount }, (_, i) => ({
    teamCount: base + (i < remainder ? 1 : 0),
  }));
}

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
