export interface Sponsor {
  id: string;
  imageUrl: string;
  linkUrl: string;
}

export type Sport =
  | "futbol"
  | "beisbol"
  | "softball"
  | "wiffleball"
  | "volleyball"
  | "basketball"
  | "ping-pong"
  | "tenis"
  | "padel";

export type TournamentFormat = "elimination" | "round-robin" | "group-playoff";

export type MatchPhase = "group" | "playoff";

export type TournamentStatus = "upcoming" | "in-progress" | "completed";

export type MatchStatus = "unscheduled" | "scheduled" | "postponed" | "completed";

export interface OrganizationProfile {
  slug: string;
  organizationName: string;
  bio?: string;
  logoUrl?: string;
  socialLinks?: {
    website?: string;
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
  location?: string;
  foundedYear?: number;
  sponsors?: Sponsor[];
  isPublic: boolean;
}

export type UserRole = "user" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  isActive?: boolean;
  avatarUrl?: string;
  createdTournamentIds: string[];
  organizationProfile?: OrganizationProfile;
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  age?: number;
}

export interface Team {
  id: string;
  name: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  players: Player[];
}

export type MatchEventType =
  | "goal" | "assist" | "yellow_card" | "red_card"
  | "hit" | "double" | "triple" | "home_run" | "error"
  | "ace" | "double_fault" | "winner"
  | "block" | "point" | "steal" | "rebound"
  | "goals_against" | "strikeout" | "ejection";

export interface MatchEvent {
  id: string;
  matchId: string;
  teamId: string;
  playerName: string;
  type: MatchEventType;
  position?: string;
  paid?: boolean;
}

export const BASEBALL_POSITIONS = [
  "P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF",
] as const;

export interface VolleyballSet {
  setNumber: number;
  homePoints: number;
  awayPoints: number;
}

export type SportCategory = "futbol" | "baseball" | "basketball" | "volleyball" | "no-stats";

export function getSportCategory(sport: Sport): SportCategory {
  if (sport === "volleyball") return "volleyball";
  if (sport === "ping-pong" || sport === "tenis" || sport === "padel") return "no-stats";
  if (sport === "beisbol" || sport === "softball" || sport === "wiffleball") return "baseball";
  if (sport === "basketball") return "basketball";
  return "futbol";
}

export interface StatDefinition {
  key: MatchEventType;
  label: string;
  pluralLabel: string;
  sportDefaults: Sport[];
  computed?: boolean; // true = calculated from match scores, not from player events
}

export const STAT_CATALOG: StatDefinition[] = [
  { key: "goal", label: "Gol", pluralLabel: "Goles", sportDefaults: ["futbol"] },
  { key: "assist", label: "Asistencia", pluralLabel: "Asistencias", sportDefaults: ["futbol", "basketball"] },
  { key: "yellow_card", label: "Tarjeta Amarilla", pluralLabel: "Tarjetas Amarillas", sportDefaults: ["futbol", "volleyball"] },
  { key: "red_card", label: "Tarjeta Roja", pluralLabel: "Tarjetas Rojas", sportDefaults: ["futbol", "volleyball"] },
  { key: "goals_against", label: "Malla Menos Vencida", pluralLabel: "Malla Menos Vencida", sportDefaults: ["futbol"], computed: true },
  { key: "hit", label: "Hit", pluralLabel: "Hits", sportDefaults: ["beisbol", "softball", "wiffleball"] },
  { key: "double", label: "Doble", pluralLabel: "Dobles", sportDefaults: ["beisbol", "softball", "wiffleball"] },
  { key: "triple", label: "Triple", pluralLabel: "Triples", sportDefaults: ["beisbol", "softball", "wiffleball"] },
  { key: "home_run", label: "Home Run", pluralLabel: "Home Runs", sportDefaults: ["beisbol", "softball", "wiffleball"] },
  { key: "error", label: "Error", pluralLabel: "Errores", sportDefaults: ["beisbol", "softball", "wiffleball"] },
  { key: "ace", label: "Ace", pluralLabel: "Aces", sportDefaults: [] },
  { key: "double_fault", label: "Doble Falta", pluralLabel: "Dobles Faltas", sportDefaults: [] },
  { key: "winner", label: "Winner", pluralLabel: "Winners", sportDefaults: [] },
  { key: "block", label: "Bloqueo", pluralLabel: "Bloqueos", sportDefaults: ["basketball"] },
  { key: "point", label: "Punto", pluralLabel: "Puntos", sportDefaults: ["basketball"] },
  { key: "strikeout", label: "Ponche", pluralLabel: "Ponches", sportDefaults: ["beisbol", "softball", "wiffleball"] },
  { key: "ejection", label: "Expulsion", pluralLabel: "Expulsiones", sportDefaults: ["beisbol", "softball", "wiffleball", "basketball"] },
  { key: "steal", label: "Robo", pluralLabel: "Robos", sportDefaults: ["basketball"] },
  { key: "rebound", label: "Rebote", pluralLabel: "Rebotes", sportDefaults: ["basketball"] },
];

export function getDefaultStats(sport: Sport): MatchEventType[] {
  return STAT_CATALOG
    .filter((s) => s.sportDefaults.includes(sport))
    .map((s) => s.key);
}

export function getStatDefinition(key: string): StatDefinition | undefined {
  return STAT_CATALOG.find((s) => s.key === key);
}

export interface Match {
  id: string;
  tournamentId: string;
  round: number;
  matchNumber: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerId: string | null;
  status: MatchStatus;
  date?: string;
  time?: string;
  venue?: string;
  postponedReason?: string;
  nextMatchId?: string | null;
  events?: MatchEvent[];
  sets?: VolleyballSet[];
  phase?: MatchPhase;
  groupId?: string;
}

export interface StandingsEntry {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface BaseballStandingsEntry {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  pct: number;
  gb: number;
  runsFor: number;
  runsAgainst: number;
  diff: number;
}

export interface BasketballStandingsEntry {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  pct: number;
  gb: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
}

export interface VolleyballStandingsEntry {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  pct: number;
  gb: number;
  setsFor: number;
  setsAgainst: number;
  diff: number;
}

export interface TournamentGroup {
  id: string;
  name: string;
  teamIds: string[];
}

export interface PlayoffConfig {
  advancePerGroup: number;
  totalAdvancing: number;
}

export type TournamentPlan = "free" | "paid";

export interface Tournament {
  id: string;
  name: string;
  sport: Sport;
  format: TournamentFormat;
  plan: TournamentPlan;
  status: TournamentStatus;
  description?: string;
  createdBy: string;
  teamIds: string[];
  matches: Match[];
  createdAt: string;
  startDate: string;
  endDate?: string;
  groups?: TournamentGroup[];
  playoffConfig?: PlayoffConfig;
  groupStageComplete?: boolean;
  doubleRoundRobin?: boolean;
  enabledStats?: MatchEventType[];
  maxPlayersPerTeam?: number;
  bestOf?: 3 | 5;
  sponsors?: Sponsor[];
  monthlyCost?: number;
}

export interface TournamentFilters {
  sport?: Sport;
  format?: TournamentFormat;
  status?: TournamentStatus;
  search?: string;
}

export interface SportInfo {
  key: Sport;
  label: string;
  emoji: string;
  scoringUnit: string;
}

export interface AuthState {
  user: Omit<User, "password"> | null;
  isAuthenticated: boolean;
}
