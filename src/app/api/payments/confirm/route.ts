import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { fulfillTournamentPayment, PaymentRecord } from "@/lib/payments/fulfill";

function wompiApiBase(publicKey: string): string {
  return publicKey.startsWith("pub_prod_")
    ? "https://production.wompi.co"
    : "https://sandbox.wompi.co";
}

const STATUS_MAP: Record<string, string> = {
  APPROVED: "approved",
  DECLINED: "declined",
  VOIDED: "voided",
  ERROR: "error",
};

/**
 * Confirms a payment on return from Wompi's hosted checkout.
 * The webhook is the primary path in production, but it never reaches
 * localhost — so when a transactionId is provided we verify directly against
 * the Wompi API and fulfill the tournament. Idempotent via fulfillTournamentPayment.
 */
export async function POST(request: NextRequest) {
  try {
    const { reference, transactionId } = await request.json();
    if (!reference) {
      return NextResponse.json({ error: "Falta reference" }, { status: 400 });
    }

    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("reference", reference)
      .single();

    if (error || !payment) {
      return NextResponse.json({ status: "not_found" }, { status: 404 });
    }

    // Already fulfilled (webhook or a previous confirm created the tournament).
    if (payment.tournament_id) {
      return NextResponse.json({
        status: "approved",
        tournamentId: payment.tournament_id,
      });
    }

    // Terminal non-approved states.
    if (["declined", "voided", "error"].includes(payment.status)) {
      return NextResponse.json({ status: payment.status });
    }

    // Webhook marked it approved but the tournament isn't created yet.
    if (payment.status === "approved") {
      const tournamentId = await fulfillTournamentPayment(
        payment as unknown as PaymentRecord
      );
      return NextResponse.json(
        tournamentId ? { status: "approved", tournamentId } : { status: "pending" }
      );
    }

    // Pending: verify against the Wompi API if we have the transaction id.
    if (transactionId) {
      const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;
      if (!publicKey) return NextResponse.json({ status: "pending" });

      const res = await fetch(
        `${wompiApiBase(publicKey)}/v1/transactions/${transactionId}`,
        { headers: { Authorization: `Bearer ${publicKey}` }, cache: "no-store" }
      );
      if (!res.ok) return NextResponse.json({ status: "pending" });

      const txn = (await res.json())?.data;
      // Must correspond to this payment.
      if (!txn || txn.reference !== payment.reference) {
        return NextResponse.json({ status: "pending" });
      }

      if (txn.status === "APPROVED") {
        // Defense in depth: the charged amount must match what we recorded.
        if (Number(txn.amount_in_cents) !== Number(payment.amount_in_cents)) {
          return NextResponse.json({ status: "pending" });
        }
        await supabaseAdmin
          .from("payments")
          .update({
            status: "approved",
            wompi_transaction_id: txn.id,
            wompi_status: txn.status,
            payment_method: txn.payment_method_type,
          })
          .eq("id", payment.id);

        const tournamentId = await fulfillTournamentPayment(
          payment as unknown as PaymentRecord
        );
        return NextResponse.json(
          tournamentId
            ? { status: "approved", tournamentId }
            : { status: "pending" }
        );
      }

      const mapped = STATUS_MAP[txn.status];
      if (mapped && mapped !== "approved") {
        await supabaseAdmin
          .from("payments")
          .update({
            status: mapped,
            wompi_transaction_id: txn.id,
            wompi_status: txn.status,
          })
          .eq("id", payment.id);
        return NextResponse.json({ status: mapped });
      }
    }

    // Still pending — caller should keep polling (webhook may arrive).
    return NextResponse.json({ status: "pending" });
  } catch (err) {
    console.error("confirm error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
