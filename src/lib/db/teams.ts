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
  updates: Partial<Pick<Team, "name" | "primaryColor" | "secondaryColor" | "logoUrl" | "clubLogoId">>
): Promise<boolean> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.primaryColor !== undefined) dbUpdates.primary_color = updates.primaryColor;
  if (updates.secondaryColor !== undefined) dbUpdates.secondary_color = updates.secondaryColor;
  if (updates.logoUrl !== undefined) dbUpdates.logo_url = updates.logoUrl || null;
  if (updates.clubLogoId !== undefined) dbUpdates.club_logo_id = updates.clubLogoId || null;

  const { error } = await supabase.from("teams").update(dbUpdates).eq("id", id);
  return !error;
}

export async function updateTeamPlayers(
  teamId: string,
  players: Player[]
): Promise<boolean> {
  const unique = dedupePlayersByName(players);

  // Guardado GRANULAR por id (upsert + borrar solo los quitados) en lugar del
  // viejo "borrar todo + reinsertar". Motivos:
  //  - Estabilidad de ids: reinsertar sin id regeneraba el uuid de cada
  //    jugador en cada guardado, rompiendo cualquier referencia a `players.id`.
  //    Ahora los existentes conservan su id y los nuevos traen un uuid minteado
  //    en el cliente.
  //  - Seguridad: el borrar-todo no era transaccional; un insert que fallara
  //    dejaba al equipo sin jugadores. Con el diff, a los que se conservan no
  //    se los toca.
  // El UPDATE que hace el upsert está permitido por la policy RLS "Creador
  // edita jugadores" (cmd = ALL) sobre `players`.
  const incomingIds = new Set(
    unique.map((p) => p.id).filter((id): id is string => !!id)
  );

  // Borrar únicamente los jugadores del equipo que ya no vienen en la lista.
  const { data: existing } = await supabase
    .from("players")
    .select("id")
    .eq("team_id", teamId);
  const removed = (existing ?? [])
    .map((r) => r.id as string)
    .filter((id) => !incomingIds.has(id));
  if (removed.length > 0) {
    await supabase.from("players").delete().in("id", removed);
  }

  if (unique.length === 0) return true;

  // Upsert por id: inserta los nuevos y actualiza los existentes conservando id.
  const { error } = await supabase.from("players").upsert(
    unique.map((p) => ({
      id: p.id,
      team_id: teamId,
      name: p.name,
      age: p.age ?? null,
      document_number: p.documentNumber ?? null,
      eps: p.eps ?? null,
      birth_date: p.birthDate ?? null,
    })),
    { onConflict: "id" }
  );
  // Sin este log, un fallo del upsert (típicamente RLS: el organizador no es
  // el creador del equipo) era completamente invisible — la UI avisaba
  // "actualizado" igual. Ver handleSave en team-roster-dialog.
  if (error) console.error("updateTeamPlayers falló", error);
  return !error;
}
