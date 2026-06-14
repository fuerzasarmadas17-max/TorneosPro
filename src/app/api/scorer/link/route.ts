import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { requireTournamentOwner } from "@/lib/scorer/auth";
import { generateScorerToken } from "@/lib/scorer/token";
import { checkRateLimit, getClientIp } from "@/lib/scorer/rate-limit";
import { MAX_SCORER_LINKS_BY_TIER } from "@/lib/pricing";
import { TournamentTier } from "@/types";

/**
 * POST /api/scorer/link
 * Body: { tournamentId: string; matchIds: string[] }
 *
 * Crea un scorer-link cubriendo los partidos seleccionados. Valida:
 *   - Caller es el organizer del torneo (Bearer token).
 *   - Todos los matchIds existen, pertenecen al torneo, status='scheduled'.
 *   - Tier-cap: cuántos scorer_links activos hay vs MAX_SCORER_LINKS_BY_TIER.
 *
 * `expires_at` se calcula server-side como MAX(match.date + match.time)
 * + 24h. Si algún partido no tiene `date`/`time` seteados, fallamos
 * con 400 (no podemos calcular expiración).
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

  const tournamentId = body.tournamentId;
  const matchIds = Array.isArray(body.matchIds) ? body.matchIds : [];
  if (!tournamentId || typeof tournamentId !== "string") {
    return NextResponse.json({ error: "Missing tournamentId" }, { status: 400 });
  }
  if (matchIds.length === 0) {
    return NextResponse.json({ error: "matchIds vacío" }, { status: 400 });
  }
  if (matchIds.length > 50) {
    return NextResponse.json({ error: "Máximo 50 partidos por link" }, { status: 400 });
  }
  if (!matchIds.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "matchIds inválido" }, { status: 400 });
  }

  // Auth + organizer check.
  const auth = await requireTournamentOwner(request, tournamentId);
  if (auth instanceof NextResponse) return auth;

  // Cargar tier del torneo (para el cap).
  const { data: tournament, error: tournErr } = await supabaseAdmin
    .from("tournaments")
    .select("tier")
    .eq("id", tournamentId)
    .single();
  if (tournErr || !tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }
  const tierKey = (tournament.tier as TournamentTier | null) ?? "free";
  const cap = MAX_SCORER_LINKS_BY_TIER[tierKey as keyof typeof MAX_SCORER_LINKS_BY_TIER];

  // Cap por tier: contar links activos (no revoked, no expired).
  const nowIso = new Date().toISOString();
  const { count: activeCount, error: countErr } = await supabaseAdmin
    .from("scorer_links")
    .select("token", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)
    .is("revoked_at", null)
    .gt("expires_at", nowIso);
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

  // Validar los partidos: existen + pertenecen al torneo + scheduled +
  // tienen date+time para calcular expiración.
  const { data: matches, error: matchErr } = await supabaseAdmin
    .from("matches")
    .select("id, tournament_id, status, date, time")
    .in("id", matchIds);
  if (matchErr) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (!matches || matches.length !== matchIds.length) {
    return NextResponse.json({ error: "Algunos partidos no existen" }, { status: 400 });
  }
  const wrongTournament = matches.find((m) => m.tournament_id !== tournamentId);
  if (wrongTournament) {
    return NextResponse.json(
      { error: "Partidos de otro torneo" },
      { status: 400 }
    );
  }
  const notScheduled = matches.find(
    (m) => m.status !== "scheduled" && m.status !== "postponed"
  );
  if (notScheduled) {
    return NextResponse.json(
      { error: "Solo se pueden incluir partidos programados o aplazados" },
      { status: 400 }
    );
  }
  // Calcular expires_at = MAX(date + time) + 24h. Si todos los partidos
  // ya pasaron (organizador delega carga retroactiva), usamos now() como
  // piso para que el link sirva al menos 24h desde su creación — sino
  // arrancaría expirado y daría 404 al toque.
  let latestMs = 0;
  for (const m of matches) {
    if (!m.date || !m.time) {
      return NextResponse.json(
        { error: "Todos los partidos deben tener fecha y hora" },
        { status: 400 }
      );
    }
    const ms = Date.parse(`${m.date}T${m.time}:00`);
    if (Number.isNaN(ms)) {
      return NextResponse.json(
        { error: "Formato de fecha/hora inválido" },
        { status: 400 }
      );
    }
    if (ms > latestMs) latestMs = ms;
  }
  const baseMs = Math.max(latestMs, Date.now());
  const expiresAt = new Date(baseMs + 24 * 60 * 60 * 1000).toISOString();

  // Crear el link.
  const token = generateScorerToken();
  const { error: insertErr } = await supabaseAdmin.from("scorer_links").insert({
    token,
    tournament_id: tournamentId,
    match_ids: matchIds,
    created_by: auth.userId,
    expires_at: expiresAt,
  });
  if (insertErr) {
    return NextResponse.json({ error: "DB error: " + insertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    token,
    expiresAt,
    matchCount: matchIds.length,
  });
}
