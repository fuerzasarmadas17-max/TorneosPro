import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-server";
import { requireTournamentOwner } from "@/lib/scorer/auth";
import { computeCupsQuote, markCupsSurchargePaid } from "@/lib/payments/cups";

/**
 * Prender las copas: cobra el recargo si hace falta.
 *
 * - Ya pagado → no cobra; el navegador guarda las copas.
 * - Bono del 100% → no cobra, pero lo deja pagado y sube el precio del torneo
 *   (lo mismo que una ampliación con bono del 100%); el navegador guarda las
 *   copas.
 * - Si no → crea el pago en Wompi con las copas adentro. Cuando se aprueba,
 *   `fulfill.ts` deja el recargo pagado y crea las copas.
 *
 * El monto se calcula acá; el navegador no lo puede tocar.
 */
export async function POST(request: NextRequest) {
  try {
    const { tournamentId, cups } = await request.json();
    if (!tournamentId || !Array.isArray(cups) || cups.length < 2) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }
    const owner = await requireTournamentOwner(request, tournamentId);
    if (owner instanceof NextResponse) return owner;

    const quote = await computeCupsQuote(tournamentId);
    if (!quote) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }
    if (quote.alreadyPaid) {
      return NextResponse.json({ needsPayment: false });
    }
    if (quote.cobro === 0) {
      const ok = await markCupsSurchargePaid(tournamentId, quote.listSurcharge);
      if (!ok) {
        return NextResponse.json({ error: "No se pudo registrar el recargo" }, { status: 500 });
      }
      return NextResponse.json({ needsPayment: false });
    }

    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
    if (!integritySecret) {
      console.error("WOMPI_INTEGRITY_SECRET not configured");
      return NextResponse.json({ error: "Configuración de pago incompleta" }, { status: 500 });
    }

    const shortId = crypto.randomUUID().split("-")[0];
    const reference = `TORNEO-${shortId}-${Date.now()}`;
    const amountInCents = quote.cobro * 100;
    const integrity = crypto
      .createHash("sha256")
      .update(`${reference}${amountInCents}COP${integritySecret}`)
      .digest("hex");

    const { data: payment, error: insertError } = await supabaseAdmin
      .from("payments")
      .insert({
        reference,
        user_id: owner.userId,
        amount_cop: quote.cobro,
        amount_in_cents: amountInCents,
        status: "pending",
        integrity_signature: integrity,
        tournament_data: {
          type: "cups",
          tournamentId,
          listSurcharge: quote.listSurcharge,
          cups: cups.map((c: Record<string, unknown>, i: number) => ({
            name: String(c.name ?? "").trim(),
            sortOrder: i + 1,
            positionFrom: Number(c.positionFrom),
            positionTo: Number(c.positionTo),
          })),
        },
      })
      .select("id")
      .single();

    if (insertError || !payment) {
      console.error("Error creating cups payment:", insertError);
      return NextResponse.json({ error: "Error al crear registro de pago" }, { status: 500 });
    }

    return NextResponse.json({ needsPayment: true, reference, amountInCents, integrity });
  } catch (err) {
    console.error("cups-reference error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
