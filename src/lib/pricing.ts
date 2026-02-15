import { TournamentFormat } from "@/types";

// --- Free tier limits ---
export const FREE_TIER_LIMITS = {
  maxTeams: 6,
  maxPlayersPerTeam: 10,
  allowedFormats: ["elimination"] as TournamentFormat[],
  statsEnabled: false,
  maxGroups: 0,
  maxActiveFree: 1,
} as const;

export interface FreeTierCheck {
  isFree: boolean;
  reasons: string[]; // reasons why it's NOT free (empty if free)
}

export function checkFreeTier(input: {
  format: TournamentFormat;
  teamCount: number;
  maxPlayersPerTeam: number;
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
  if (input.maxPlayersPerTeam > FREE_TIER_LIMITS.maxPlayersPerTeam) {
    reasons.push(`Maximo ${FREE_TIER_LIMITS.maxPlayersPerTeam} jugadores/equipo en plan gratis`);
  }
  if (input.enabledStatsCount > 0) {
    reasons.push("Estadisticas solo disponibles en plan pago");
  }
  if (input.groupCount > 0) {
    reasons.push("Grupos solo disponibles en plan pago");
  }

  return { isFree: reasons.length === 0, reasons };
}

// --- Paid tier pricing ---
const BASE_COST = 25_000;
const COST_PER_RECORD = 25;
const MIN_MONTHLY_COST = 30_000;
const MAX_MONTHLY_COST = 50_000;
const ESTIMATED_EVENTS_PER_STAT_PER_MATCH = 2;

export interface TournamentCostInput {
  format: TournamentFormat;
  teamCount: number;
  maxPlayersPerTeam: number;
  enabledStatsCount: number;
  groups: { teamCount: number }[];
  advanceCount: number;
}

export interface TournamentCostBreakdown {
  teamRecords: number;
  playerRecords: number;
  matchRecords: number;
  estimatedEventRecords: number;
  groupRecords: number;
  totalRecords: number;
  baseCost: number;
  storageCost: number;
  monthlyCost: number;
}

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

export function calculateTournamentCost(
  input: TournamentCostInput
): TournamentCostBreakdown {
  const teamRecords = input.teamCount;
  const playerRecords = input.teamCount * input.maxPlayersPerTeam;
  const matchRecords = calculateMatchCount(
    input.format,
    input.teamCount,
    input.groups,
    input.advanceCount
  );
  const estimatedEventRecords =
    matchRecords * input.enabledStatsCount * ESTIMATED_EVENTS_PER_STAT_PER_MATCH;
  const groupRecords = input.groups.length;

  const totalRecords =
    1 + teamRecords + playerRecords + matchRecords + estimatedEventRecords + groupRecords;

  const storageCost = totalRecords * COST_PER_RECORD;
  const rawCost = BASE_COST + storageCost;
  const clamped = Math.min(MAX_MONTHLY_COST, Math.max(MIN_MONTHLY_COST, rawCost));
  const monthlyCost = Math.round(clamped / 5_000) * 5_000;

  return {
    teamRecords,
    playerRecords,
    matchRecords,
    estimatedEventRecords,
    groupRecords,
    totalRecords,
    baseCost: BASE_COST,
    storageCost,
    monthlyCost,
  };
}

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
