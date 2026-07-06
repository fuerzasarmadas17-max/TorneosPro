export interface Sponsor {
  id: string;
  imageUrl: string;
  linkUrl: string;
}

export type Sport =
  | "futbol"
  | "futsal"
  | "microfutbol"
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

export type TournamentScope = "nacional" | "departamental" | "municipal";

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
  documentNumber?: string;
  eps?: string;
  birthDate?: string;
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
  | "goals_against" | "strikeout" | "ejection"
  | "blue_card"
  | "at_bat" | "walk" | "rbi" | "run_scored"
  | "putout" | "winning_pitcher";

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
  { key: "goal", label: "Gol", pluralLabel: "Goles", sportDefaults: ["futbol", "futsal", "microfutbol"] },
  { key: "assist", label: "Asistencia", pluralLabel: "Asistencias", sportDefaults: ["futbol", "futsal", "microfutbol", "basketball", "beisbol", "softball", "wiffleball"] },
  { key: "yellow_card", label: "Tarjeta Amarilla", pluralLabel: "Tarjetas Amarillas", sportDefaults: ["futbol", "futsal", "microfutbol", "volleyball"] },
  { key: "red_card", label: "Tarjeta Roja", pluralLabel: "Tarjetas Rojas", sportDefaults: ["futbol", "futsal", "microfutbol", "volleyball"] },
  { key: "blue_card", label: "Tarjeta Azul", pluralLabel: "Tarjetas Azules", sportDefaults: ["microfutbol"] },
  { key: "goals_against", label: "Malla Menos Vencida", pluralLabel: "Malla Menos Vencida", sportDefaults: ["futbol", "futsal", "microfutbol"], computed: true },
  { key: "at_bat", label: "Turno al bate", pluralLabel: "Turnos al bate", sportDefaults: ["beisbol", "softball", "wiffleball"] },
  { key: "hit", label: "Hit", pluralLabel: "Hits", sportDefaults: ["beisbol", "softball", "wiffleball"] },
  { key: "double", label: "Doble", pluralLabel: "Dobles", sportDefaults: ["beisbol", "softball", "wiffleball"] },
  { key: "triple", label: "Triple", pluralLabel: "Triples", sportDefaults: ["beisbol", "softball", "wiffleball"] },
  { key: "home_run", label: "Home Run", pluralLabel: "Home Runs", sportDefaults: ["beisbol", "softball", "wiffleball"] },
  { key: "walk", label: "Base por bolas", pluralLabel: "Bases por bolas", sportDefaults: ["beisbol", "softball", "wiffleball"] },
  { key: "rbi", label: "Carrera impulsada", pluralLabel: "Carreras impulsadas", sportDefaults: ["beisbol", "softball", "wiffleball"] },
  { key: "run_scored", label: "Carrera anotada", pluralLabel: "Carreras anotadas", sportDefaults: ["beisbol", "softball", "wiffleball"] },
  { key: "error", label: "Error", pluralLabel: "Errores", sportDefaults: ["beisbol", "softball", "wiffleball"] },
  { key: "putout", label: "Out", pluralLabel: "Outs", sportDefaults: ["beisbol", "softball", "wiffleball"] },
  { key: "winning_pitcher", label: "Pitcher ganador", pluralLabel: "Pitchers ganadores", sportDefaults: ["beisbol", "softball", "wiffleball"] },
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
  setsFor: number;
  setsAgainst: number;
  setDiff: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  points: number;
}

export interface TournamentGroup {
  id: string;
  name: string;
  teamIds: string[];
  phase?: number;
}

export interface PhaseConfig {
  phase: number;
  /**
   * Legacy uniform advancement count. New tournaments populate `perGroup`
   * instead and the read layer expands this value to a uniform map when only
   * the legacy field is present. Kept for back-compat with stored data.
   */
  advancePerGroup: number;
  /**
   * Per-group advancement count, keyed by group id. Allows uneven cupos
   * (e.g. Grupo A → 2, Grupo B → 3). When present, takes precedence over
   * `advancePerGroup`.
   */
  perGroup?: Record<string, number>;
  nextGroupCount?: number;
  complete?: boolean;
}

export interface PlayoffConfig {
  /**
   * Legacy uniform advancement count. Read layer expands to `perGroup` when
   * only this field exists. Kept for back-compat with stored data.
   */
  advancePerGroup: number;
  /** Per-group advancement count to the elimination bracket. */
  perGroup?: Record<string, number>;
  totalAdvancing: number;
}

export type TournamentPlan = "free" | "paid";

export type TournamentTier = "basico" | "medio" | "pro" | "premium";

export type CouponType = "percentage" | "free_tournament";

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  usedBy?: string;
  usedAt?: string;
  tournamentId?: string;
  createdAt: string;
}

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
  /** Playoff bracket: if true, every matchup is decided over two legs (ida y
   *  vuelta). Independent of `doubleRoundRobin` (which applies to the group
   *  stage). Set from the "Crear enfrentamientos" screen. */
  playoffDoubleLeg?: boolean;
  /** Format of the final series. Decided when both finalists are known (Pieza I
   *  modal). When undefined, the final follows the bracket-wide format:
   *  playoffDoubleLeg → "double_leg", else "single". */
  playoffFinalFormat?: "single" | "double_leg" | "best_of_5" | "best_of_7";
  /** Once the organizer clicks "Generar fixture" in playoffs, this flips to
   *  true and the UI switches from the matchup builder to the regular
   *  bracket view. Drives the State A → B → C transition in PlayoffBracketView. */
  playoffFixtureGenerated?: boolean;
  /** Pieza J: horizontal photo of the champion team, uploaded by the organizer
   *  from the "¡Tenemos campeón!" modal once the tournament is `completed`.
   *  When set, any visitor (including non-logged-in public viewers) sees a
   *  centered modal with the photo + champion name on every load of the
   *  tournament detail page. Undefined = no photo uploaded yet. */
  championPhotoUrl?: string | null;
  doubleRoundRobin?: boolean;
  enabledStats?: MatchEventType[];
  maxPlayersPerTeam?: number;
  bestOf?: 3 | 5;
  sponsors?: Sponsor[];
  price?: number;
  tier?: TournamentTier;
  couponId?: string;
  phaseConfigs?: PhaseConfig[];
  visibleTabs?: string[];
  disqualifiedTeamIds?: string[];
  scope?: TournamentScope;
  department?: string;
  municipality?: string;
}

export interface TournamentFilters {
  sport?: Sport;
  format?: TournamentFormat;
  status?: TournamentStatus;
  search?: string;
  department?: string;
  municipality?: string;
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
