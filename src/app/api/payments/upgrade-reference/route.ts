import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { computeUpgradeQuote } from "@/lib/payments/upgrade";
import crypto from "crypto";

// Authoritative: recomputes the upgrade cost server-side (the client can't set
// the amount) and, when payment is needed, creates the payment record + Wompi
// integrity signature for the hosted-checkout redirect.
export async function POST(request: NextRequest) {
  try {
    const { userId, tournamentId, addCount, groupAssignments } =
      await request.json();
    if (!userId || !tournamentId || !addCount || Number(addCount) < 1) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    const quote = await computeUpgradeQuote(tournamentId, Number(addCount));
    if (!quote) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    // No tier change → no payment; client adds teams for free.
    if (!quote.needsUpgrade) {
      return NextResponse.json({ needsPayment: false });
    }
    // 100% bono → free upgrade; client applies it directly (no redirect).
    if (quote.cobro === 0) {
      return NextResponse.json({ needsPayment: false, freeUpgrade: true });
    }

    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
    if (!integritySecret) {
      console.error("WOMPI_INTEGRITY_SECRET not configured");
      return NextResponse.json(
        { error: "Configuración de pago incompleta" },
        { status: 500 }
      );
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
        user_id: userId,
        amount_cop: quote.cobro,
        amount_in_cents: amountInCents,
        status: "pending",
        integrity_signature: integrity,
        tournament_data: {
          type: "upgrade",
          tournamentId,
          newTier: quote.newTier,
          newPrice: quote.newPrice,
          teamsToAdd: Number(addCount),
          isIndividual: quote.isIndividual,
          currentCount: quote.currentCount,
          groupAssignments: groupAssignments ?? null,
        },
      })
      .select("id")
      .single();

    if (insertError || !payment) {
      console.error("Error creating upgrade payment:", insertError);
      return NextResponse.json(
        { error: "Error al crear registro de pago" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      needsPayment: true,
      reference,
      amountInCents,
      integrity,
    });
  } catch (err) {
    console.error("upgrade-reference error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
