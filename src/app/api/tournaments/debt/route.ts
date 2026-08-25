import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { requireUser } from "@/lib/auth/require-user";

/**
 * POST /api/tournaments/debt  { tournamentId }
 *
 * Marca un torneo recién creado como fiado: deja la fila en `tournament_debts`
 * para que lo que el organizador gane de publicidad le vaya abonando el precio
 * del torneo. Ver `Por hacer/como-funciona-monetizar.md`.
 *
 * POR QUÉ ES UNA RUTA DE SERVIDOR
 * `tournament_debts` sólo la escribe un admin, y el torneo lo crea el
 * organizador. Si el navegador pudiera insertar ahí, también podría borrar su
 * propia deuda — es el mismo motivo por el que la marca no vive como columna
 * de `tournaments`, que el dueño sí puede editar.
 *
 * QUÉ VALIDA ANTES DE ESCRIBIR
 * El cliente manda un id de torneo y nada más. Todo lo demás se vuelve a leer
 * acá con el service role:
 *
 *   1. Que el que llama sea el dueño del torneo (o un admin).
 *   2. Que el torneo tenga de verdad un cupón que lo dejó en $0. Sin esto,
 *      cualquiera podría marcar como fiado un torneo que pagó, y quedaría
 *      debiendo plata que ya entregó.
 *   3. Que el torneo tenga precio de lista cargado, que es lo que va a deber.
 *
 * REGLA (decisión del 2026-08-25)
 * Todo torneo creado con bono del 100% de acá en adelante genera deuda. No se
 * distingue regalo de fiado: los 15 regalos que había antes de esa fecha
 * quedaron como estaban y no se tocan.
 *
 * SI ESTA LLAMADA FALLA, LA DEUDA NO SE CREA Y NADIE SE ENTERA.
 * Por eso `Por hacer/consultas/deudas-de-torneos-fiados.sql` marca los torneos
 * con bono del 100% creados desde el 2026-08-25 que no tengan su fila acá. Esa
 * consulta es la red que caza el fallo silencioso.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  let tournamentId: string | undefined;
  try {
    ({ tournamentId } = await request.json());
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  if (!tournamentId) {
    return NextResponse.json({ error: "Falta tournamentId" }, { status: 400 });
  }

  const { data: tournament, error: tErr } = await supabaseAdmin
    .from("tournaments")
    .select("id, price, created_by, coupon_id")
    .eq("id", tournamentId)
    .single();

  if (tErr || !tournament) {
    return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
  }

  if (tournament.created_by !== auth.userId) {
    const { data: caller } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", auth.userId)
      .single();
    if (caller?.role !== "admin") {
      return NextResponse.json({ error: "No es tu torneo" }, { status: 403 });
    }
  }

  if (!tournament.coupon_id) {
    return NextResponse.json(
      { error: "El torneo no se creó con un cupón." },
      { status: 400 }
    );
  }

  const { data: coupon } = await supabaseAdmin
    .from("coupons")
    .select("type, value")
    .eq("id", tournament.coupon_id)
    .single();

  // Los dos cupones que dejan el torneo en $0. Un descuento parcial NO genera
  // deuda: ese organizador pagó lo que se le pidió.
  const dejaEnCero =
    coupon?.type === "free_tournament" ||
    (coupon?.type === "percentage" && (coupon?.value ?? 0) >= 100);

  if (!dejaEnCero) {
    return NextResponse.json(
      { error: "El cupón del torneo no lo deja en $0." },
      { status: 400 }
    );
  }

  if (!tournament.price || tournament.price <= 0) {
    return NextResponse.json(
      { error: "El torneo no tiene precio de lista: no se sabe cuánto debería." },
      { status: 400 }
    );
  }

  // `onConflict` sin `ignoreDuplicates: false` deja esto idempotente: si el
  // cliente reintenta, no se duplica ni devuelve error.
  const { error: insErr } = await supabaseAdmin
    .from("tournament_debts")
    .upsert(
      {
        tournament_id: tournament.id,
        organizer_id: tournament.created_by,
        note: "Creado con bono del 100%.",
        created_by: auth.userId,
      },
      { onConflict: "tournament_id", ignoreDuplicates: true }
    );

  if (insErr) {
    console.error("No se pudo crear la deuda del torneo", insErr);
    return NextResponse.json(
      { error: "No se pudo registrar la deuda." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, balanceCop: tournament.price });
}
