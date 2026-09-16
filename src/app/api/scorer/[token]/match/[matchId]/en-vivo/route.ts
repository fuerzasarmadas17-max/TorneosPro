import { NextRequest, NextResponse } from "next/server";
import { getSportCategory } from "@/types";
import { supabaseAdmin } from "@/lib/supabase-server";
import { validateScorerToken, linkTournamentIds } from "@/lib/scorer/token";
import { checkRateLimit, getClientIp } from "@/lib/scorer/rate-limit";
import { limpiarFoto } from "@/lib/volley/en-vivo";

/**
 * POST /api/scorer/[token]/match/[matchId]/en-vivo
 *
 * La planilla manda cómo va el partido mientras se juega, para el marcador en
 * vivo del público. Guarda UNA fila por partido y la reemplaza: no crece.
 *
 * NO ES EL RESULTADO. No toca `matches` ni `volleyball_sets`: va a
 * `match_live_scores`, que no está en el tiempo real de la página del torneo.
 * Si viviera en `matches`, cada envío le llegaría a cada persona con la página
 * abierta, y el costo crecería con la gente que mira.
 *
 * La planilla lo manda y se olvida: si esto falla, no se reintenta, porque el
 * próximo envío trae la foto completa igual.
 *
 * Ver `Por hacer/deportes/voley/PLANILLA-EN-VIVO-PUBLICO.md`.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; matchId: string }> }
) {
  const { token, matchId } = await params;

  // La planilla manda como mucho 2 por minuto, más los de "volvió la señal" y
  // cierre de set. 12 deja aire para eso y corta a quien mande en ráfaga.
  const ip = getClientIp(request);
  const limit = checkRateLimit(`scorer-en-vivo:${ip}:${token}:${matchId}`, 12);
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate-limit" }, { status: 429 });
  }

  let body: { foto?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const foto = limpiarFoto(body.foto);
  if (!foto) {
    return NextResponse.json({ error: "La foto del partido no es válida." }, { status: 400 });
  }

  const link = await validateScorerToken(token);
  if (!link) {
    return NextResponse.json({ error: "link-not-found" }, { status: 404 });
  }
  if (!link.match_ids.includes(matchId)) {
    return NextResponse.json({ error: "Match no incluido en este link" }, { status: 403 });
  }

  const { data: match } = await supabaseAdmin
    .from("matches")
    .select("id, tournament_id, status")
    .eq("id", matchId)
    .single();
  if (!match) {
    return NextResponse.json({ error: "Match no encontrado" }, { status: 404 });
  }
  if (!linkTournamentIds(link).includes(match.tournament_id)) {
    return NextResponse.json({ error: "Match de otro torneo" }, { status: 403 });
  }
  // Un latido que llega tarde, después de guardado el resultado, no puede volver
  // a poner "EN VIVO" un partido que ya terminó.
  if (match.status === "completed") {
    return NextResponse.json({ ok: true, ignorado: "terminado" });
  }

  const { data: tournament } = await supabaseAdmin
    .from("tournaments")
    .select("sport")
    .eq("id", match.tournament_id)
    .single();
  if (!tournament || getSportCategory(tournament.sport) !== "volleyball") {
    return NextResponse.json({ error: "El en vivo es solo de vóley." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("match_live_scores").upsert({
    match_id: matchId,
    tournament_id: match.tournament_id,
    state: foto,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    return NextResponse.json({ error: "DB error: " + error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
