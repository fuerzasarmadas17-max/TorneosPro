import { supabase } from "@/lib/supabase";
import { Sponsor } from "@/types";
import { mapSponsor } from "./mappers";

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

/**
 * Marca (o desmarca) un sponsor de la biblioteca para mostrarse en el perfil
 * público del organizador.
 */
export async function setSponsorOnProfile(
  sponsorId: string,
  show: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from("sponsors")
    .update({ show_on_profile: show })
    .eq("id", sponsorId);
  return !error;
}

/**
 * Crea un sponsor nuevo en la biblioteca de la organización YA marcado para el
 * perfil. Devuelve la fila creada (con id real). Se usa al "subir nuevo" desde
 * la config del perfil.
 */
export async function createProfileSponsor(
  organizationProfileId: string,
  input: { name: string; imageUrl: string; linkUrl?: string }
): Promise<Sponsor | null> {
  const { data, error } = await supabase
    .from("sponsors")
    .insert({
      organization_profile_id: organizationProfileId,
      name: input.name,
      image_url: input.imageUrl,
      link_url: input.linkUrl ?? "",
      show_on_profile: true,
    })
    .select("id, image_url, link_url, name, library_sponsor_id, show_on_profile")
    .single();
  if (error || !data) return null;
  return mapSponsor(data);
}
