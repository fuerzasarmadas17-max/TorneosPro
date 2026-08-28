import { NextRequest, NextResponse } from "next/server";
import { getSportCategory } from "@/types";
import {
  validateVolleyballSets,
  volleyballDrawAllowed,
} from "@/lib/volleyball-sets";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  validateScorerToken,
  recordScorerUsage,
  linkTournamentIds,
} from "@/lib/scorer/token";
import { checkRateLimit, getClientIp } from "@/lib/scorer/rate-limit";
import { normalizePlayerName } from "@/lib/name-utils";

interface EventInput {
  teamId: string;
  playerName: string;
  type: string;
  position?: string | null;
  paid?: boolean;
}

interface SetInput {
  setNumber: number;
  homePoints: number;
  awayPoints: number;
}

/**
 * POST /api/scorer/[token]/match/[matchId]/result
 *
 * Endpoint público que el anotador llama para guardar el resultado de un
 * partido. Validaciones:
 *   - Token válido (no expirado, no revocado, existe).
 *   - matchId está en scorer_links.match_ids del token.
 *   - scorerName presente y no vacío.
 *   - Scores en rango cuerdo (0..999) — defensa contra inyección de stats
 *     absurdas que reventarían UI/standings.
 *
 * Sigue el patrón "borrar todo y reinsertar" para events/sets que ya usa
 * el form del organizador. Si más adelante el flow cambia, actualizar.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; matchId: string }> }
) {
  const { token, matchId } = await params;

  // Rate limit por token + matchId: 30 saves/min de un mismo partido es
  // más que suficiente para correcciones rápidas; arriba de eso huele a
  // abuso o bug del cliente.
  const ip = getClientIp(request);
  const limit = checkRateLimit(`scorer-save:${ip}:${token}:${matchId}`, 30);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate-limit", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429 }
    );
  }

  // Validar token.
  const link = await validateScorerToken(token);
  if (!link) {
    return NextResponse.json({ error: "link-not-found" }, { status: 404 });
  }
  if (!link.match_ids.includes(matchId)) {
    return NextResponse.json({ error: "Match no incluido en este link" }, { status: 403 });
  }

  // Parsear y validar el body.
  let body: {
    scorerName?: string;
    homeScore?: number;
    awayScore?: number;
    sets?: SetInput[];
    events?: EventInput[];
    walkover?: boolean;
    fairPlayTeamId?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const scorerName = (body.scorerName ?? "").trim();
  if (scorerName.length < 1 || scorerName.length > 80) {
    return NextResponse.json({ error: "Nombre del anotador inválido" }, { status: 400 });
  }

  const homeScore = Number(body.homeScore);
  const awayScore = Number(body.awayScore);
  if (
    !Number.isFinite(homeScore) ||
    !Number.isFinite(awayScore) ||
    homeScore < 0 ||
    awayScore < 0 ||
    homeScore > 999 ||
    awayScore > 999 ||
    !Number.isInteger(homeScore) ||
    !Number.isInteger(awayScore)
  ) {
    return NextResponse.json(
      { error: "Marcador inválido (debe ser entero 0..999)" },
      { status: 400 }
    );
  }

  // Cargar el match para conocer home/away teams y validar que pertenece
  // a alguno de los torneos del link (defensa en profundidad: el match_ids
  // ya filtra, pero verificamos por si alguien manipuló la DB).
  const { data: match, error: matchErr } = await supabaseAdmin
    .from("matches")
    .select("id, tournament_id, home_team_id, away_team_id, phase")
    .eq("id", matchId)
    .single();
  if (matchErr || !match) {
    return NextResponse.json({ error: "Match no encontrado" }, { status: 404 });
  }
  if (!linkTournamentIds(link).includes(match.tournament_id)) {
    return NextResponse.json({ error: "Match de otro torneo" }, { status: 403 });
  }

  // Juego limpio: el premio es de uno de los dos equipos del partido, o de
  // nadie. Se valida contra el partido y no contra lo que mande el cliente —
  // sin esto, un token válido podría escribirle el premio a un equipo de otro
  // torneo y regalarle un punto en una tabla ajena.
  const fairPlayTeamId =
    body.fairPlayTeamId === undefined ? undefined : body.fairPlayTeamId || null;
  if (
    fairPlayTeamId != null &&
    fairPlayTeamId !== match.home_team_id &&
    fairPlayTeamId !== match.away_team_id
  ) {
    return NextResponse.json(
      { error: "Juego limpio con equipo ajeno al partido" },
      { status: 400 }
    );
  }

  // ---- Vóley: los sets son obligatorios y tienen que cuadrar con el marcador.
  //
  // Va ACÁ, antes del UPDATE, y no junto al insert de los sets más abajo: si se
  // validara allá, un envío inválido ya habría dejado el partido marcado como
  // jugado con marcador y sin sets — exactamente el estado que esto evita.
  //
  // Y va en el servidor además del navegador porque un link de planillero es un
  // endpoint público: quien tenga el token puede mandar lo que quiera.
  const { data: tournament } = await supabaseAdmin
    .from("tournaments")
    .select("sport, format, best_of")
    .eq("id", match.tournament_id)
    .single();

  if (tournament && getSportCategory(tournament.sport) === "volleyball") {
    const setsError = validateVolleyballSets(
      homeScore,
      awayScore,
      (body.sets ?? []).map((s) => ({
        homePoints: s.homePoints,
        awayPoints: s.awayPoints,
      })),
      {
        setsToWin: Math.ceil((tournament.best_of ?? 3) / 2),
        // El empate va en grupos y liga, no en playoffs. Se decide con lo que
        // dice la base, no con lo que mande el navegador.
        allowDraw: volleyballDrawAllowed(tournament.format, match.phase),
      }
    );
    if (setsError) {
      return NextResponse.json({ error: setsError }, { status: 400 });
    }
  }

  // Determinar winner_id (igual lógica que el form actual: mayor score gana;
  // empate → null).
  const winnerId =
    homeScore > awayScore
      ? match.home_team_id
      : awayScore > homeScore
        ? match.away_team_id
        : null;

  // 1) UPDATE matches: score + winner + status + trazabilidad.
  const { error: updErr } = await supabaseAdmin
    .from("matches")
    .update({
      home_score: homeScore,
      away_score: awayScore,
      winner_id: winnerId,
      status: "completed",
      // Se escribe siempre, no solo cuando es true: así corregir un partido
      // mal cargado como W lo desmarca. El cliente manda el marcador
      // reglamentario; acá solo registramos la marca.
      walkover: body.walkover === true,
      ...(fairPlayTeamId !== undefined
        ? { fair_play_team_id: fairPlayTeamId }
        : {}),
      result_entered_by_name: scorerName,
      result_entered_via_token: token,
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  if (updErr) {
    return NextResponse.json({ error: "DB error: " + updErr.message }, { status: 500 });
  }

  // 2) Volleyball sets: borrar y reinsertar.
  if (Array.isArray(body.sets)) {
    // Sanity check de cada set.
    for (const s of body.sets) {
      if (
        !Number.isInteger(s.setNumber) ||
        s.setNumber < 1 ||
        s.setNumber > 9 ||
        !Number.isInteger(s.homePoints) ||
        !Number.isInteger(s.awayPoints) ||
        s.homePoints < 0 ||
        s.awayPoints < 0 ||
        s.homePoints > 99 ||
        s.awayPoints > 99
      ) {
        return NextResponse.json({ error: "Set inválido" }, { status: 400 });
      }
    }
    await supabaseAdmin.from("volleyball_sets").delete().eq("match_id", matchId);
    if (body.sets.length > 0) {
      const rows = body.sets.map((s) => ({
        match_id: matchId,
        set_number: s.setNumber,
        home_points: s.homePoints,
        away_points: s.awayPoints,
        entered_by_name: scorerName,
        entered_via_token: token,
      }));
      const { error } = await supabaseAdmin.from("volleyball_sets").insert(rows);
      if (error) {
        return NextResponse.json({ error: "Sets DB error" }, { status: 500 });
      }
    }
  }

  // 3) Match events: borrar y reinsertar (mismo patrón que el form actual).
  if (Array.isArray(body.events)) {
    for (const e of body.events) {
      if (
        !e.teamId ||
        typeof e.teamId !== "string" ||
        !e.playerName ||
        typeof e.playerName !== "string" ||
        !e.type ||
        typeof e.type !== "string"
      ) {
        return NextResponse.json({ error: "Evento inválido" }, { status: 400 });
      }
      // Equipo del evento debe ser uno de los dos del partido.
      if (e.teamId !== match.home_team_id && e.teamId !== match.away_team_id) {
        return NextResponse.json(
          { error: "Evento con equipo ajeno al partido" },
          { status: 400 }
        );
      }
    }
    await supabaseAdmin.from("match_events").delete().eq("match_id", matchId);
    if (body.events.length > 0) {
      // Estampar player_id (y canonizar el nombre) cuando el goleador coincide
      // con un jugador de la plantilla, para que la estadística quede atada al
      // jugador. El anotador NO inscribe: si el nombre no está en la plantilla,
      // queda sin id y agrega por nombre (fallback).
      const teamIds = [match.home_team_id, match.away_team_id].filter(
        Boolean
      ) as string[];
      const rosterByTeam = new Map<
        string,
        Map<string, { name: string; id: string }>
      >();
      if (teamIds.length > 0) {
        const { data: roster } = await supabaseAdmin
          .from("players")
          .select("id, name, team_id")
          .in("team_id", teamIds);
        for (const p of roster ?? []) {
          const m = rosterByTeam.get(p.team_id) ?? new Map();
          m.set(normalizePlayerName(p.name), { name: p.name, id: p.id });
          rosterByTeam.set(p.team_id, m);
        }
      }
      const rows = body.events.map((e) => {
        const rp = rosterByTeam
          .get(e.teamId)
          ?.get(normalizePlayerName(e.playerName));
        return {
          match_id: matchId,
          team_id: e.teamId,
          player_name: rp ? rp.name : e.playerName,
          player_id: rp ? rp.id : null,
          type: e.type,
          position: e.position ?? null,
          paid: !!e.paid,
          entered_by_name: scorerName,
          entered_via_token: token,
        };
      });
      const { error } = await supabaseAdmin.from("match_events").insert(rows);
      if (error) {
        return NextResponse.json({ error: "Events DB error" }, { status: 500 });
      }
    }
  }

  // 4) Bump usage del link (fire and forget — no bloqueamos si falla).
  recordScorerUsage(token).catch((err) => {
    console.error("recordScorerUsage failed", err);
  });

  return NextResponse.json({ ok: true });
}
