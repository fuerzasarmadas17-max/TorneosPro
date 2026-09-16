import { NextRequest, NextResponse } from "next/server";
import { getSportCategory } from "@/types";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  validateScorerToken,
  recordScorerUsage,
  linkTournamentIds,
} from "@/lib/scorer/token";
import { checkRateLimit, getClientIp } from "@/lib/scorer/rate-limit";
import type { EstadoAplazado } from "@/lib/volley/planilla";

/**
 * POST /api/scorer/[token]/match/[matchId]/postpone
 *
 * El partido se fue a la lluvia a mitad de camino. Guarda POR DÓNDE IBA y lo
 * manda a la pestaña de Aplazados.
 *
 * POR QUÉ NO ENTRA POR `/result`. Porque no es un resultado. Un 1-0 en un
 * partido a 3 sets no existe en vóley, y `validateVolleyballSets` lo rechaza a
 * propósito: es la regla que impide que un partido a medio cargar desordene la
 * tabla de posiciones. Esa regla se queda como está; lo que va a medias entra
 * por esta puerta y a una casilla aparte (`volley_partial_state`), que leen solo
 * la pestaña de Aplazados y la planilla el día que el partido se reprograme.
 *
 * LO QUE NO TOCA: `home_score`, `away_score`, `winner_id` y las filas de
 * `volleyball_sets` se quedan como estaban. El marcador oficial del partido
 * sigue vacío hasta que el partido termine de verdad.
 *
 * Ver `Por hacer/deportes/voley/APLAZADO-PLANILLA-URGENTE.md`.
 */

/** Un número de set o de puntos que la planilla podría haber generado. */
function enteroEntre(v: unknown, min: number, max: number): boolean {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}

function esLado(v: unknown): boolean {
  return v === "home" || v === "away";
}

/** Revisa que la foto del partido sea una foto de un partido y no cualquier
 *  cosa: el link del planillero es público y quien tenga el token puede mandar
 *  lo que quiera. Devuelve el error para el planillero, o `null`. */
function revisarEstado(estado: unknown): string | null {
  if (!estado || typeof estado !== "object") return "Falta cómo iba el partido.";
  const e = estado as Record<string, unknown>;

  if (!Array.isArray(e.setsCerrados) || e.setsCerrados.length > 9) {
    return "Los sets cerrados no son válidos.";
  }
  for (const s of e.setsCerrados as Record<string, unknown>[]) {
    if (
      !s ||
      !enteroEntre(s.n, 1, 9) ||
      !enteroEntre(s.home, 0, 99) ||
      !enteroEntre(s.away, 0, 99)
    ) {
      return "Los puntos de un set cerrado no son válidos.";
    }
  }

  // Aplazar justo entre dos sets es legítimo: no hay set en curso que guardar.
  if (e.enCurso !== null && e.enCurso !== undefined) {
    const c = e.enCurso as Record<string, unknown>;
    if (
      !enteroEntre(c.n, 1, 9) ||
      !enteroEntre(c.home, 0, 99) ||
      !enteroEntre(c.away, 0, 99) ||
      !esLado(c.saca) ||
      !esLado(c.izquierda) ||
      typeof c.yaCambiaronDeCancha !== "boolean"
    ) {
      return "El set en curso no es válido.";
    }
  }

  if (typeof e.mesa !== "string" || e.mesa.length > 80) {
    return "El nombre de la mesa no es válido.";
  }
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; matchId: string }> }
) {
  const { token, matchId } = await params;

  const ip = getClientIp(request);
  const limit = checkRateLimit(`scorer-postpone:${ip}:${token}:${matchId}`, 10);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate-limit", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429 }
    );
  }

  const link = await validateScorerToken(token);
  if (!link) {
    return NextResponse.json({ error: "link-not-found" }, { status: 404 });
  }
  if (!link.match_ids.includes(matchId)) {
    return NextResponse.json(
      { error: "Match no incluido en este link" },
      { status: 403 }
    );
  }

  let body: { scorerName?: string; motivo?: string; estado?: EstadoAplazado };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const scorerName = (body.scorerName ?? "").trim();
  if (scorerName.length < 1 || scorerName.length > 80) {
    return NextResponse.json(
      { error: "Nombre del anotador inválido" },
      { status: 400 }
    );
  }

  // El motivo es obligatorio, igual que cuando el organizador aplaza a mano: sin
  // él, el partido aparece en Aplazados y nadie sabe por qué.
  const motivo = (body.motivo ?? "").trim();
  if (motivo.length < 1 || motivo.length > 200) {
    return NextResponse.json(
      { error: "Escribí por qué se aplazó el partido." },
      { status: 400 }
    );
  }

  const errorDelEstado = revisarEstado(body.estado);
  if (errorDelEstado) {
    return NextResponse.json({ error: errorDelEstado }, { status: 400 });
  }

  const { data: match, error: matchErr } = await supabaseAdmin
    .from("matches")
    .select("id, tournament_id, status")
    .eq("id", matchId)
    .single();
  if (matchErr || !match) {
    return NextResponse.json({ error: "Match no encontrado" }, { status: 404 });
  }
  if (!linkTournamentIds(link).includes(match.tournament_id)) {
    return NextResponse.json({ error: "Match de otro torneo" }, { status: 403 });
  }

  // Un partido ya cargado no se aplaza: sería desandar un resultado que el
  // organizador ya está viendo en la tabla. Si de verdad hay que corregirlo, lo
  // hace el organizador desde su panel, que es quien puede ver las consecuencias.
  if (match.status === "completed") {
    return NextResponse.json(
      {
        error:
          "Este partido ya tiene el resultado cargado. Pedile al organizador que lo corrija.",
      },
      { status: 409 }
    );
  }

  // Solo vóley. La planilla es de vóley, pero el endpoint es público y esto es
  // lo que impide que a un partido de fútbol le quede pegada una casilla que
  // ninguna pantalla suya sabe leer.
  const { data: tournament } = await supabaseAdmin
    .from("tournaments")
    .select("sport")
    .eq("id", match.tournament_id)
    .single();
  if (!tournament || getSportCategory(tournament.sport) !== "volleyball") {
    return NextResponse.json(
      { error: "La planilla en vivo es solo de vóley." },
      { status: 400 }
    );
  }

  const { error: updErr } = await supabaseAdmin
    .from("matches")
    .update({
      status: "postponed",
      postponed_reason: motivo,
      volley_partial_state: body.estado,
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  if (updErr) {
    return NextResponse.json(
      { error: "DB error: " + updErr.message },
      { status: 500 }
    );
  }

  recordScorerUsage(token).catch((err) => {
    console.error("recordScorerUsage failed", err);
  });

  return NextResponse.json({ ok: true });
}
