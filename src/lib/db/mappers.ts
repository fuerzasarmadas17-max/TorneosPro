import {
  User,
  OrganizationProfile,
  Sponsor,
  ClubLogo,
  Team,
  Player,
  Tournament,
  Match,
  MatchEvent,
  VolleyballSet,
  TournamentGroup,
  PlayoffConfig,
  PhaseConfig,
  Sport,
  TournamentFormat,
  TournamentPlan,
  TournamentStatus,
  MatchStatus,
  MatchPhase,
  MatchEventType,
  TournamentTier,
  TournamentScope,
} from "@/types";

// ============================================================
// DB -> Frontend mappers
// ============================================================

export function mapUser(row: Record<string, unknown>): Omit<User, "password"> {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    role: (row.role as User["role"]) ?? undefined,
    isActive: row.is_active as boolean,
    avatarUrl: (row.avatar_url as string) ?? undefined,
    createdTournamentIds: (row.created_tournament_ids as string[]) ?? [],
    organizationProfile: row.organization_profile
      ? mapOrganizationProfile(row.organization_profile as Record<string, unknown>)
      : undefined,
  };
}

export function mapOrganizationProfile(
  row: Record<string, unknown>
): OrganizationProfile {
  const socialLinksRow = row.social_links as Record<string, unknown> | undefined;
  const sponsorsRows = row.sponsors as Record<string, unknown>[] | undefined;

  return {
    id: (row.id as string) ?? undefined,
    slug: row.slug as string,
    organizationName: row.organization_name as string,
    bio: (row.bio as string) ?? undefined,
    logoUrl: (row.logo_url as string) ?? undefined,
    location: (row.location as string) ?? undefined,
    foundedYear: (row.founded_year as number) ?? undefined,
    isPublic: row.is_public as boolean,
    socialLinks: socialLinksRow
      ? {
          website: (socialLinksRow.website as string) ?? undefined,
          facebook: (socialLinksRow.facebook as string) ?? undefined,
          instagram: (socialLinksRow.instagram as string) ?? undefined,
          twitter: (socialLinksRow.twitter as string) ?? undefined,
        }
      : undefined,
    sponsors: sponsorsRows ? sponsorsRows.map(mapSponsor) : undefined,
  };
}

export function mapSponsor(row: Record<string, unknown>): Sponsor {
  return {
    id: row.id as string,
    imageUrl: row.image_url as string,
    linkUrl: row.link_url as string,
    name: (row.name as string) || undefined,
    librarySponsorId: (row.library_sponsor_id as string) ?? undefined,
    showOnProfile: (row.show_on_profile as boolean) ?? false,
  };
}

export function mapTeam(row: Record<string, unknown>): Team {
  const playersRows = row.players as Record<string, unknown>[] | undefined;
  return {
    id: row.id as string,
    name: row.name as string,
    logoUrl: (row.logo_url as string) ?? undefined,
    clubLogoId: (row.club_logo_id as string) ?? undefined,
    primaryColor: (row.primary_color as string) ?? undefined,
    secondaryColor: (row.secondary_color as string) ?? undefined,
    players: playersRows ? playersRows.map(mapPlayer) : [],
  };
}

export function mapClubLogo(row: Record<string, unknown>): ClubLogo {
  return {
    id: row.id as string,
    name: (row.name as string) || undefined,
    imageUrl: row.image_url as string,
  };
}

export function mapPlayer(row: Record<string, unknown>): Player {
  return {
    id: row.id as string,
    name: row.name as string,
    teamId: row.team_id as string,
    age: (row.age as number) ?? undefined,
    documentNumber: (row.document_number as string) ?? undefined,
    eps: (row.eps as string) ?? undefined,
    birthDate: (row.birth_date as string) ?? undefined,
  };
}

export function mapTournament(row: Record<string, unknown>): Tournament {
  const matchesRows = row.matches as Record<string, unknown>[] | undefined;
  const groupsRows = row.tournament_groups as Record<string, unknown>[] | undefined;
  const playoffRow = row.playoff_configs as Record<string, unknown> | Record<string, unknown>[] | undefined;
  const sponsorsRows = row.sponsors as Record<string, unknown>[] | undefined;
  const teamRows = row.tournament_teams as Record<string, unknown>[] | undefined;

  // playoff_configs can come as array (from select) or single object
  let playoffConfig: PlayoffConfig | undefined;
  if (Array.isArray(playoffRow) && playoffRow.length > 0) {
    playoffConfig = mapPlayoffConfig(playoffRow[0]);
  } else if (playoffRow && !Array.isArray(playoffRow)) {
    playoffConfig = mapPlayoffConfig(playoffRow);
  }

  return {
    id: row.id as string,
    name: row.name as string,
    sport: row.sport as Sport,
    format: row.format as TournamentFormat,
    plan: row.plan as TournamentPlan,
    status: row.status as TournamentStatus,
    description: (row.description as string) ?? undefined,
    createdBy: row.created_by as string,
    teamIds: teamRows ? teamRows.map((t) => t.team_id as string) : [],
    matches: matchesRows ? matchesRows.map(mapMatch) : [],
    createdAt: row.created_at as string,
    startDate: row.start_date as string,
    endDate: (row.end_date as string) ?? undefined,
    groups: groupsRows ? groupsRows.map(mapTournamentGroup) : undefined,
    playoffConfig,
    groupStageComplete: (row.group_stage_complete as boolean) ?? false,
    playoffDoubleLeg: (row.playoff_double_leg as boolean) ?? undefined,
    playoffFixtureGenerated: (row.playoff_fixture_generated as boolean) ?? undefined,
    playoffFinalFormat:
      (row.playoff_final_format as Tournament["playoffFinalFormat"]) ?? undefined,
    championPhotoUrl: (row.champion_photo_url as string) ?? null,
    doubleRoundRobin: (row.double_round_robin as boolean) ?? false,
    enabledStats: (row.enabled_stats as MatchEventType[]) ?? undefined,
    maxPlayersPerTeam: (row.max_players_per_team as number) ?? undefined,
    bestOf: (row.best_of as 3 | 5) ?? undefined,
    sponsors: sponsorsRows ? sponsorsRows.map(mapSponsor) : undefined,
    price: (row.price as number) ?? undefined,
    tier: (row.tier as TournamentTier) ?? undefined,
    couponId: (row.coupon_id as string) ?? undefined,
    phaseConfigs: (row.phase_configs as PhaseConfig[]) ?? undefined,
    // `?? false` y no `?? undefined`: mientras la migración no se haya
    // corrido, la columna no viene en el row y esto lo deja en false — la
    // portada simplemente no muestra la sección, sin romperse.
    featured: (row.featured as boolean) ?? false,
    cardImage: (row.card_image as string) ?? undefined,
    visibleTabs: (row.visible_tabs as string[]) ?? undefined,
    disqualifiedTeamIds: (row.disqualified_team_ids as string[]) ?? undefined,
    scope: (row.scope as TournamentScope) ?? undefined,
    department: (row.department as string) ?? undefined,
    municipality: (row.municipality as string) ?? undefined,
  };
}

export function mapMatch(row: Record<string, unknown>): Match {
  const eventsRows = row.match_events as Record<string, unknown>[] | undefined;
  const setsRows = row.volleyball_sets as Record<string, unknown>[] | undefined;

  return {
    id: row.id as string,
    tournamentId: row.tournament_id as string,
    round: row.round as number,
    matchNumber: row.match_number as number,
    homeTeamId: (row.home_team_id as string) ?? null,
    awayTeamId: (row.away_team_id as string) ?? null,
    homeScore: row.home_score != null ? (row.home_score as number) : null,
    awayScore: row.away_score != null ? (row.away_score as number) : null,
    winnerId: (row.winner_id as string) ?? null,
    status: row.status as MatchStatus,
    date: (row.date as string) ?? undefined,
    time: (row.time as string) ?? undefined,
    venue: (row.venue as string) ?? undefined,
    postponedReason: (row.postponed_reason as string) ?? undefined,
    nextMatchId: (row.next_match_id as string) ?? null,
    events: eventsRows ? eventsRows.map(mapMatchEvent) : undefined,
    sets: setsRows ? setsRows.map(mapVolleyballSet) : undefined,
    phase: (row.phase as MatchPhase) ?? undefined,
    groupId: (row.group_id as string) ?? undefined,
    walkover: (row.walkover as boolean) ?? undefined,
  };
}

export function mapMatchEvent(row: Record<string, unknown>): MatchEvent {
  return {
    id: row.id as string,
    matchId: row.match_id as string,
    teamId: row.team_id as string,
    playerName: row.player_name as string,
    playerId: (row.player_id as string) ?? null,
    type: row.type as MatchEventType,
    position: (row.position as string) ?? undefined,
    paid: (row.paid as boolean) ?? false,
  };
}

export function mapVolleyballSet(row: Record<string, unknown>): VolleyballSet {
  return {
    setNumber: row.set_number as number,
    homePoints: row.home_points as number,
    awayPoints: row.away_points as number,
  };
}

export function mapTournamentGroup(row: Record<string, unknown>): TournamentGroup {
  const teamRows = row.tournament_group_teams as Record<string, unknown>[] | undefined;
  return {
    id: row.id as string,
    name: row.name as string,
    teamIds: teamRows ? teamRows.map((t) => t.team_id as string) : [],
    phase: (row.phase as number) ?? 1,
  };
}

export function mapPlayoffConfig(row: Record<string, unknown>): PlayoffConfig {
  // New shape: advance_per_group_json holds { groupId: count } for uneven
  // cupos. When null, fall back to the legacy uniform advance_per_group.
  const perGroupRaw = row.advance_per_group_json;
  const perGroup =
    perGroupRaw && typeof perGroupRaw === "object" && !Array.isArray(perGroupRaw)
      ? (perGroupRaw as Record<string, number>)
      : undefined;

  return {
    advancePerGroup: row.advance_per_group as number,
    perGroup,
    totalAdvancing: row.total_advancing as number,
  };
}

// ============================================================
// Frontend -> DB mappers
// ============================================================

export function toDbTournament(t: Partial<Tournament>): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (t.name !== undefined) db.name = t.name;
  if (t.sport !== undefined) db.sport = t.sport;
  if (t.format !== undefined) db.format = t.format;
  if (t.plan !== undefined) db.plan = t.plan;
  if (t.status !== undefined) db.status = t.status;
  if (t.description !== undefined) db.description = t.description;
  if (t.createdBy !== undefined) db.created_by = t.createdBy;
  if (t.startDate !== undefined) db.start_date = t.startDate;
  if (t.endDate !== undefined) db.end_date = t.endDate;
  if (t.groupStageComplete !== undefined) db.group_stage_complete = t.groupStageComplete;
  if (t.playoffDoubleLeg !== undefined) db.playoff_double_leg = t.playoffDoubleLeg;
  if (t.playoffFixtureGenerated !== undefined) db.playoff_fixture_generated = t.playoffFixtureGenerated;
  if (t.playoffFinalFormat !== undefined) db.playoff_final_format = t.playoffFinalFormat;
  if (t.championPhotoUrl !== undefined) db.champion_photo_url = t.championPhotoUrl;
  if (t.doubleRoundRobin !== undefined) db.double_round_robin = t.doubleRoundRobin;
  if (t.maxPlayersPerTeam !== undefined) db.max_players_per_team = t.maxPlayersPerTeam;
  if (t.bestOf !== undefined) db.best_of = t.bestOf;
  if (t.price !== undefined) db.price = t.price;
  if (t.tier !== undefined) db.tier = t.tier;
  if (t.enabledStats !== undefined) db.enabled_stats = t.enabledStats;
  if (t.couponId !== undefined) db.coupon_id = t.couponId;
  if (t.phaseConfigs !== undefined) db.phase_configs = t.phaseConfigs;
  if (t.visibleTabs !== undefined) db.visible_tabs = t.visibleTabs;
  if (t.disqualifiedTeamIds !== undefined) db.disqualified_team_ids = t.disqualifiedTeamIds;
  if (t.scope !== undefined) db.scope = t.scope;
  if (t.department !== undefined) db.department = t.department;
  if (t.municipality !== undefined) db.municipality = t.municipality;
  if (t.cardImage !== undefined) db.card_image = t.cardImage;
  // `featured` NO se escribe desde acá a propósito: solo lo cambia el admin
  // por /api/admin/tournaments/[id]/featured, y la base tiene un trigger que
  // rechaza el resto. Ver 20260731_tournament_featured.sql.
  return db;
}

export function toDbMatch(m: Partial<Match>): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (m.tournamentId !== undefined) db.tournament_id = m.tournamentId;
  if (m.round !== undefined) db.round = m.round;
  if (m.matchNumber !== undefined) db.match_number = m.matchNumber;
  if (m.homeTeamId !== undefined) db.home_team_id = m.homeTeamId;
  if (m.awayTeamId !== undefined) db.away_team_id = m.awayTeamId;
  if (m.homeScore !== undefined) db.home_score = m.homeScore;
  if (m.awayScore !== undefined) db.away_score = m.awayScore;
  if (m.winnerId !== undefined) db.winner_id = m.winnerId;
  if (m.status !== undefined) db.status = m.status;
  if (m.date !== undefined) db.date = m.date;
  if (m.time !== undefined) db.time = m.time;
  if (m.venue !== undefined) db.venue = m.venue;
  if (m.postponedReason !== undefined) db.postponed_reason = m.postponedReason;
  if (m.nextMatchId !== undefined) db.next_match_id = m.nextMatchId;
  if (m.phase !== undefined) db.phase = m.phase;
  if (m.groupId !== undefined) db.group_id = m.groupId;
  if (m.walkover !== undefined) db.walkover = m.walkover;
  return db;
}

export function toDbMatchEvent(e: MatchEvent): Record<string, unknown> {
  return {
    match_id: e.matchId,
    team_id: e.teamId,
    player_name: e.playerName,
    player_id: e.playerId ?? null,
    type: e.type,
    position: e.position ?? null,
    paid: e.paid ?? false,
  };
}

export function toDbVolleyballSet(
  matchId: string,
  s: VolleyballSet
): Record<string, unknown> {
  return {
    match_id: matchId,
    set_number: s.setNumber,
    home_points: s.homePoints,
    away_points: s.awayPoints,
  };
}
