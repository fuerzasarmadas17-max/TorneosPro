import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { barrerPagosPendientes } from "@/lib/payments/sweep";

/**
 * POST /api/admin/payments/sweep   { diasAtras?: number }
 *
 * Dispara "la escoba" desde el botón de /admin/finances: revisa los pagos en
 * `pending` contra la API de Wompi y resuelve los que ya estaban aprobados.
 *
 * Va por ruta de servidor porque necesita dos cosas que no pueden vivir en el
 * navegador: la llave privada de Wompi y el service role para crear el torneo
 * saltando las policies del organizador.
 *
 * El mismo endpoint sirve para automatizarlo más adelante (un cron de Vercel
 * apuntando acá), sin escribir código nuevo. Hoy el disparador es humano.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const diasAtras =
    typeof body?.diasAtras === "number" && body.diasAtras > 0
      ? Math.min(body.diasAtras, 365)
      : 30;

  try {
    const resultado = await barrerPagosPendientes(diasAtras);
    return NextResponse.json(resultado);
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "Error inesperado";
    console.error("sweep error:", err);
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
