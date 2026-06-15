import { createClient } from "@supabase/supabase-js";
import { Team, Tournament } from "@/types";
import { fetchTournamentById } from "./tournaments";
import { fetchTeamsByIds } from "./teams";

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

export interface TournamentPageData {
  tournament: Tournament;
  teams: Team[];
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
  const tournament = await fetchTournamentById(id, supabaseServer);
  const t1 = Date.now();
  console.log(`[SSR] fetchTournamentById(${id}) tardó ${t1 - t0}ms`);
  if (!tournament) return null;

  const teams = await fetchTeamsByIds(tournament.teamIds, supabaseServer);
  const t2 = Date.now();
  console.log(
    `[SSR] fetchTeamsByIds(${tournament.teamIds.length}) tardó ${t2 - t1}ms · total ${t2 - t0}ms`
  );
  return { tournament, teams };
}
