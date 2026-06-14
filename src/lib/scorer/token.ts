import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * Generates a URL-safe scorer token. 24 random bytes → 32 chars base64url.
 * Entropy of ~192 bits — impossible to guess by brute force, no need to
 * salt or hash; the random itself IS the credential. Stored in
 * `scorer_links.token` as primary key.
 */
export function generateScorerToken(): string {
  return randomBytes(24).toString("base64url");
}

export interface ScorerLinkRow {
  token: string;
  tournament_id: string;
  match_ids: string[];
  created_by: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  usage_count: number;
}

/**
 * Validates a token against the DB. Returns the row if valid (not
 * revoked, not expired, exists). Returns `null` for anything else —
 * intentional: don't leak whether a token existed but was revoked vs
 * never existed at all. Endpoint returns 404 in both cases.
 */
export async function validateScorerToken(
  token: string
): Promise<ScorerLinkRow | null> {
  if (!token || typeof token !== "string") return null;
  // base64url is [A-Za-z0-9_-]; 32 chars is the expected length but we
  // accept a sane range to be forgiving.
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;

  const { data, error } = await supabaseAdmin
    .from("scorer_links")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as ScorerLinkRow;
  if (row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  return row;
}

/**
 * Bumps usage_count + last_used_at after a successful save. Fire-and-forget
 * from the caller's perspective — failing this should not block the result
 * from being saved.
 */
export async function recordScorerUsage(token: string): Promise<void> {
  // Read-modify-write on a single column is fine here: the count is a UX
  // signal, not a security boundary, and Postgres handles the row-level
  // serialization for us.
  const { data } = await supabaseAdmin
    .from("scorer_links")
    .select("usage_count")
    .eq("token", token)
    .single();
  const next = (data?.usage_count ?? 0) + 1;
  await supabaseAdmin
    .from("scorer_links")
    .update({ usage_count: next, last_used_at: new Date().toISOString() })
    .eq("token", token);
}
