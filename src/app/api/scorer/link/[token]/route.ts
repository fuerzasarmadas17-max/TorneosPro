import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { requireUser } from "@/lib/scorer/auth";
import { validateLinkMatches } from "@/lib/scorer/validate-link-matches";
import { checkRateLimit, getClientIp } from "@/lib/scorer/rate-limit";

/**
 * PATCH /api/scorer/link/[token]
 * Body: { matchIds: string[] }  — el set COMPLETO de partidos del link.
 *
 * Edita qué partidos cubre un link ya creado, para sacar uno que se
 * reprogramó o sumar uno que apareció después, sin tener que revocar y
 * mandarle al anotador una URL nueva. El token no cambia.
 *
 * Rehace `tournament_ids` y `expires_at` a partir de los partidos nuevos, así
 * que quitar el último partido de un torneo lo saca del link, y sumar uno más
 * tarde estira la expiración.
 *
 * No se puede editar un link revocado o expirado: ya no sirve, y editarlo lo
 * resucitaría por la vía del recálculo de expires_at.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const ip = getClientIp(request);
  const limit = checkRateLimit(`edit-link:${ip}`, 40);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate-limit", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429 }
    );
  }

  let body: { matchIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const matchIds = Array.isArray(body.matchIds)
    ? Array.from(new Set(body.matchIds))
    : [];

  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const userId = auth.userId;

  const { data: link, error: fetchErr } = await supabaseAdmin
    .from("scorer_links")
    .select("token, created_by, revoked_at, expires_at, match_ids")
    .eq("token", token)
    .maybeSingle();
  if (fetchErr) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }
  if (link.created_by !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (
    link.revoked_at ||
    new Date(link.expires_at).getTime() <= Date.now()
  ) {
    return NextResponse.json(
      { error: "Este link ya no está activo. Generá uno nuevo." },
      { status: 409 }
    );
  }

  // Mismas reglas que al crear, salvo dos excepciones para los partidos que ya
  // están en ESTE link: no cuentan como "ya repartidos", y se les perdona el
  // estado (uno ya anotado quedó `completed` y no debe bloquear la edición).
  const validated = await validateLinkMatches(matchIds, userId, {
    excludeToken: token,
    existingIds: (link.match_ids as string[]) ?? [],
  });
  if (validated instanceof NextResponse) return validated;
  const { tournamentIds, expiresAt } = validated;

  const { error: updErr } = await supabaseAdmin
    .from("scorer_links")
    .update({
      match_ids: matchIds,
      tournament_ids: tournamentIds,
      tournament_id: tournamentIds.length === 1 ? tournamentIds[0] : null,
      expires_at: expiresAt,
    })
    .eq("token", token);
  if (updErr) {
    return NextResponse.json(
      { error: "DB error: " + updErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    token,
    expiresAt,
    matchCount: matchIds.length,
    tournamentCount: tournamentIds.length,
  });
}
