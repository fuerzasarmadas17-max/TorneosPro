import { supabaseAdmin } from "@/lib/supabase-server";
import { fulfillTournamentPayment, PaymentRecord } from "@/lib/payments/fulfill";

/**
 * "La escoba": barre los pagos que quedaron en `pending` y le pregunta a Wompi,
 * uno por uno, si en realidad se aprobaron.
 *
 * Existe porque los otros dos caminos son PASIVOS — esperan que alguien avise:
 *
 *   1. El navegador del cliente al volver del checkout (`/payments/confirm`).
 *   2. El webhook que Wompi le manda al servidor (`/payments/webhook`).
 *
 * Si los dos fallan a la vez, el pago queda huérfano y nadie se entera. Pasó
 * el 2026-08-04: un torneo de $70.000 cobrado sin torneo creado, recuperado a
 * mano contra la base. Esto va y pregunta en vez de esperar.
 *
 * Requiere la LLAVE PRIVADA de Wompi: buscar una transacción por referencia
 * con la llave pública devuelve 401. Con la pública solo se puede consultar
 * por id de transacción, que es justo el dato que falta cuando un pago se
 * pierde.
 */

type WompiTxn = {
  id: string;
  reference: string;
  status: string;
  amount_in_cents: number;
  payment_method_type?: string;
};

const STATUS_MAP: Record<string, string> = {
  APPROVED: "approved",
  DECLINED: "declined",
  VOIDED: "voided",
  ERROR: "error",
};

export interface SweepResult {
  /** Pagos revisados en esta pasada. */
  revisados: number;
  /** Torneos creados a partir de un pago que estaba perdido. */
  torneosCreados: { reference: string; tournamentId: string; montoCop: number }[];
  /** Pagos de publicidad que pasaron a aprobado (NO activan campaña). */
  publicidadAprobada: { reference: string; montoCop: number }[];
  /** Pagos que Wompi reporta como fallidos y dejamos de barrer. */
  descartados: { reference: string; estado: string }[];
  /** Pagos que Wompi todavía no resolvió (siguen pendientes a propósito). */
  sinResolver: number;
  /** Problemas puntuales; no cortan el barrido. */
  errores: string[];
}

function wompiApiBase(privateKey: string): string {
  return privateKey.startsWith("prv_prod_")
    ? "https://production.wompi.co"
    : "https://sandbox.wompi.co";
}

/**
 * Busca en Wompi la transacción de una referencia. Devuelve null si no existe
 * (el caso normal de alguien que abrió el checkout y nunca pagó).
 *
 * Cuando hay varias transacciones para la misma referencia — el cliente
 * reintentó tras un rechazo — nos quedamos con la aprobada. Sin esto, un
 * DECLINED viejo taparía el APPROVED que vino después.
 */
async function buscarTransaccion(
  reference: string,
  privateKey: string
): Promise<WompiTxn | null> {
  const res = await fetch(
    `${wompiApiBase(privateKey)}/v1/transactions?reference=${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${privateKey}` }, cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`Wompi respondió ${res.status} para ${reference}`);
  }
  const body = await res.json();
  const txns = (body?.data ?? []) as WompiTxn[];
  if (txns.length === 0) return null;
  return txns.find((t) => t.status === "APPROVED") ?? txns[0];
}

/**
 * Barre `payments` (torneos) y `ad_payments` (publicidad).
 *
 * Los dos se verifican igual contra Wompi, pero se resuelven distinto:
 *
 * - Torneos: aprobado → se crea el torneo (`fulfillTournamentPayment`).
 * - Publicidad: aprobado → solo se marca el pago. La campaña la activa el
 *   admin a mano desde /admin/ads, igual que hace hoy el webhook. Un pago
 *   recibido no debe prender publicidad solo.
 *
 * `diasAtras` acota la ventana: los pagos viejos abandonados no tienen
 * transacción en Wompi y no hay nada que rescatar en ellos.
 */
export async function barrerPagosPendientes(
  diasAtras = 30
): Promise<SweepResult> {
  const resultado: SweepResult = {
    revisados: 0,
    torneosCreados: [],
    publicidadAprobada: [],
    descartados: [],
    sinResolver: 0,
    errores: [],
  };

  const privateKey = process.env.WOMPI_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "Falta WOMPI_PRIVATE_KEY. Cargala en Vercel (Production) con la llave privada de Wompi (prv_prod_…)."
    );
  }

  const desde = new Date(
    Date.now() - diasAtras * 24 * 60 * 60 * 1000
  ).toISOString();

  // --- Pagos de torneos --------------------------------------------------
  const { data: pagos } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("status", "pending")
    .is("tournament_id", null)
    .gte("created_at", desde)
    .order("created_at", { ascending: false });

  for (const pago of pagos ?? []) {
    resultado.revisados++;
    try {
      const txn = await buscarTransaccion(
        pago.reference as string,
        privateKey
      );
      if (!txn) {
        resultado.sinResolver++;
        continue;
      }

      if (txn.status === "APPROVED") {
        // Misma defensa que en /payments/confirm: el monto cobrado tiene que
        // coincidir con el que registramos, o no lo tocamos.
        if (Number(txn.amount_in_cents) !== Number(pago.amount_in_cents)) {
          resultado.errores.push(
            `${pago.reference}: el monto de Wompi (${txn.amount_in_cents}) no coincide con el nuestro (${pago.amount_in_cents}). Sin tocar.`
          );
          continue;
        }

        await supabaseAdmin
          .from("payments")
          .update({
            status: "approved",
            wompi_transaction_id: txn.id,
            wompi_status: txn.status,
            payment_method: txn.payment_method_type,
          })
          .eq("id", pago.id);

        const tournamentId = await fulfillTournamentPayment(
          pago as unknown as PaymentRecord
        );
        if (tournamentId) {
          resultado.torneosCreados.push({
            reference: pago.reference as string,
            tournamentId,
            montoCop: pago.amount_cop as number,
          });
        } else {
          resultado.errores.push(
            `${pago.reference}: aprobado en Wompi pero no se pudo crear el torneo.`
          );
        }
        continue;
      }

      const mapeado = STATUS_MAP[txn.status];
      if (mapeado && mapeado !== "approved") {
        await supabaseAdmin
          .from("payments")
          .update({
            status: mapeado,
            wompi_transaction_id: txn.id,
            wompi_status: txn.status,
          })
          .eq("id", pago.id);
        resultado.descartados.push({
          reference: pago.reference as string,
          estado: txn.status,
        });
        continue;
      }

      // PENDING u otro estado no terminal: dejamos el rastro y lo volvemos a
      // mirar en la próxima pasada.
      await supabaseAdmin
        .from("payments")
        .update({
          wompi_transaction_id: txn.id,
          wompi_status: txn.status,
          payment_method: txn.payment_method_type,
        })
        .eq("id", pago.id);
      resultado.sinResolver++;
    } catch (err) {
      resultado.errores.push(
        `${pago.reference}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // --- Pagos de publicidad ----------------------------------------------
  const { data: pagosPub } = await supabaseAdmin
    .from("ad_payments")
    .select("*")
    .eq("status", "pending")
    .gte("created_at", desde)
    .order("created_at", { ascending: false });

  for (const pago of pagosPub ?? []) {
    resultado.revisados++;
    try {
      const txn = await buscarTransaccion(
        pago.reference as string,
        privateKey
      );
      if (!txn) {
        resultado.sinResolver++;
        continue;
      }

      const mapeado = STATUS_MAP[txn.status];
      if (!mapeado) {
        resultado.sinResolver++;
        continue;
      }

      await supabaseAdmin
        .from("ad_payments")
        .update({
          status: mapeado,
          wompi_transaction_id: txn.id,
          wompi_status: txn.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pago.id);

      if (mapeado === "approved") {
        // Ojo: solo se marca el pago. Prender la campaña sigue siendo un acto
        // manual del admin en /admin/ads.
        resultado.publicidadAprobada.push({
          reference: pago.reference as string,
          montoCop: pago.amount_cop as number,
        });
      } else {
        resultado.descartados.push({
          reference: pago.reference as string,
          estado: txn.status,
        });
      }
    } catch (err) {
      resultado.errores.push(
        `${pago.reference}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return resultado;
}
