import { supabase } from "@/lib/supabase";
import { Team, Player } from "@/types";
import { mapTeam } from "./mappers";

export async function fetchTeamsByIds(ids: string[]): Promise<Team[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("teams")
    .select("*, players(*)")
    .in("id", ids);

  if (error || !data) return [];
  return data.map((row) => mapTeam(row as Record<string, unknown>));
}

export async function fetchAllTeams(): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("*, players(*)");

  if (error || !data) return [];
  return data.map((row) => mapTeam(row as Record<string, unknown>));
}

export async function createTeams(
  teams: Team[]
): Promise<string[]> {
  const insertedIds: string[] = [];

  for (const team of teams) {
    const { data: teamRow, error } = await supabase
      .from("teams")
      .insert({
        name: team.name,
        logo_url: team.logoUrl || null,
        primary_color: team.primaryColor || null,
        secondary_color: team.secondaryColor || null,
      })
      .select("id")
      .single();

    if (error || !teamRow) continue;

    const teamId = teamRow.id as string;
    insertedIds.push(teamId);

    if (team.players.length > 0) {
      await supabase.from("players").insert(
        team.players.map((p) => ({
          team_id: teamId,
          name: p.name,
          age: p.age ?? null,
        }))
      );
    }
  }

  return insertedIds;
}

export async function updateTeam(
  id: string,
  updates: Partial<Pick<Team, "name" | "primaryColor" | "secondaryColor">>
): Promise<boolean> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.primaryColor !== undefined) dbUpdates.primary_color = updates.primaryColor;
  if (updates.secondaryColor !== undefined) dbUpdates.secondary_color = updates.secondaryColor;

  const { error } = await supabase.from("teams").update(dbUpdates).eq("id", id);
  return !error;
}

export async function updateTeamPlayers(
  teamId: string,
  players: Player[]
): Promise<boolean> {
  // Delete existing players
  await supabase.from("players").delete().eq("team_id", teamId);

  if (players.length === 0) return true;

  const { error } = await supabase.from("players").insert(
    players.map((p) => ({
      team_id: teamId,
      name: p.name,
      age: p.age ?? null,
    }))
  );
  return !error;
}
