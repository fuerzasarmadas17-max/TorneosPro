import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Team, Player } from "@/types";
import { dedupePlayersByName } from "@/lib/name-utils";
import { mapTeam } from "./mappers";

export async function fetchTeamsByIds(
  ids: string[],
  client: SupabaseClient = supabase
): Promise<Team[]> {
  if (ids.length === 0) return [];
  const { data, error } = await client
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

    const teamPlayers = dedupePlayersByName(team.players);
    if (teamPlayers.length > 0) {
      await supabase.from("players").insert(
        teamPlayers.map((p) => ({
          team_id: teamId,
          name: p.name,
          age: p.age ?? null,
          document_number: p.documentNumber ?? null,
          eps: p.eps ?? null,
          birth_date: p.birthDate ?? null,
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
  // Deduplicar ANTES de borrar: el delete+insert no es transaccional, así que
  // un insert que falle (p.ej. contra el unique de (team_id, name)) dejaría al
  // equipo sin jugadores.
  const unique = dedupePlayersByName(players);

  // Delete existing players
  await supabase.from("players").delete().eq("team_id", teamId);

  if (unique.length === 0) return true;

  const { error } = await supabase.from("players").insert(
    unique.map((p) => ({
      team_id: teamId,
      name: p.name,
      age: p.age ?? null,
      document_number: p.documentNumber ?? null,
      eps: p.eps ?? null,
      birth_date: p.birthDate ?? null,
    }))
  );
  return !error;
}
