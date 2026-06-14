import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { requireTournamentOwner } from "@/lib/scorer/auth";
import { checkRateLimit, getClientIp } from "@/lib/scorer/rate-limit";

/**
 * POST /api/scorer/[token]/revoke
 *
 * El organizador revoca un link activo. Idempotente: re-revocar uno ya
 * revocado retorna 200. Requiere Bearer token del organizer.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const ip = getClientIp(request);
  const limit = checkRateLimit(`scorer-revoke:${ip}`, 20);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate-limit", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429 }
    );
  }

  // Buscar el link para conocer su tournament_id (necesario para
  // requireTournamentOwner).
  const { data: link, error: fetchErr } = await supabaseAdmin
    .from("scorer_links")
    .select("token, tournament_id, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (fetchErr) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  const auth = await requireTournamentOwner(request, link.tournament_id);
  if (auth instanceof NextResponse) return auth;

  if (link.revoked_at) {
    // Idempotente.
    return NextResponse.json({ ok: true, alreadyRevoked: true });
  }

  const { error: updErr } = await supabaseAdmin
    .from("scorer_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token", token);
  if (updErr) {
    return NextResponse.json({ error: "DB error: " + updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
