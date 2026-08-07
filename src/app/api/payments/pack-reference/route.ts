import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-server";
import { requireUser } from "@/lib/auth/require-user";
import { getPack, pricePerCredit } from "@/lib/packs";

/**
 * POST /api/payments/pack-reference   Body: { packId: string }
 *
 * Crea el cobro de un paquete de torneos y devuelve lo necesario para abrir el
 * checkout de Wompi. Al aprobarse, `fulfill.ts` convierte ese pago en créditos
 * (rama `type: "pack"`).
 *
 * DOS DIFERENCIAS CON `create-reference` (el checkout de un torneo suelto), a
 * propósito:
 *
 * 1. **El monto NO viene del cliente.** Se lee del catálogo del servidor. En
 *    `create-reference` el `amountCop` llega en el body, que es aceptable
 *    porque el precio depende del torneo que se está armando; acá hay un
 *    catálogo fijo y no hay razón para confiar en el navegador.
 * 2. **El usuario NO viene del cliente.** Sale del token. Si no, cualquiera
 *    podría crear cobros a nombre de otra cuenta.
 *
 * El pago queda SIN `tournament_id` — un paquete no crea ningún torneo. Eso es
 * justamente lo que Negocios tiene que aprender a contar antes de vender el
 * primero (ver Por hacer/paquetes-de-torneos.md).
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  let body: { packId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pack = getPack(String(body.packId ?? ""));
  if (!pack) {
    return NextResponse.json({ error: "Paquete no válido" }, { status: 400 });
  }

  const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
  if (!integritySecret) {
    console.error("WOMPI_INTEGRITY_SECRET no configurado");
    return NextResponse.json(
      { error: "Configuración de pago incompleta" },
      { status: 500 }
    );
  }

  const shortId = crypto.randomUUID().split("-")[0];
  // Prefijo propio para poder distinguirlo de un torneo suelto en cualquier
  // consulta (`where reference like 'PAQUETE-%'`).
  const reference = `PAQUETE-${shortId}-${Date.now()}`;
  const amountInCents = pack.priceCop * 100;
  const integrity = crypto
    .createHash("sha256")
    .update(`${reference}${amountInCents}COP${integritySecret}`)
    .digest("hex");

  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .insert({
      reference,
      user_id: auth.userId,
      amount_cop: pack.priceCop,
      amount_in_cents: amountInCents,
      status: "pending",
      integrity_signature: integrity,
      // Todo lo que `fulfill.ts` necesita para crear los créditos queda
      // CONGELADO acá. Si mañana cambia la oferta, este pago sigue entregando
      // lo que se compró.
      tournament_data: {
        type: "pack",
        packId: pack.id,
        credits: pack.credits,
        valueCop: pricePerCredit(pack),
        maxTeams: pack.maxTeams,
        months: pack.months,
      },
    })
    .select("id")
    .single();

  if (error || !payment) {
    console.error("No se pudo crear el cobro del paquete:", error);
    return NextResponse.json(
      { error: "No se pudo crear el cobro" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    paymentId: payment.id,
    reference,
    amountInCents,
    integrity,
  });
}
