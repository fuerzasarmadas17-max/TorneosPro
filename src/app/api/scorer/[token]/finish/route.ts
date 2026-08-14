import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { checkRateLimit, getClientIp } from "@/lib/scorer/rate-limit";

/**
 * POST /api/scorer/[token]/finish
 *
 * El propio anotador cierra su link cuando terminó de cargar ("Terminé mi
 * labor"). Es el mismo efecto que revocar desde el dashboard —marcar
 * `revoked_at`— pero sin auth de organizador: quien tiene el token ya tiene
 * permiso de escribir en esos partidos, así que cerrarse a sí mismo no le da
 * ningún poder nuevo. Sólo se quita acceso.
 *
 * Los resultados ya cargados no se tocan: viven en `matches`, no en el link.
 *
 * Idempotente: cerrar uno ya cerrado (o ya expirado) responde 200.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const ip = getClientIp(request);
  const limit = checkRateLimit(`scorer-finish:${ip}:${token}`, 10);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate-limit", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429 }
    );
  }

  // No usamos validateScorerToken acá: ese devuelve null para revocado y para
  // inexistente por igual, y necesitamos distinguirlos para ser idempotentes.
  const { data: link, error: fetchErr } = await supabaseAdmin
    .from("scorer_links")
    .select("token, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (fetchErr) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (!link) {
    return NextResponse.json({ error: "link-not-found" }, { status: 404 });
  }
  if (link.revoked_at) {
    return NextResponse.json({ ok: true, alreadyFinished: true });
  }

  const { error: updErr } = await supabaseAdmin
    .from("scorer_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token", token);
  if (updErr) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
