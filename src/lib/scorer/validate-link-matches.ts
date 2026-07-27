import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export interface ValidatedLinkMatches {
  /** Torneos derivados de los propios partidos (nunca del body). */
  tournamentIds: string[];
  /** MAX(date + time) + 24h, con piso en now(). */
  expiresAt: string;
}

/**
 * Validación compartida por crear (POST) y editar (PATCH) un scorer-link.
 * Vive en un solo lugar a propósito: si editar validara menos que crear, se
 * podría meter por la puerta de atrás un partido que crear rechaza.
 *
 * Chequea que los partidos existan, sean programados/aplazados con fecha y
 * hora, pertenezcan a torneos del organizador, y que ninguno esté ya cubierto
 * por otro link activo (`excludeToken` deja pasar el link que se está
 * editando, cuyos propios partidos obviamente ya están en él).
 *
 * Devuelve un NextResponse listo para retornar si algo falla.
 */
export async function validateLinkMatches(
  matchIds: string[],
  userId: string,
  opts: { excludeToken?: string; existingIds?: string[] } = {}
): Promise<ValidatedLinkMatches | NextResponse> {
  if (matchIds.length === 0) {
    return NextResponse.json({ error: "matchIds vacío" }, { status: 400 });
  }
  if (matchIds.length > 50) {
    return NextResponse.json(
      { error: "Máximo 50 partidos por link" },
      { status: 400 }
    );
  }
  if (!matchIds.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "matchIds inválido" }, { status: 400 });
  }

  const { data: matches, error: matchErr } = await supabaseAdmin
    .from("matches")
    .select("id, tournament_id, status, date, time")
    .in("id", matchIds);
  if (matchErr) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (!matches || matches.length !== matchIds.length) {
    return NextResponse.json(
      { error: "Algunos partidos no existen" },
      { status: 400 }
    );
  }

  // El estado solo se exige a los partidos que ENTRAN. Los que ya estaban en
  // el link se dejan pasar aunque hayan cambiado: en cuanto el anotador carga
  // un resultado el partido pasa a `completed`, y si eso bloqueara la edición
  // el link quedaría congelado justo cuando se empieza a usar.
  const existing = new Set(opts.existingIds ?? []);
  const notScheduled = matches.find(
    (m) =>
      !existing.has(m.id) &&
      m.status !== "scheduled" &&
      m.status !== "postponed"
  );
  if (notScheduled) {
    return NextResponse.json(
      { error: "Solo se pueden incluir partidos programados o aplazados" },
      { status: 400 }
    );
  }

  const tournamentIds = Array.from(
    new Set(matches.map((m) => m.tournament_id as string))
  );

  const { data: owned, error: ownErr } = await supabaseAdmin
    .from("tournaments")
    .select("id")
    .in("id", tournamentIds)
    .eq("created_by", userId);
  if (ownErr) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if ((owned?.length ?? 0) !== tournamentIds.length) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Un partido lo anota una sola persona: si ya está en otro link vigente,
  // no se puede repartir de nuevo. La UI lo esconde; esto cierra la carrera
  // entre dos pestañas abiertas.
  const nowIso = new Date().toISOString();
  let overlapQuery = supabaseAdmin
    .from("scorer_links")
    .select("token, match_ids")
    .overlaps("match_ids", matchIds)
    .is("revoked_at", null)
    .gt("expires_at", nowIso);
  if (opts.excludeToken) {
    overlapQuery = overlapQuery.neq("token", opts.excludeToken);
  }
  const { data: overlapping, error: overlapErr } = await overlapQuery;
  if (overlapErr) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (overlapping && overlapping.length > 0) {
    const taken = new Set<string>();
    for (const l of overlapping) {
      for (const id of (l.match_ids as string[]) ?? []) {
        if (matchIds.includes(id)) taken.add(id);
      }
    }
    return NextResponse.json(
      { error: "matches-already-linked", matchIds: Array.from(taken) },
      { status: 409 }
    );
  }

  // expires_at = MAX(date + time) + 24h. Si todos los partidos ya pasaron
  // (carga retroactiva), usamos now() como piso para que el link no arranque
  // expirado y dé 404 al toque.
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
  const expiresAt = new Date(
    Math.max(latestMs, Date.now()) + 24 * 60 * 60 * 1000
  ).toISOString();

  return { tournamentIds, expiresAt };
}
