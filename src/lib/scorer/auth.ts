import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * Server-side guard for "is this caller the organizer of <tournamentId>?".
 *
 * Used by the scorer-link endpoints that the organizer hits with their
 * own logged-in session (create link, revoke). The client must send the
 * user's Supabase access token in `Authorization: Bearer <token>` —
 * same pattern as `require-admin.ts`.
 *
 * Returns `{ userId }` on success or a `NextResponse` the route should
 * return as-is.
 */
export async function requireTournamentOwner(
  request: NextRequest,
  tournamentId: string
): Promise<{ userId: string } | NextResponse> {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Config error" }, { status: 500 });
  }

  const validator = createClient(supabaseUrl, anonKey);
  const { data: userResp, error: authError } =
    await validator.auth.getUser(token);
  if (authError || !userResp?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Confirm this user is the creator of the tournament.
  const { data: row, error } = await supabaseAdmin
    .from("tournaments")
    .select("id, created_by, tier")
    .eq("id", tournamentId)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }
  if (row.created_by !== userResp.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { userId: userResp.user.id };
}
