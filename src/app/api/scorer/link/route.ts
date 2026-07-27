import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { requireUser } from "@/lib/scorer/auth";
import { generateScorerToken } from "@/lib/scorer/token";
import { validateLinkMatches } from "@/lib/scorer/validate-link-matches";
import { checkRateLimit, getClientIp } from "@/lib/scorer/rate-limit";
import { getOrganizerScorerLinkCap } from "@/lib/pricing";
import { TournamentTier } from "@/types";

/**
 * POST /api/scorer/link
 * Body: { matchIds: string[]; tournamentId?: string }
 *
 * Crea un scorer-link cubriendo los partidos seleccionados. Los partidos
 * pueden venir de **varios torneos** del mismo organizador (la agenda del
 * dashboard deja armar un link con todo lo que se juega un día). Los torneos
 * se derivan de los propios partidos; `tournamentId` queda aceptado pero
 * ignorado, por compatibilidad con la sección por torneo.
 *
 * La validación de los partidos (existencia, estado, propiedad, solapamiento
 * con otros links, expiración) vive en `validateLinkMatches`, compartida con
 * el PATCH que edita un link existente.
 */
export async function POST(request: NextRequest) {
  // Rate limit (por IP, max 20 creaciones/min).
  const ip = getClientIp(request);
  const limit = checkRateLimit(`create-link:${ip}`, 20);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate-limit", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429 }
    );
  }

  let body: { tournamentId?: string; matchIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const matchIds = Array.isArray(body.matchIds)
    ? Array.from(new Set(body.matchIds))
    : [];

  // Auth primero: no tocamos la DB con service role para un caller anónimo.
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const userId = auth.userId;

  const validated = await validateLinkMatches(matchIds, userId);
  if (validated instanceof NextResponse) return validated;
  const { tournamentIds, expiresAt } = validated;

  // Cupo GLOBAL del organizador: el mejor plan entre todos sus torneos define
  // cuántos links activos puede tener en total, repartidos como quiera.
  const { data: ownedTournaments, error: tiersErr } = await supabaseAdmin
    .from("tournaments")
    .select("tier")
    .eq("created_by", userId);
  if (tiersErr) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  const cap = getOrganizerScorerLinkCap(
    (ownedTournaments ?? []).map((t) => t.tier as TournamentTier | null)
  );

  const { count: activeCount, error: countErr } = await supabaseAdmin
    .from("scorer_links")
    .select("token", { count: "exact", head: true })
    .eq("created_by", userId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString());
  if (countErr) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if ((activeCount ?? 0) >= cap) {
    return NextResponse.json(
      {
        error: "tier-limit",
        current: activeCount ?? 0,
        max: cap === Number.POSITIVE_INFINITY ? null : cap,
      },
      { status: 403 }
    );
  }

  // Crear el link. `tournament_id` solo se setea si es de un torneo único:
  // así ese caso conserva el ON DELETE CASCADE de la FK.
  const token = generateScorerToken();
  const { error: insertErr } = await supabaseAdmin.from("scorer_links").insert({
    token,
    tournament_id: tournamentIds.length === 1 ? tournamentIds[0] : null,
    tournament_ids: tournamentIds,
    match_ids: matchIds,
    created_by: userId,
    expires_at: expiresAt,
  });
  if (insertErr) {
    return NextResponse.json({ error: "DB error: " + insertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    token,
    expiresAt,
    matchCount: matchIds.length,
    tournamentCount: tournamentIds.length,
  });
}
