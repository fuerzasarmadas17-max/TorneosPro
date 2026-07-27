import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { requireUser } from "@/lib/scorer/auth";
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

  // La autorización va contra `created_by`: un link multi-torneo no tiene un
  // torneo único contra el cual chequear, y el creador siempre es el dueño.
  const { data: link, error: fetchErr } = await supabaseAdmin
    .from("scorer_links")
    .select("token, created_by, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (fetchErr) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  if (link.created_by !== auth.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
