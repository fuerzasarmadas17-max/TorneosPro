import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { fulfillTournamentPayment, PaymentRecord } from "@/lib/payments/fulfill";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Verify checksum
    const eventSecret = process.env.WOMPI_EVENT_SECRET;
    if (!eventSecret) {
      console.error("WOMPI_EVENT_SECRET not configured");
      return NextResponse.json({ error: "Config error" }, { status: 500 });
    }

    const properties = body.signature?.properties as string[] | undefined;
    const checksum = body.signature?.checksum as string | undefined;
    const transaction = body.data?.transaction;

    if (!properties || !checksum || !transaction) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Build string from properties, append timestamp + secret
    const propertyValues = properties.map((prop) => {
      const parts = prop.split(".");
      let value: unknown = body.data;
      for (const part of parts) {
        value = (value as Record<string, unknown>)?.[part];
      }
      return String(value ?? "");
    });

    const checksumInput =
      propertyValues.join("") + String(body.timestamp) + eventSecret;
    const computedChecksum = crypto
      .createHash("sha256")
      .update(checksumInput)
      .digest("hex");

    if (computedChecksum !== checksum) {
      console.error("Webhook checksum mismatch");
      return NextResponse.json({ error: "Invalid checksum" }, { status: 401 });
    }

    const statusMap: Record<string, string> = {
      APPROVED: "approved",
      DECLINED: "declined",
      VOIDED: "voided",
      ERROR: "error",
    };

    // Pagos de PUBLICIDAD (referencia PUB-...): viven en `ad_payments`, no en
    // `payments`. Wompi manda todos los eventos a esta única URL, así que los
    // atendemos acá mismo. Solo marcamos el estado; la activación de la campaña
    // sigue siendo manual (el admin prende el switch al ver "pagado").
    const reference = String(transaction.reference ?? "");
    if (reference.startsWith("PUB-")) {
      const { data: adPay } = await supabaseAdmin
        .from("ad_payments")
        .select("id")
        .eq("reference", reference)
        .maybeSingle();
      if (!adPay) {
        return NextResponse.json({ error: "Ad payment not found" }, { status: 404 });
      }
      await supabaseAdmin
        .from("ad_payments")
        .update({
          status: statusMap[transaction.status] || "error",
          wompi_transaction_id: transaction.id,
          wompi_status: transaction.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", adPay.id);
      return NextResponse.json({ ok: true });
    }

    // 2. Find payment by reference
    const { data: payment, error: fetchError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("reference", transaction.reference)
      .single();

    if (fetchError || !payment) {
      console.error("Payment not found for reference:", transaction.reference);
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // 3. Map Wompi status to our enum
    const newStatus = statusMap[transaction.status] || "error";

    // 4. Update payment record
    await supabaseAdmin
      .from("payments")
      .update({
        status: newStatus,
        wompi_transaction_id: transaction.id,
        wompi_status: transaction.status,
        payment_method: transaction.payment_method_type,
      })
      .eq("id", payment.id);

    // 5. If APPROVED, create/upgrade the tournament server-side (idempotent).
    if (newStatus === "approved") {
      await fulfillTournamentPayment(payment as unknown as PaymentRecord);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
