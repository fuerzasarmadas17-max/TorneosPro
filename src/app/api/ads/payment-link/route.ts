import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/admin/require-admin";

/**
 * POST /api/ads/payment-link
 * Body: { campaignId: string }
 *
 * Genera un link de pago de Wompi para una campaña de publicidad, usando su
 * `monthly_price` como monto. Solo admin (Bearer token). Devuelve la URL de una
 * página propia (`/pagar/publicidad/<id>`) que el admin le manda al anunciante;
 * esa página rebota a Wompi con el form (un link directo a Wompi lo bloquea el
 * WAF). El pago se registra en `ad_payments`; la activación de la campaña es
 * manual por ahora.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  let body: { campaignId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const campaignId = body.campaignId;
  if (!campaignId) {
    return NextResponse.json({ error: "Falta campaignId" }, { status: 400 });
  }

  const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
  if (!integritySecret) {
    return NextResponse.json(
      { error: "Configuración de pago incompleta" },
      { status: 500 }
    );
  }

  // Monto = precio de la campaña (leído server-side, no del cliente).
  const { data: campaign, error: campErr } = await supabaseAdmin
    .from("ad_campaigns")
    .select("id, advertiser_name, monthly_price")
    .eq("id", campaignId)
    .single();
  if (campErr || !campaign) {
    return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
  }

  const amountCop = campaign.monthly_price ?? 0;
  if (amountCop <= 0) {
    return NextResponse.json(
      { error: "Define el precio de la campaña antes de generar el link de pago" },
      { status: 400 }
    );
  }

  const shortId = crypto.randomUUID().split("-")[0];
  const reference = `PUB-${shortId}-${Date.now()}`;
  const amountInCents = amountCop * 100;
  const integrity = crypto
    .createHash("sha256")
    .update(`${reference}${amountInCents}COP${integritySecret}`)
    .digest("hex");

  // Un solo link activo por campaña: cancelamos los pendientes anteriores para
  // que nadie pague un precio viejo. Los pagos ya aprobados NO se tocan — quedan
  // como historial (útil para renovaciones y contabilidad).
  await supabaseAdmin
    .from("ad_payments")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("campaign_id", campaign.id)
    .eq("status", "pending");

  const { data: payment, error: insErr } = await supabaseAdmin
    .from("ad_payments")
    .insert({
      campaign_id: campaign.id,
      reference,
      amount_cop: amountCop,
      amount_in_cents: amountInCents,
      integrity_signature: integrity,
      status: "pending",
    })
    .select("id")
    .single();
  if (insErr || !payment) {
    return NextResponse.json({ error: "No se pudo crear el pago" }, { status: 500 });
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
    new URL(request.url).origin;

  return NextResponse.json({
    url: `${appUrl}/pagar/publicidad/${payment.id}`,
    amountCop,
    advertiser: campaign.advertiser_name,
  });
}
