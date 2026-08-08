import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { requireUser } from "@/lib/auth/require-user";
import {
  AdSettlement,
  MyEarningsIngredients,
  computeMyAudience,
  currentPeriodMonth,
  toMySettlement,
} from "@/lib/ad-analytics";

/**
 * GET /api/monetizar/earnings?month=2026-08-01
 *
 * Lo que la sección "Monetizar" del organizador puede ver: su audiencia del mes
 * en curso y sus cortes ya cerrados.
 *
 * POR QUÉ ES UNA RUTA DE SERVIDOR Y NO UNA RPC DIRECTA
 *
 * La consulta trae datos que el organizador NO debe ver: la audiencia total de
 * cada campaña y lo que pagó el anunciante. Con eso se deduce el precio del
 * anunciante, y acá los anunciantes son negocios de su misma ciudad. Todo eso
 * llega hasta este archivo y no sigue: hacia afuera van la audiencia del mes y,
 * de los meses ya cerrados, el monto congelado con su tarifa por persona.
 *
 * Por eso `get_my_ad_earnings` está concedida solo a `service_role`, y por eso
 * `ad_settlements` no tiene policy de lectura para el organizador: su
 * `breakdown` guarda el porcentaje. Una sola puerta, y con filtro.
 *
 * Lo que NO pasa por acá: los requisitos para clasificar
 * (`get_monetization_status`). Esa RPC ya está hecha para que el organizador la
 * llame él mismo y no devuelve plata ni datos de nadie más.
 */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const monthParam = request.nextUrl.searchParams.get("month");
  // Se valida la forma antes de mandarla a Postgres: un texto cualquiera haría
  // fallar la función con un error de casteo en vez de un 400 entendible.
  if (monthParam && !/^\d{4}-\d{2}-01$/.test(monthParam)) {
    return NextResponse.json(
      { error: "El mes debe ser el primer día, con formato AAAA-MM-01" },
      { status: 400 }
    );
  }
  const month = monthParam ?? currentPeriodMonth();

  const [earnRes, setRes] = await Promise.all([
    supabaseAdmin.rpc("get_my_ad_earnings", {
      p_user_id: auth.userId,
      p_month: month,
    }),
    // Con service role no corre RLS, así que el filtro por organizador es
    // obligatorio acá. Los anulados quedan fuera: un corte anulado se va a
    // volver a cerrar, y mostrar un monto que ya no vale genera justo la
    // conversación que este diseño trata de evitar.
    supabaseAdmin
      .from("ad_settlements")
      .select("*")
      .eq("organizer_id", auth.userId)
      .neq("status", "void")
      .order("period_month", { ascending: false }),
  ]);

  if (earnRes.error) {
    console.error("get_my_ad_earnings falló", earnRes.error);
    return NextResponse.json(
      { error: "No se pudo calcular tu reparto de este mes." },
      { status: 500 }
    );
  }
  if (setRes.error) {
    console.error("No se pudieron leer los cortes", setRes.error);
    return NextResponse.json(
      { error: "No se pudieron leer tus cortes cerrados." },
      { status: 500 }
    );
  }

  // Del mes en curso sale SOLO audiencia. Lo cobrado y la audiencia total de
  // cada campaña llegan hasta acá y no siguen: con un monto o una tarifa del mes
  // corriente, el organizador tendría un número que se lee como promesa y que
  // además puede bajar. La plata aparece en los cortes ya cerrados.
  const audience = computeMyAudience(earnRes.data as MyEarningsIngredients | null);
  const settlements = ((setRes.data as AdSettlement[]) ?? []).map(toMySettlement);

  // Nombre del anunciante para el histórico: el `breakdown` congelado guarda
  // solo el id de la campaña. Se resuelve acá porque `ad_campaigns` es
  // admin-only en RLS — el organizador no puede leer esa tabla ni para sacar un
  // nombre (ahí viven el precio y el contacto del anunciante).
  const ids = new Set<string>();
  for (const s of settlements) for (const c of s.campaigns) ids.add(c.campaignId);
  const names: Record<string, string> = {};
  if (ids.size > 0) {
    const { data } = await supabaseAdmin
      .from("ad_campaigns")
      .select("id, advertiser_name")
      .in("id", [...ids]);
    for (const row of (data ?? []) as { id: string; advertiser_name: string }[]) {
      names[row.id] = row.advertiser_name;
    }
  }

  return NextResponse.json({ month, audience, settlements, campaignNames: names });
}
