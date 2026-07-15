import { supabase } from "@/lib/supabase";

/**
 * Devuelve el id del logo de la biblioteca (nivel organización) para una imagen
 * dada, creándolo si no existe. Dedup por `image_url` dentro de la organización.
 *
 * Sirve para dos cosas al agregar un sponsor a un torneo:
 *   1. Auto-alimentar la biblioteca (todo lo que se coloca queda reutilizable).
 *   2. Obtener el id para linkear el uso vía `library_sponsor_id`, de modo que
 *      editar la imagen en la biblioteca luego se propague a ese torneo.
 *
 * Devuelve null si falla el insert (el llamador puede seguir sin link).
 */
export async function ensureLibrarySponsor(
  organizationProfileId: string,
  sponsor: { imageUrl: string; linkUrl?: string; name?: string }
): Promise<string | null> {
  const { data: found } = await supabase
    .from("sponsors")
    .select("id")
    .eq("organization_profile_id", organizationProfileId)
    .is("tournament_id", null)
    .eq("image_url", sponsor.imageUrl)
    .limit(1)
    .maybeSingle();
  if (found?.id) return found.id as string;

  const { data: inserted, error } = await supabase
    .from("sponsors")
    .insert({
      image_url: sponsor.imageUrl,
      link_url: sponsor.linkUrl ?? "",
      name: sponsor.name ?? "",
      organization_profile_id: organizationProfileId,
    })
    .select("id")
    .single();
  if (error || !inserted) return null;
  return inserted.id as string;
}
