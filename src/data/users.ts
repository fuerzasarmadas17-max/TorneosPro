import { supabase } from "@/lib/supabase";
import { mapOrganizationProfile } from "@/lib/db/mappers";
import { OrganizationProfile } from "@/types";

// --- Pure utility ---

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 50);
}

// --- Supabase lookup helpers ---

export async function getUserBySlug(
  slug: string
): Promise<
  | {
      id: string;
      name: string;
      isActive: boolean;
      organizationProfile: OrganizationProfile;
    }
  | undefined
> {
  const { data, error } = await supabase
    .from("organization_profiles")
    .select(
      "*, users!inner(id, name, is_active), social_links(*), sponsors(*)"
    )
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (error || !data) return undefined;

  const userRow = data.users as Record<string, unknown>;
  if ((userRow.is_active as boolean) === false) return undefined;

  return {
    id: userRow.id as string,
    name: userRow.name as string,
    isActive: userRow.is_active as boolean,
    organizationProfile: mapOrganizationProfile({
      ...data,
      social_links: Array.isArray(data.social_links)
        ? data.social_links[0] ?? undefined
        : data.social_links,
    }),
  };
}

export async function isSlugAvailable(
  slug: string,
  excludeUserId?: string
): Promise<boolean> {
  let query = supabase
    .from("organization_profiles")
    .select("id, user_id")
    .eq("slug", slug);

  if (excludeUserId) {
    query = query.neq("user_id", excludeUserId);
  }

  const { data } = await query;
  return !data || data.length === 0;
}
