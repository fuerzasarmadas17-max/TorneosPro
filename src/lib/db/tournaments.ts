import { supabase } from "@/lib/supabase";
import { Tournament } from "@/types";
import { mapTournament, toDbTournament } from "./mappers";

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

export async function updateTournamentSponsors(
  tournamentId: string,
  sponsors: { imageUrl: string; linkUrl: string }[]
): Promise<boolean> {
  // Delete existing tournament sponsors
  await supabase
    .from("sponsors")
    .delete()
    .eq("tournament_id", tournamentId);

  if (sponsors.length === 0) return true;

  const { error } = await supabase.from("sponsors").insert(
    sponsors.map((s) => ({
      image_url: s.imageUrl,
      link_url: s.linkUrl,
      tournament_id: tournamentId,
    }))
  );
  return !error;
}
