import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  EN_VIVO_VENCE_MS,
  limpiarFoto,
  type PartidoEnVivoDato,
} from "@/lib/volley/en-vivo";

/**
 * GET /api/tournaments/[id]/en-vivo
 *
 * Los partidos de este torneo que se están jugando ahora con la planilla: los
 * que mandaron una foto en los últimos 5 minutos. Es el "papelito" del
 * documento: unos cientos de bytes, nada más.
 *
 * UNA SOLA COPIA PARA TODOS. La respuesta es la misma para cualquiera que
 * pregunte, así que se guarda en la red de Vercel 30 segundos y se le da esa
 * misma copia a todos (`s-maxage`). Así la base se consulta ~2 veces por minuto
 * por torneo, miren 10 personas o 10.000.
 *
 * NO CUENTA COMO VISITA. La analítica cuenta páginas, no pedidos: este refresco
 * no pasa por ella y no descuadra el reparto de publicidad.
 *
 * Ver `Por hacer/deportes/voley/PLANILLA-EN-VIVO-PUBLICO.md`, secciones 3 y 5.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CACHE = "public, s-maxage=30, stale-while-revalidate=30";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ partidos: [] }, { status: 400 });
  }

  const desde = new Date(Date.now() - EN_VIVO_VENCE_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("match_live_scores")
    .select("match_id, state, updated_at")
    .eq("tournament_id", id)
    .gte("updated_at", desde)
    .order("updated_at", { ascending: false })
    // Un torneo no juega 50 partidos a la vez; el tope es por la regla de no
    // pedir nunca "todo".
    .limit(50);

  // Si falla (por ejemplo, la tabla todavía no existe), la página queda como
  // siempre: sin en vivo. La respuesta vacía también va a la copia compartida:
  // si no, cada persona mirando consultaría la base cada 30 segundos mientras
  // dure la falla, que es justo lo que la copia evita.
  if (error) {
    return NextResponse.json({ partidos: [] }, { headers: { "Cache-Control": CACHE } });
  }

  const partidos: PartidoEnVivoDato[] = [];
  for (const row of data ?? []) {
    const foto = limpiarFoto(row.state);
    if (!foto) continue;
    partidos.push({ matchId: row.match_id, foto, actualizadoEn: row.updated_at });
  }

  return NextResponse.json({ partidos }, { headers: { "Cache-Control": CACHE } });
}
