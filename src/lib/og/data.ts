import { supabase } from "@/lib/supabase";
import { fetchTournamentById } from "@/lib/db/tournaments";
import { toDataUri, type TournamentOgData, type ProfileOgData } from "./render";

/**
 * Reúne la data para la tarjeta OG de un torneo. Usa el cliente anónimo
 * (RLS pública) — el robot de WhatsApp entra sin sesión. Devuelve null
 * si el torneo no existe / RLS lo bloquea, para que la ruta caiga al
 * fallback. Las imágenes (logo del organizador + sponsors) se inlinean
 * como data URI con toDataUri, que ya ignora las que fallan.
 */
export async function getTournamentOgData(
  id: string
): Promise<TournamentOgData | null> {
  const tournament = await fetchTournamentById(id, supabase, false);
  if (!tournament) return null;

  // Perfil del organizador (solo públicos por RLS). Si no es público,
  // omitimos su nombre/logo y mostramos solo el torneo.
  let organizerName: string | null = null;
  let organizerLogoUrl: string | null = null;
  const { data: prof } = await supabase
    .from("organization_profiles")
    .select("organization_name, logo_url")
    .eq("user_id", tournament.createdBy)
    .eq("is_public", true)
    .maybeSingle();
  if (prof) {
    organizerName = (prof.organization_name as string) ?? null;
    organizerLogoUrl = (prof.logo_url as string) ?? null;
  }

  const sponsorUrls = (tournament.sponsors ?? [])
    .map((s) => s.imageUrl)
    .filter(Boolean)
    .slice(0, 5);

  const [organizerLogo, ...sponsors] = await Promise.all([
    toDataUri(organizerLogoUrl),
    ...sponsorUrls.map((u) => toDataUri(u)),
  ]);

  return {
    name: tournament.name,
    sport: tournament.sport,
    format: tournament.format,
    status: tournament.status,
    teamsCount: tournament.teamIds.length,
    organizerName,
    organizerLogo,
    sponsors: sponsors.filter((s): s is string => !!s),
  };
}

/** Reúne la data para la tarjeta OG del perfil de un organizador. */
export async function getProfileOgData(
  slug: string
): Promise<ProfileOgData | null> {
  const { data, error } = await supabase
    .from("organization_profiles")
    .select("organization_name, bio, logo_url, location")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();
  if (error || !data) return null;

  const logo = await toDataUri((data.logo_url as string) ?? null);
  return {
    name: (data.organization_name as string) ?? "Organizador",
    location: (data.location as string) ?? null,
    bio: (data.bio as string) ?? null,
    logo,
  };
}
