import { supabase } from "@/lib/supabase";
import { ClubLogo } from "@/types";
import { mapClubLogo } from "./mappers";

/** Lista los logos de club de una organización (la biblioteca). */
export async function fetchClubLogos(organizationProfileId: string): Promise<ClubLogo[]> {
  const { data, error } = await supabase
    .from("club_logos")
    .select("id, name, image_url")
    .eq("organization_profile_id", organizationProfileId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(mapClubLogo);
}

/** Crea un logo de club nuevo en la biblioteca. Devuelve el creado (con id real). */
export async function createClubLogo(
  organizationProfileId: string,
  input: { name: string; imageUrl: string }
): Promise<ClubLogo | null> {
  const { data, error } = await supabase
    .from("club_logos")
    .insert({
      organization_profile_id: organizationProfileId,
      name: input.name,
      image_url: input.imageUrl,
    })
    .select("id, name, image_url")
    .single();
  if (error || !data) return null;
  return mapClubLogo(data);
}

/**
 * Actualiza un logo de club (nombre y/o imagen). Si cambió la imagen, la
 * propaga a TODOS los equipos que referencian este logo (para que las N
 * categorías del club queden con la imagen nueva).
 */
export async function updateClubLogo(
  id: string,
  updates: { name?: string; imageUrl?: string }
): Promise<boolean> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl;

  if (Object.keys(dbUpdates).length > 0) {
    const { error } = await supabase.from("club_logos").update(dbUpdates).eq("id", id);
    if (error) return false;
  }

  // Propagar la imagen a los equipos que usan este logo de club.
  if (updates.imageUrl !== undefined) {
    await supabase.from("teams").update({ logo_url: updates.imageUrl }).eq("club_logo_id", id);
  }
  return true;
}

/**
 * Borra un logo de club de la biblioteca. Los equipos que lo usaban quedan con
 * club_logo_id = NULL (ON DELETE SET NULL) y conservan su última imagen.
 */
export async function deleteClubLogo(id: string): Promise<boolean> {
  const { error } = await supabase.from("club_logos").delete().eq("id", id);
  return !error;
}
