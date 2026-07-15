import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Match, Tournament } from "@/types";
import { mapTournament, toDbMatch, toDbTournament } from "./mappers";

// SELECT completo para la página de detalle de UN solo torneo. Incluye
// match_events embed que es lo que hace que la query "explote" en filas
// (un torneo grande con 200 matches × 30 events = 6000 filas). Para un
// torneo solo es manejable; para una lista de torneos NO. Por eso hay
// dos versiones.
const TOURNAMENT_DETAIL_SELECT = `
  *,
  tournament_teams(team_id),
  tournament_groups(*, tournament_group_teams(team_id)),
  playoff_configs(*),
  matches(*, match_events(*), volleyball_sets(*)),
  sponsors(*)
`;

// SELECT liviano para listas (vista pública `/tournaments`, dashboard,
// perfil de organizador, contexto global). NO incluye match_events:
// para 50 torneos × 200 matches × 30 events serían 300k filas en una
// sola query — eso era el principal cuello de botella en mobile y la
// causa del 504 en `/tournaments/[id]` cuando el provider hacía esta
// query en cascada con la del torneo detallado. Los eventos se cargan
// recién cuando el usuario entra a un torneo específico (vía SSR).
const TOURNAMENT_LIST_SELECT = `
  *,
  tournament_teams(team_id),
  tournament_groups(*, tournament_group_teams(team_id)),
  playoff_configs(*),
  matches(*, volleyball_sets(*)),
  sponsors(*)
`;

export async function fetchTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from("tournaments")
    .select(TOURNAMENT_LIST_SELECT)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => mapTournament(row as Record<string, unknown>));
}

export async function fetchTournamentById(
  id: string,
  client: SupabaseClient = supabase,
  includeEvents: boolean = true
): Promise<Tournament | null> {
  // includeEvents=false: usa el SELECT liviano (sin match_events). Lo
  // usa el SSR del detalle para evitar timeouts de Vercel cuando el
  // torneo tiene muchos partidos. Los eventos los carga el cliente en
  // background apenas hidrata, así nada se pierde — solo se reordena.
  const selectStr = includeEvents
    ? TOURNAMENT_DETAIL_SELECT
    : TOURNAMENT_LIST_SELECT;
  const { data, error } = await client
    .from("tournaments")
    .select(selectStr)
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return mapTournament(data as Record<string, unknown>);
}

/**
 * Carga solo los match_events de los matches dados. Se llama desde el
 * cliente después del primer paint para hidratar stats y eventos sin
 * bloquear el SSR. Devuelve un mapa matchId → events.
 *
 * Antes esto recibía `tournamentId` y hacía un join `matches!inner` con
 * filter embebido. Esa sintaxis es frágil entre versiones de PostgREST
 * y devolvía vacío en algunos casos. Ahora el caller pasa directamente
 * los matchIds que ya tiene en memoria desde el SSR — query simple
 * `.in("match_id", ...)` que siempre funciona.
 */
export async function fetchMatchEventsByMatchIds(
  matchIds: string[],
  client: SupabaseClient = supabase
): Promise<Map<string, Record<string, unknown>[]>> {
  if (matchIds.length === 0) return new Map();

  // PostgREST corta en 1000 filas por defecto, así que paginamos con .range()
  // hasta agotar los eventos. Sin esto, un torneo con >1000 match_events pierde
  // eventos en silencio y las estadísticas por jugador salen incompletas.
  // El .order() es obligatorio para que la paginación sea determinista.
  const PAGE_SIZE = 1000;
  const map = new Map<string, Record<string, unknown>[]>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from("match_events")
      .select("*")
      .in("match_id", matchIds)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error || !data) break;
    for (const row of data as Record<string, unknown>[]) {
      const matchId = row.match_id as string;
      if (!map.has(matchId)) map.set(matchId, []);
      map.get(matchId)!.push(row);
    }
    if (data.length < PAGE_SIZE) break;
  }

  return map;
}

/**
 * Re-key a perGroup map ({ groupId: count }) using a temp→real id map.
 * Returns undefined if input is undefined or empty so callers can write NULL
 * to the JSONB column when nothing meaningful exists.
 */
function translatePerGroupIds(
  perGroup: Record<string, number> | undefined,
  tempToReal: Record<string, string>
): Record<string, number> | undefined {
  if (!perGroup || Object.keys(perGroup).length === 0) return undefined;
  const out: Record<string, number> = {};
  for (const [tempId, count] of Object.entries(perGroup)) {
    out[tempToReal[tempId] ?? tempId] = count;
  }
  return out;
}

export async function createTournament(
  tournament: Tournament,
  groupTeamMap?: Record<string, string[]>,
  client: SupabaseClient = supabase
): Promise<string | null> {
  void groupTeamMap;

  // Pre-generate real UUIDs for groups so phase_configs.perGroup and
  // playoffConfig.perGroup (which reference these ids) can be persisted
  // correctly on the first insert — no need for a follow-up UPDATE.
  const tempToReal: Record<string, string> = {};
  const groupsWithRealIds = (tournament.groups ?? []).map((g) => {
    const realId = crypto.randomUUID();
    tempToReal[g.id] = realId;
    return { ...g, id: realId };
  });

  // Translate phase_configs.perGroup before serializing the tournament row.
  const translatedPhaseConfigs = tournament.phaseConfigs?.map((pc) => ({
    ...pc,
    perGroup: translatePerGroupIds(pc.perGroup, tempToReal),
  }));

  // Insert tournament with the translated phaseConfigs (perGroup keyed by
  // the real UUIDs we just generated).
  const dbData = toDbTournament({
    ...tournament,
    phaseConfigs: translatedPhaseConfigs,
  });
  const { data: inserted, error } = await client
    .from("tournaments")
    .insert(dbData)
    .select("id")
    .single();

  if (error || !inserted) return null;
  const tournamentId = inserted.id as string;

  // Insert tournament_teams
  if (tournament.teamIds.length > 0) {
    await client.from("tournament_teams").insert(
      tournament.teamIds.map((teamId) => ({
        tournament_id: tournamentId,
        team_id: teamId,
      }))
    );
  }

  // Insert groups using the pre-generated UUIDs (overriding the column's
  // DEFAULT gen_random_uuid()) so phase_configs/playoff_configs references
  // stay valid.
  if (groupsWithRealIds.length > 0) {
    for (const group of groupsWithRealIds) {
      await client.from("tournament_groups").insert({
        id: group.id,
        tournament_id: tournamentId,
        name: group.name,
        phase: group.phase ?? 1,
      });

      if (group.teamIds.length > 0) {
        await client.from("tournament_group_teams").insert(
          group.teamIds.map((teamId) => ({
            group_id: group.id,
            team_id: teamId,
          }))
        );
      }
    }
  }

  // Insert playoff config — both legacy uniform value and the new per-group
  // JSON. The mapper prefers JSON when present and falls back to the int.
  if (tournament.playoffConfig) {
    const perGroupReal = translatePerGroupIds(tournament.playoffConfig.perGroup, tempToReal);
    await client.from("playoff_configs").insert({
      tournament_id: tournamentId,
      advance_per_group: tournament.playoffConfig.advancePerGroup,
      advance_per_group_json: perGroupReal ?? null,
      total_advancing: tournament.playoffConfig.totalAdvancing,
    });
  }

  // Insert sponsors
  if (tournament.sponsors && tournament.sponsors.length > 0) {
    await client.from("sponsors").insert(
      tournament.sponsors.map((s) => ({
        image_url: s.imageUrl,
        link_url: s.linkUrl,
        name: s.name ?? "",
        library_sponsor_id: s.librarySponsorId ?? null,
        tournament_id: tournamentId,
      }))
    );
  }

  return tournamentId;
}

export async function updateTournament(
  id: string,
  updates: Partial<Tournament>,
  client: SupabaseClient = supabase
): Promise<boolean> {
  const dbUpdates = toDbTournament(updates);
  const { error } = await client
    .from("tournaments")
    .update(dbUpdates)
    .eq("id", id);

  return !error;
}

export async function deleteTournament(
  id: string,
  client: SupabaseClient = supabase
): Promise<boolean> {
  const { error } = await client.from("tournaments").delete().eq("id", id);
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
  totalAdvancing: number,
  perGroup?: Record<string, number>
): Promise<boolean> {
  const { error } = await supabase
    .from("playoff_configs")
    .update({
      advance_per_group: advancePerGroup,
      // Explicitly write NULL when no per-group map is provided so the row
      // reverts to the legacy uniform behavior. Without this, a previous
      // per-group config would silently persist.
      advance_per_group_json: perGroup && Object.keys(perGroup).length > 0 ? perGroup : null,
      total_advancing: totalAdvancing,
    })
    .eq("tournament_id", tournamentId);
  return !error;
}

export async function updateTournamentSponsors(
  tournamentId: string,
  sponsors: { imageUrl: string; linkUrl: string; name?: string; librarySponsorId?: string }[]
): Promise<{ id: string; imageUrl: string; linkUrl: string; name?: string; librarySponsorId?: string }[] | null> {
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
      name: s.name ?? "",
      library_sponsor_id: s.librarySponsorId ?? null,
      tournament_id: tournamentId,
    }))
  ).select("id, image_url, link_url, name, library_sponsor_id");

  if (error) return null;

  return (data || []).map((row) => ({
    id: row.id as string,
    imageUrl: row.image_url as string,
    linkUrl: row.link_url as string,
    name: (row.name as string) || undefined,
    librarySponsorId: (row.library_sponsor_id as string) ?? undefined,
  }));
}

export async function insertMatchesForPhase(
  matches: Match[],
  tournamentId: string,
  client: SupabaseClient = supabase
): Promise<Record<string, string>> {
  const idMapping: Record<string, string> = {};

  for (const match of matches) {
    const dbData = toDbMatch({ ...match, tournamentId });
    dbData.next_match_id = null;
    if (match.groupId) dbData.group_id = match.groupId;

    const { data } = await client
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
      await client
        .from("matches")
        .update({ next_match_id: idMapping[match.nextMatchId] })
        .eq("id", idMapping[match.id]);
    }
  }

  return idMapping;
}

export async function updateGroupName(
  groupId: string,
  name: string,
  client: SupabaseClient = supabase
): Promise<boolean> {
  const { error } = await client
    .from("tournament_groups")
    .update({ name })
    .eq("id", groupId);
  return !error;
}

export async function assignTeamsToGroup(
  groupId: string,
  teamIds: string[],
  client: SupabaseClient = supabase
): Promise<boolean> {
  if (teamIds.length === 0) return true;
  const { error } = await client.from("tournament_group_teams").insert(
    teamIds.map((teamId) => ({
      group_id: groupId,
      team_id: teamId,
    }))
  );
  return !error;
}

/**
 * Atomically replace team assignments for every group in a given phase.
 * Used by the "Configurar Fase X" dialog so that a save fully reflects the
 * organizer's choices and previous (auto) assignments are wiped first.
 *
 * `assignments` maps groupId → teamIds. Groups not present in the map keep
 * their existing rows (use this to update only some groups).
 */
export async function assignTeamsToPhaseGroups(
  tournamentId: string,
  phase: number,
  assignments: Record<string, string[]>,
  client: SupabaseClient = supabase
): Promise<boolean> {
  // Look up the group ids for the given phase. The query is scoped by
  // tournament_id so we can't accidentally affect another tournament.
  const { data: groupRows, error: lookupErr } = await client
    .from("tournament_groups")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("phase", phase);
  if (lookupErr || !groupRows) return false;
  const phaseGroupIds = groupRows.map((r) => r.id as string);
  const editedIds = Object.keys(assignments).filter((id) => phaseGroupIds.includes(id));
  if (editedIds.length === 0) return true;

  // Wipe existing assignments for the edited groups, then insert new ones.
  await client
    .from("tournament_group_teams")
    .delete()
    .in("group_id", editedIds);

  const rows = editedIds.flatMap((groupId) =>
    assignments[groupId].map((teamId) => ({ group_id: groupId, team_id: teamId }))
  );
  if (rows.length === 0) return true;
  const { error: insertErr } = await client.from("tournament_group_teams").insert(rows);
  return !insertErr;
}

/**
 * Assign teams to specific playoff bracket slots. The bracket matches must
 * already exist (created during initial setup). `slotAssignments[matchId]`
 * provides { homeTeamId, awayTeamId } for round-1 matches.
 *
 * Empty values are written as null to clear any previous assignment.
 */
export async function assignTeamsToBracketSlots(
  slotAssignments: Record<string, { homeTeamId: string | null; awayTeamId: string | null }>,
  client: SupabaseClient = supabase
): Promise<boolean> {
  for (const [matchId, { homeTeamId, awayTeamId }] of Object.entries(slotAssignments)) {
    const { error } = await client
      .from("matches")
      .update({
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
      })
      .eq("id", matchId);
    if (error) return false;
  }
  return true;
}
