import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, amountCop, couponId, tournamentData } = body;

    if (!userId || !amountCop || !tournamentData) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    if (amountCop <= 0) {
      return NextResponse.json(
        { error: "El monto debe ser mayor a 0" },
        { status: 400 }
      );
    }

    // Generate unique reference
    const shortId = crypto.randomUUID().split("-")[0];
    const timestamp = Date.now();
    const reference = `TORNEO-${shortId}-${timestamp}`;

    // Amount in cents (Wompi requires cents)
    const amountInCents = amountCop * 100;

    // Generate integrity signature: SHA256(reference + amountInCents + "COP" + secret)
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
    if (!integritySecret) {
      console.error("WOMPI_INTEGRITY_SECRET not configured");
      return NextResponse.json(
        { error: "Configuración de pago incompleta" },
        { status: 500 }
      );
    }

    const signatureInput = `${reference}${amountInCents}COP${integritySecret}`;
    const integrity = crypto
      .createHash("sha256")
      .update(signatureInput)
      .digest("hex");

    // Insert payment record
    const { data: payment, error: insertError } = await supabaseAdmin
      .from("payments")
      .insert({
        reference,
        user_id: userId,
        coupon_id: couponId || null,
        amount_cop: amountCop,
        amount_in_cents: amountInCents,
        status: "pending",
        integrity_signature: integrity,
        tournament_data: tournamentData,
      })
      .select("id")
      .single();

    if (insertError || !payment) {
      console.error("Error creating payment:", insertError);
      return NextResponse.json(
        { error: "Error al crear registro de pago" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      paymentId: payment.id,
      reference,
      amountInCents,
      integrity,
    });
  } catch (err) {
    console.error("Unexpected error in create-reference:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
