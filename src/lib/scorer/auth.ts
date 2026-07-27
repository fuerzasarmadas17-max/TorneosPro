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
  return requireTournamentsOwner(request, [tournamentId]);
}

/**
 * Igual que `requireTournamentOwner` pero para N torneos: el caller tiene que
 * ser dueño de **todos**. Lo usa la creación de links multi-torneo, donde los
 * partidos elegidos pueden venir de varios torneos del mismo organizador.
 */
export async function requireTournamentsOwner(
  request: NextRequest,
  tournamentIds: string[]
): Promise<{ userId: string } | NextResponse> {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;

  const unique = Array.from(new Set(tournamentIds));
  if (unique.length === 0) {
    return NextResponse.json({ error: "Missing tournamentId" }, { status: 400 });
  }

  const { data: rows, error } = await supabaseAdmin
    .from("tournaments")
    .select("id, created_by")
    .in("id", unique);

  if (error) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (!rows || rows.length !== unique.length) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }
  if (rows.some((r) => r.created_by !== user.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { userId: user.userId };
}

/**
 * Valida el Bearer token y devuelve el userId, sin mirar torneos. Para
 * endpoints que resuelven la autorización por su cuenta (p. ej. revocar un
 * link, que se compara contra `scorer_links.created_by`).
 */
export async function requireUser(
  request: NextRequest
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

  return { userId: userResp.user.id };
}
