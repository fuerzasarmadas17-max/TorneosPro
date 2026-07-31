import { createClient } from "@supabase/supabase-js";
import { Team, Tournament } from "@/types";
import { fetchTournamentById } from "./tournaments";
import { fetchTeamsByIds } from "./teams";
import { mapTournament } from "./mappers";

/**
 * Cliente Supabase para uso en Server Components / Route Handlers.
 *
 * Sin persistSession ni autoRefreshToken — el server no tiene sesión de
 * usuario, llama anónimo y respeta las policies RLS públicas. No usa
 * `navigator.locks` (que no existe en Node/Edge) gracias a la opción
 * `lock` custom igual que el cliente de browser.
 *
 * Las queries que disparemos desde acá viajan desde Vercel a Supabase
 * con latencia interna baja (~50ms vs los 300-800ms que tarda desde un
 * celular en 4G). Por eso vale la pena moverlas al server.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const supabaseServer = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

/** Quién organiza el torneo, para el escudo y el link a su perfil. */
export interface TournamentOrganizer {
  name: string;
  slug?: string;
  logoUrl?: string;
}

export interface TournamentPageData {
  tournament: Tournament;
  teams: Team[];
  organizer?: TournamentOrganizer;
}

/**
 * Carga el torneo + solo los equipos del torneo (no todos los del
 * sistema). Pensado para el SSR de `/tournaments/[id]`. Devuelve null
 * si el torneo no existe o RLS lo bloquea.
 *
 * Performance: dos queries paralelas, normalmente ~80-150ms total
 * cuando ambas corren en la misma región que Supabase. El bonus de
 * usar `fetchTeamsByIds` (en lugar de `fetchAllTeams`) es que solo
 * trae los equipos del torneo en cuestión — para un torneo de 16
 * equipos son ~16 filas, no ~1000.
 */
export async function fetchTournamentForPage(
  id: string
): Promise<TournamentPageData | null> {
  // Logs van a Vercel Function Logs y ayudan a diagnosticar timeouts
  // por torneos pesados. Pueden quitarse después de validar tiempos.
  const t0 = Date.now();
  // SSR carga el torneo SIN match_events. Es lo que evita el timeout
  // de Vercel cuando el torneo tiene 200+ matches con miles de events.
  // El cliente carga los eventos después de hidratar (vía
  // `fetchMatchEventsByTournament`), así las stats individuales y
  // tarjetas aparecen ~500ms después sin bloquear el primer paint.
  const tournament = await fetchTournamentById(id, supabaseServer, false);
  const t1 = Date.now();
  console.log(`[SSR] fetchTournamentById(${id}) tardó ${t1 - t0}ms`);
  if (!tournament) return null;

  // En paralelo con los equipos: el perfil del organizador es una fila y no
  // tiene por qué esperar a que vuelvan los equipos.
  const [teams, organizer] = await Promise.all([
    fetchTeamsByIds(tournament.teamIds, supabaseServer),
    fetchOrganizerOf(tournament.createdBy),
  ]);
  const t2 = Date.now();
  console.log(
    `[SSR] fetchTeamsByIds(${tournament.teamIds.length}) tardó ${t2 - t1}ms · total ${t2 - t0}ms`
  );
  return { tournament, teams, organizer };
}

/**
 * El perfil público de quien organiza. Da el escudo del encabezado
 * (`logo_url`) y el nombre con link a su perfil.
 *
 * Se lee `organization_profiles` y no `users`: esa tabla tiene RLS que
 * bloquea leer otros usuarios y devuelve 406.
 */
async function fetchOrganizerOf(
  createdBy: string | undefined
): Promise<TournamentOrganizer | undefined> {
  if (!createdBy) return undefined;
  const { data } = await supabaseServer
    .from("organization_profiles")
    .select("organization_name, slug, logo_url")
    .eq("user_id", createdBy)
    .maybeSingle();
  if (!data) return undefined;
  return {
    name: data.organization_name as string,
    slug: (data.slug as string) ?? undefined,
    logoUrl: (data.logo_url as string) ?? undefined,
  };
}

/** Un torneo de la portada junto al nombre de quien lo organiza. */
export interface LandingTournament {
  tournament: Tournament;
  organizer?: { name: string; slug?: string };
}

/**
 * Torneos para la portada, resueltos en el servidor.
 *
 * La landing es lo primero que ve alguien que llega por un link de
 * WhatsApp, así que los torneos tienen que venir ya en el HTML: sirve para
 * SEO y evita que en 4G la página aparezca vacía y se vaya llenando.
 *
 * Select liviano a propósito — el mismo criterio del resto del archivo: sin
 * matches ni eventos. La tarjeta solo necesita nombre, deporte, estado,
 * ubicación y cuántos equipos.
 *
 * Los organizadores salen en UNA consulta por lote, no una por torneo.
 */
export async function fetchLandingTournaments(
  limit = 12
): Promise<LandingTournament[]> {
  const { data, error } = await supabaseServer
    .from("tournaments")
    .select(
      `*, tournament_teams(team_id), tournament_groups(*, tournament_group_teams(team_id)), playoff_configs(*), sponsors(*)`
    )
    // Los que están jugándose primero: es lo que le interesa a un visitante.
    // Dentro de cada grupo, los más nuevos arriba.
    .order("created_at", { ascending: false })
    .limit(limit * 3);

  if (error || !data) return [];

  const tournaments = data
    .map((row) => mapTournament(row as Record<string, unknown>))
    .sort((a, b) => statusRank(a.status) - statusRank(b.status))
    .slice(0, limit);

  const ids = [
    ...new Set(tournaments.map((t) => t.createdBy).filter(Boolean)),
  ] as string[];

  const organizers = new Map<string, { name: string; slug?: string }>();
  if (ids.length > 0) {
    // `organization_profiles` y no `users`: esa tabla tiene RLS que bloquea
    // leer otros usuarios y devuelve 406.
    const { data: profiles } = await supabaseServer
      .from("organization_profiles")
      .select("user_id, organization_name, slug")
      .in("user_id", ids);
    for (const p of profiles ?? []) {
      organizers.set(p.user_id as string, {
        name: p.organization_name as string,
        slug: (p.slug as string) ?? undefined,
      });
    }
  }

  return tournaments.map((tournament) => ({
    tournament,
    organizer: tournament.createdBy
      ? organizers.get(tournament.createdBy)
      : undefined,
  }));
}

// En curso → próximos → completados. Se ordena en memoria y no en la
// consulta porque el orden que queremos no es el alfabético de la columna
// ("completed" < "in-progress" < "upcoming"). Por eso se piden de más y se
// recorta después.
function statusRank(status: string): number {
  if (status === "in-progress") return 0;
  if (status === "upcoming") return 1;
  return 2;
}

/**
 * Los torneos que el admin marcó como destacados, para el carrusel de la
 * portada. Normalmente cero o uno; si marcó varios, rotan.
 *
 * Si la consulta falla se devuelve vacío en vez de romper la portada. El
 * caso esperado es que la migración 20260731_tournament_featured.sql
 * todavía no se haya corrido y la columna no exista: la sección
 * simplemente no aparece hasta entonces.
 */
export async function fetchFeaturedTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabaseServer
    .from("tournaments")
    .select(
      `*, tournament_teams(team_id), tournament_groups(*, tournament_group_teams(team_id)), playoff_configs(*), sponsors(*)`
    )
    .eq("featured", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn(
      `[landing] no se pudieron leer los destacados (¿falta correr la migración?): ${error.message}`
    );
    return [];
  }
  if (!data) return [];

  return data.map((row) => mapTournament(row as Record<string, unknown>));
}
