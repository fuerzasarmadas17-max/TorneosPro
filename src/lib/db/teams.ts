import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Team, Player } from "@/types";
import { dedupePlayersByName } from "@/lib/name-utils";
import { mapTeam } from "./mappers";

/**
 * Cuántos ids se piden por vez.
 *
 * La API corta cualquier respuesta en 1000 filas y no avisa: la petición sale
 * bien, con menos equipos de los que hay. Pidiendo de a 500 nunca se llega a
 * ese techo, así que ninguna tanda puede volver recortada.
 */
const TAMANO_DE_TANDA = 500;

/**
 * Los equipos de una lista de ids, distinguiendo "no hay ninguno" de "falló la
 * petición".
 *
 * Esa diferencia es el corazón de un bug feo: la versión anterior devolvía una
 * lista vacía en los dos casos, y quien la llamaba escribía ese vacío encima de
 * los equipos que ya tenía en pantalla. Con señal inestable, los nombres se
 * convertían en UUIDs y la pestaña de equipos quedaba vacía. Con `ok: false`,
 * el que llama puede conservar lo que ya tenía.
 */
export async function fetchTeamsByIdsResult(
  ids: string[],
  client: SupabaseClient = supabase
): Promise<{ ok: true; teams: Team[] } | { ok: false }> {
  if (ids.length === 0) return { ok: true, teams: [] };

  const teams: Team[] = [];
  for (let i = 0; i < ids.length; i += TAMANO_DE_TANDA) {
    const tanda = ids.slice(i, i + TAMANO_DE_TANDA);
    const { data, error } = await client
      .from("teams")
      // Los jugadores salen de `players_publico`: nombre y edad, sin cédula,
      // fecha de nacimiento ni EPS. Esos datos no pueden viajar a cualquiera
      // que abra el torneo; el dueño los pide aparte con
      // `fetchPlayersPrivateData`. Ver `20260918_jugadores_privados.sql`.
      .select("*, players:players_publico(id, team_id, name, age, edad)")
      .in("id", tanda);

    // Si una tanda falla se aborta entero: media lista es peor que ninguna,
    // porque el que llama no tiene forma de saber que le faltan equipos.
    if (error || !data) return { ok: false };
    for (const row of data) teams.push(mapTeam(row as Record<string, unknown>));
  }

  return { ok: true, teams };
}

/** Igual que `fetchTeamsByIdsResult` pero devolviendo la lista pelada. Para los
 *  llamadores a los que un fallo no les puede pisar nada (el render del
 *  servidor, que arranca de cero). */
export async function fetchTeamsByIds(
  ids: string[],
  client: SupabaseClient = supabase
): Promise<Team[]> {
  const res = await fetchTeamsByIdsResult(ids, client);
  return res.ok ? res.teams : [];
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

/** Cédula, fecha de nacimiento y EPS de los jugadores de estos equipos, por id
 *  de jugador. Solo devuelve los de equipos de torneos del que pregunta (o
 *  todo, si es admin): lo decide la base (`jugadores_privados`). `null` si la
 *  petición falló — quien llama NO debe seguir como si no hubiera datos. */
export async function fetchPlayersPrivateData(
  teamIds: string[]
): Promise<Map<
  string,
  { documentNumber: string | null; birthDate: string | null; eps: string | null }
> | null> {
  const out = new Map<
    string,
    { documentNumber: string | null; birthDate: string | null; eps: string | null }
  >();
  if (teamIds.length === 0) return out;
  const { data, error } = await supabase.rpc("jugadores_privados", {
    p_team_ids: teamIds,
  });
  if (error || !data) {
    console.error("fetchPlayersPrivateData falló", error);
    return null;
  }
  for (const r of data as Record<string, unknown>[]) {
    out.set(r.id as string, {
      documentNumber: (r.document_number as string) ?? null,
      birthDate: (r.birth_date as string) ?? null,
      eps: (r.eps as string) ?? null,
    });
  }
  return out;
}

export async function updateTeamPlayers(
  teamId: string,
  players: Player[]
): Promise<boolean> {
  const unique = dedupePlayersByName(players);

  // Guardado GRANULAR por id (insertar/actualizar + borrar solo los quitados) en lugar del
  // viejo "borrar todo + reinsertar". Motivos:
  //  - Estabilidad de ids: reinsertar sin id regeneraba el uuid de cada
  //    jugador en cada guardado, rompiendo cualquier referencia a `players.id`.
  //    Ahora los existentes conservan su id y los nuevos traen un uuid minteado
  //    en el cliente.
  //  - Seguridad: el borrar-todo no era transaccional; un insert que fallara
  //    dejaba al equipo sin jugadores. Con el diff, a los que se conservan no
  //    se los toca.
  // Los UPDATE están permitidos por la policy RLS "Creador edita jugadores"
  // (cmd = ALL) sobre `players`.
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

  // Los nuevos se insertan y los existentes se actualizan uno por uno. No es
  // un upsert a propósito: el upsert necesita poder LEER las columnas que
  // escribe, y la cédula, la fecha de nacimiento y la EPS ya no se pueden
  // leer desde el navegador (`20260918_jugadores_privados.sql`).
  //
  // Y en los existentes, los datos privados solo se escriben si vienen
  // (`undefined` = "no se sabe"): quien guarda con una nómina cargada de la
  // vista pública —por ejemplo, al inscribir un jugador nuevo desde el
  // resultado— no puede borrar las cédulas de los demás.
  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  const nuevos = unique.filter((p) => !p.id || !existingIds.has(p.id));
  const viejos = unique.filter((p) => p.id && existingIds.has(p.id));

  const privados = (p: Player) => {
    const out: Record<string, unknown> = {};
    if (p.documentNumber !== undefined) out.document_number = p.documentNumber || null;
    if (p.eps !== undefined) out.eps = p.eps || null;
    if (p.birthDate !== undefined) out.birth_date = p.birthDate || null;
    return out;
  };

  let error: unknown = null;
  if (nuevos.length > 0) {
    const res = await supabase.from("players").insert(
      nuevos.map((p) => ({
        id: p.id || crypto.randomUUID(),
        team_id: teamId,
        name: p.name,
        age: p.age ?? null,
        document_number: p.documentNumber || null,
        eps: p.eps || null,
        birth_date: p.birthDate || null,
      }))
    );
    if (res.error) error = res.error;
  }
  const updates = await Promise.all(
    viejos.map((p) =>
      supabase
        .from("players")
        .update({ name: p.name, age: p.age ?? null, ...privados(p) })
        .eq("id", p.id)
    )
  );
  for (const u of updates) if (u.error) error = u.error;
  if (error) console.error("updateTeamPlayers falló", error);
  return !error;
}
