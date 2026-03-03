import { supabase } from "@/lib/supabase";
import { Match, Tournament } from "@/types";
import { mapTournament, toDbMatch, toDbTournament } from "./mappers";

const TOURNAMENT_SELECT = `
  *,
  tournament_teams(team_id),
  tournament_groups(*, tournament_group_teams(team_id)),
  playoff_configs(*),
  matches(*, match_events(*), volleyball_sets(*)),
  sponsors(*)
`;

export async function fetchTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from("tournaments")
    .select(TOURNAMENT_SELECT)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => mapTournament(row as Record<string, unknown>));
}

export async function fetchTournamentById(
  id: string
): Promise<Tournament | null> {
  const { data, error } = await supabase
    .from("tournaments")
    .select(TOURNAMENT_SELECT)
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return mapTournament(data as Record<string, unknown>);
}

export async function createTournament(
  tournament: Tournament,
  groupTeamMap?: Record<string, string[]>
): Promise<string | null> {
  // Insert tournament
  const dbData = toDbTournament(tournament);
  const { data: inserted, error } = await supabase
    .from("tournaments")
    .insert(dbData)
    .select("id")
    .single();

  if (error || !inserted) return null;
  const tournamentId = inserted.id as string;

  // Insert tournament_teams
  if (tournament.teamIds.length > 0) {
    await supabase.from("tournament_teams").insert(
      tournament.teamIds.map((teamId) => ({
        tournament_id: tournamentId,
        team_id: teamId,
      }))
    );
  }

  // Insert groups
  if (tournament.groups && tournament.groups.length > 0) {
    for (const group of tournament.groups) {
      const { data: groupRow } = await supabase
        .from("tournament_groups")
        .insert({
          tournament_id: tournamentId,
          name: group.name,
          phase: group.phase ?? 1,
        })
        .select("id")
        .single();

      if (groupRow && group.teamIds.length > 0) {
        await supabase.from("tournament_group_teams").insert(
          group.teamIds.map((teamId) => ({
            group_id: groupRow.id,
            team_id: teamId,
          }))
        );
      }
    }
  }

  // Insert playoff config
  if (tournament.playoffConfig) {
    await supabase.from("playoff_configs").insert({
      tournament_id: tournamentId,
      advance_per_group: tournament.playoffConfig.advancePerGroup,
      total_advancing: tournament.playoffConfig.totalAdvancing,
    });
  }

  // Insert sponsors
  if (tournament.sponsors && tournament.sponsors.length > 0) {
    await supabase.from("sponsors").insert(
      tournament.sponsors.map((s) => ({
        image_url: s.imageUrl,
        link_url: s.linkUrl,
        tournament_id: tournamentId,
      }))
    );
  }

  return tournamentId;
}

export async function updateTournament(
  id: string,
  updates: Partial<Tournament>
): Promise<boolean> {
  const dbUpdates = toDbTournament(updates);
  const { error } = await supabase
    .from("tournaments")
    .update(dbUpdates)
    .eq("id", id);

  return !error;
}

export async function deleteTournament(id: string): Promise<boolean> {
  const { error } = await supabase.from("tournaments").delete().eq("id", id);
  return !error;
}

export async function addTournamentTeams(
  tournamentId: string,
  teamIds: string[]
): Promise<boolean> {
  if (teamIds.length === 0) return true;
  const { error } = await supabase.from("tournament_teams").insert(
    teamIds.map((teamId) => ({
      tournament_id: tournamentId,
      team_id: teamId,
    }))
  );
  return !error;
}

export async function removeTeamFromTournament(
  tournamentId: string,
  teamId: string
): Promise<boolean> {
  // 1. Remove from group_teams (via subquery for groups of this tournament)
  const { data: groups } = await supabase
    .from("tournament_groups")
    .select("id")
    .eq("tournament_id", tournamentId);
  if (groups?.length) {
    await supabase
      .from("tournament_group_teams")
      .delete()
      .eq("team_id", teamId)
      .in("group_id", groups.map((g) => g.id));
  }
  // 2. Delete all matches involving this team
  await supabase
    .from("matches")
    .delete()
    .eq("tournament_id", tournamentId)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);
  // 3. Remove from tournament_teams
  const { error } = await supabase
    .from("tournament_teams")
    .delete()
    .eq("tournament_id", tournamentId)
    .eq("team_id", teamId);
  return !error;
}

export async function updatePlayoffConfig(
  tournamentId: string,
  advancePerGroup: number,
  totalAdvancing: number
): Promise<boolean> {
  const { error } = await supabase
    .from("playoff_configs")
    .update({
      advance_per_group: advancePerGroup,
      total_advancing: totalAdvancing,
    })
    .eq("tournament_id", tournamentId);
  return !error;
}

export async function updateTournamentSponsors(
  tournamentId: string,
  sponsors: { imageUrl: string; linkUrl: string }[]
): Promise<{ id: string; imageUrl: string; linkUrl: string }[] | null> {
  // Delete existing tournament sponsors
  await supabase
    .from("sponsors")
    .delete()
    .eq("tournament_id", tournamentId);

  if (sponsors.length === 0) return [];

  const { data, error } = await supabase.from("sponsors").insert(
    sponsors.map((s) => ({
      image_url: s.imageUrl,
      link_url: s.linkUrl,
      tournament_id: tournamentId,
    }))
  ).select("id, image_url, link_url");

  if (error) return null;

  return (data || []).map((row) => ({
    id: row.id as string,
    imageUrl: row.image_url as string,
    linkUrl: row.link_url as string,
  }));
}

export async function insertMatchesForPhase(
  matches: Match[],
  tournamentId: string
): Promise<Record<string, string>> {
  const idMapping: Record<string, string> = {};

  for (const match of matches) {
    const dbData = toDbMatch({ ...match, tournamentId });
    dbData.next_match_id = null;
    if (match.groupId) dbData.group_id = match.groupId;

    const { data } = await supabase
      .from("matches")
      .insert(dbData)
      .select("id")
      .single();

    if (data) {
      idMapping[match.id] = data.id as string;
    }
  }

  // Update nextMatchId references
  for (const match of matches) {
    if (match.nextMatchId && idMapping[match.nextMatchId]) {
      await supabase
        .from("matches")
        .update({ next_match_id: idMapping[match.nextMatchId] })
        .eq("id", idMapping[match.id]);
    }
  }

  return idMapping;
}

export async function assignTeamsToGroup(
  groupId: string,
  teamIds: string[]
): Promise<boolean> {
  if (teamIds.length === 0) return true;
  const { error } = await supabase.from("tournament_group_teams").insert(
    teamIds.map((teamId) => ({
      group_id: groupId,
      team_id: teamId,
    }))
  );
  return !error;
}
