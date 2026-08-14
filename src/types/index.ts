export interface Sponsor {
  id: string;
  imageUrl: string;
  linkUrl: string;
  // Nombre opcional para la biblioteca de logos (ej. "Coca-Cola"). Los
  // sponsors viejos no lo tienen y quedan sin etiquetar.
  name?: string;
  // Referencia al logo canónico de la biblioteca. Cuando un sponsor de torneo
  // apunta a un item de la biblioteca, editar la imagen de la biblioteca se
  // propaga a todos los usos. La URL (linkUrl) sigue siendo por-torneo.
  librarySponsorId?: string;
  // Solo para sponsors de organización (biblioteca): si aparece en el perfil
  // público del organizador. El organizador lo elige explícitamente.
  showOnProfile?: boolean;
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

// Logo de club en la biblioteca del organizador (reutilizable entre equipos).
export interface ClubLogo {
  id: string;
  name?: string;
  imageUrl: string;
}

export interface OrganizationProfile {
  // id de la fila organization_profiles. Se usa para gestionar la biblioteca
  // de logos (insertar/propagar). Opcional porque no todas las vistas lo cargan.
  id?: string;
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
  // Referencia al logo de club en la biblioteca. Al elegirlo se copia la
  // imagen en logoUrl; editar el logo en la biblioteca propaga a todos los
  // equipos (categorías) que lo referencian.
  clubLogoId?: string;
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
  | "putout" | "winning_pitcher"
  | "fair_play";

export interface MatchEvent {
  id: string;
  matchId: string;
  teamId: string;
  playerName: string;
  /** Vínculo estable al jugador de la plantilla. Nullable: los eventos viejos
   *  (previos al backfill) y los que no matchean un jugador agregan por nombre.
   *  Las stats agrupan por `playerId` cuando existe, si no por nombre. */
  playerId?: string | null;
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

/** Puntos que otorga una victoria en la tabla de posiciones. Microfútbol usa 2. */
export function getWinPoints(sport: Sport): number {
  return sport === "microfutbol" ? 2 : 3;
}

/** Punto extra en la tabla para el equipo que se lleva el Juego Limpio del
 *  partido. Se suma sobre lo que haya sacado en la cancha: ganando 3+1=4,
 *  empatando 1+1=2, perdiendo 0+1=1. */
export const FAIR_PLAY_POINTS = 1;

export interface StatDefinition {
  key: MatchEventType;
  label: string;
  pluralLabel: string;
  sportDefaults: Sport[];
  computed?: boolean; // true = calculated from match scores, not from player events
  /** Deportes donde la stat se OFRECE pero arranca DESMARCADA al crear el
   *  torneo. `sportDefaults` sigue mandando qué se ofrece; esto solo saca el
   *  pre-marcado. Para las que casi nadie usa (asistencias) o las que cambian
   *  las reglas del torneo y nadie debería activar sin querer (juego limpio,
   *  que suma un punto en la tabla). */
  optInSports?: Sport[];
}

export const STAT_CATALOG: StatDefinition[] = [
  { key: "goal", label: "Gol", pluralLabel: "Goles", sportDefaults: ["futbol", "futsal", "microfutbol"] },
  // Asistencia sigue disponible en fútbol, pero desmarcada: casi ningún
  // organizador de fútbol la carga y ensuciaba el form de resultado con una
  // fila que nadie llena. En basket y béisbol sí se usa, ahí sigue marcada.
  { key: "assist", label: "Asistencia", pluralLabel: "Asistencias", sportDefaults: ["futbol", "futsal", "microfutbol", "basketball", "beisbol", "softball", "wiffleball"], optInSports: ["futbol", "futsal", "microfutbol"] },
  // Juego Limpio: premio de EQUIPO, no de jugador. En cada partido se lo puede
  // llevar uno de los dos (o ninguno) y vale un punto en la tabla. Por eso es
  // `computed` —no sale de eventos de jugador sino de `match.fairPlayTeamId`—
  // y `optInSports` en su único deporte: activarla cambia cómo se puntúa el
  // torneo, así que nunca debe quedar prendida por descuido.
  { key: "fair_play", label: "Juego Limpio", pluralLabel: "Juego Limpio", sportDefaults: ["futbol"], computed: true, optInSports: ["futbol"] },
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

/** Las que arrancan MARCADAS al crear un torneo de este deporte. */
export function getDefaultStats(sport: Sport): MatchEventType[] {
  return STAT_CATALOG
    .filter((s) => s.sportDefaults.includes(sport))
    .filter((s) => !s.optInSports?.includes(sport))
    .map((s) => s.key);
}

/** Las que se OFRECEN para este deporte — marcadas y opt-in juntas. Es la
 *  lista que pinta el selector de estadísticas del wizard. */
export function getAvailableStats(sport: Sport): StatDefinition[] {
  return STAT_CATALOG.filter((s) => s.sportDefaults.includes(sport));
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
  /** Ganado por W: el rival no se presentó o fue descalificado. El marcador
   *  por sí solo no alcanza para saberlo (un 3-0 es un resultado normal). */
  walkover?: boolean;
  /** Equipo que se llevó el Juego Limpio de este partido, o null/undefined si
   *  no se le dio a nadie (es opcional). Solo se usa en torneos que tengan la
   *  stat `fair_play` habilitada; vale FAIR_PLAY_POINTS en la tabla. */
  fairPlayTeamId?: string | null;
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
  /** Cuántos Juegos Limpios ganó. Ya están sumados dentro de `points`; se
   *  guarda aparte para poder mostrarlos en su propia columna — si no, la
   *  tabla mostraría más puntos de los que explican los resultados. */
  fairPlay: number;
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
  /** Clave de la foto de la tarjeta, elegida por el organizador entre las de
   *  su deporte. Es una clave, no una URL: se resuelve contra
   *  `sport-images.ts` y un valor desconocido cae al degradado. Sin valor,
   *  la foto la asigna el reparto automático por deporte.
   *  Admite `null` (y no solo `undefined`) para poder BORRAR una elección
   *  previa: `toDbTournament` ignora los `undefined`, así que volver a
   *  "Automática" tiene que viajar como null. Mismo patrón que
   *  `championPhotoUrl`. */
  cardImage?: string | null;
  /** Destacado en la portada. Lo marca el admin a mano — es una decisión
   *  editorial, no se calcula. La base tiene un trigger que impide que un
   *  organizador se destaque solo (ver 20260731_tournament_featured.sql).
   *  Si hay varios marcados, la portada los rota en un carrusel. */
  featured?: boolean;
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
