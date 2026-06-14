import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { validateScorerToken } from "@/lib/scorer/token";
import { checkRateLimit, getClientIp } from "@/lib/scorer/rate-limit";

/**
 * GET /api/scorer/[token]
 *
 * Endpoint público (sin auth) que el anotador hit al abrir el link. Devuelve
 * el torneo, los partidos cubiertos y la fecha de expiración. Si el token
 * no es válido (no existe, revocado o expirado) → 404. Intencional: no
 * revelamos qué error específicamente para no dar pistas a un atacante.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Rate limit por IP+token (max 60/min): permite carga normal pero corta
  // intentos de polling agresivo / scraping.
  const ip = getClientIp(request);
  const limit = checkRateLimit(`scorer-get:${ip}:${token}`, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate-limit", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429 }
    );
  }

  const link = await validateScorerToken(token);
  if (!link) {
    return NextResponse.json(
      { error: "link-not-found" },
      { status: 404 }
    );
  }

  // Cargar tournament + matches en paralelo. Sólo los campos necesarios
  // para que el anotador pueda anotar (no exponemos config interna).
  const [tournRes, matchesRes] = await Promise.all([
    supabaseAdmin
      .from("tournaments")
      .select("id, name, sport, format, enabled_stats, plan")
      .eq("id", link.tournament_id)
      .single(),
    supabaseAdmin
      .from("matches")
      .select(
        "id, round, match_number, home_team_id, away_team_id, home_score, away_score, status, date, time, venue, result_entered_by_name, match_events(id, match_id, team_id, player_name, type, position, paid), volleyball_sets(set_number, home_points, away_points)"
      )
      .in("id", link.match_ids),
  ]);

  if (tournRes.error || !tournRes.data) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }
  if (matchesRes.error) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  // Necesitamos nombre + colores + roster de los equipos involucrados
  // para que (a) la lista de partidos no muestre UUIDs y (b) el anotador
  // tenga typeahead de jugadores al cargar eventos en lugar de escribir
  // a mano cada nombre.
  const teamIds = new Set<string>();
  for (const m of matchesRes.data ?? []) {
    if (m.home_team_id) teamIds.add(m.home_team_id);
    if (m.away_team_id) teamIds.add(m.away_team_id);
  }
  const { data: teamsRows } = await supabaseAdmin
    .from("teams")
    .select("id, name, primary_color, secondary_color, players(id, name)")
    .in("id", Array.from(teamIds));

  return NextResponse.json({
    tournament: {
      id: tournRes.data.id,
      name: tournRes.data.name,
      sport: tournRes.data.sport,
      format: tournRes.data.format,
      enabledStats: tournRes.data.enabled_stats ?? [],
      plan: tournRes.data.plan,
    },
    teams: (teamsRows ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      primaryColor: t.primary_color,
      secondaryColor: t.secondary_color,
      // Players viene como array de { id, name } gracias al embed players(id, name).
      // El anotador los usa para typeahead; mantenemos texto libre como
      // fallback si el jugador no está cargado en la base.
      players: Array.isArray(t.players)
        ? (t.players as { id: string; name: string }[]).map((p) => ({
            id: p.id,
            name: p.name,
          }))
        : [],
    })),
    matches: (matchesRes.data ?? []).map((m) => ({
      id: m.id,
      round: m.round,
      matchNumber: m.match_number,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      homeScore: m.home_score,
      awayScore: m.away_score,
      status: m.status,
      date: m.date,
      time: m.time,
      venue: m.venue,
      resultEnteredByName: m.result_entered_by_name,
      events: m.match_events ?? [],
      sets: m.volleyball_sets ?? [],
    })),
    expiresAt: link.expires_at,
    matchIds: link.match_ids,
  });
}
