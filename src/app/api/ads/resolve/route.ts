import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * GET /api/ads/resolve?tournamentId=<uuid>
 *
 * Endpoint público (sin auth) que el modal del espectador hit al cargar un
 * torneo. Resuelve qué anuncio mostrar y devuelve SOLO campos seguros
 * (id, imageUrl, linkUrl) — el precio y el contacto del anunciante nunca
 * salen al cliente. Usa service role porque `ad_campaigns` no tiene lectura
 * pública (mismo patrón que `/api/scorer/*`).
 *
 * El pick es ponderado por `monthly_price` (share of voice proporcional al
 * monto, decisión 2026-07-03). Cada carga/refresh vuelve a pegarle, así que
 * la rotación ocurre naturalmente por request.
 */

interface CampaignRow {
  id: string;
  image_url: string;
  link_url: string | null;
  whatsapp: string | null;
  monthly_price: number;
  target_mode: "rule" | "list";
  target_sports: string[];
  target_statuses: string[];
  target_scopes: string[];
  target_departments: string[];
  target_municipalities: string[];
}

interface TournamentTargeting {
  sport: string | null;
  status: string | null;
  scope: string | null;
  department: string | null;
  municipality: string | null;
}

/** Un criterio de regla pega si está vacío (comodín) o contiene el valor del
 *  torneo. Si el torneo no tiene el dato (ej. nacional sin departamento), un
 *  filtro no vacío NO lo incluye — a propósito. */
function ruleMatches(c: CampaignRow, t: TournamentTargeting): boolean {
  const has = (arr: string[], val: string | null) =>
    arr.length === 0 || (val != null && arr.includes(val));
  return (
    has(c.target_sports, t.sport) &&
    has(c.target_statuses, t.status) &&
    has(c.target_scopes, t.scope) &&
    has(c.target_departments, t.department) &&
    has(c.target_municipalities, t.municipality)
  );
}

/** Pick ponderado: probabilidad de cada campaña = su peso / suma de pesos.
 *  Peso = monthly_price, con piso 1 para que una promo a $0 igual rote. */
function weightedPick(pool: CampaignRow[]): CampaignRow | null {
  if (pool.length === 0) return null;
  const weights = pool.map((c) => Math.max(c.monthly_price, 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export async function GET(request: NextRequest) {
  const tournamentId = request.nextUrl.searchParams.get("tournamentId");
  if (!tournamentId) {
    return NextResponse.json({ error: "missing tournamentId" }, { status: 400 });
  }

  // Atributos del torneo para el targeting.
  const { data: tourn, error: tErr } = await supabaseAdmin
    .from("tournaments")
    .select("sport, status, scope, department, municipality")
    .eq("id", tournamentId)
    .single();

  if (tErr || !tourn) {
    // Torneo inexistente → sin anuncio, no es un error para el cliente.
    return NextResponse.json({ ad: null });
  }

  const nowIso = new Date().toISOString();

  // Campañas prendidas y vigentes + los ids en modo lista que incluyen este
  // torneo. En paralelo.
  const [campaignsRes, listRes] = await Promise.all([
    supabaseAdmin
      .from("ad_campaigns")
      .select(
        "id, image_url, link_url, whatsapp, monthly_price, target_mode, target_sports, target_statuses, target_scopes, target_departments, target_municipalities"
      )
      .eq("is_active", true)
      .lte("starts_at", nowIso)
      .gt("ends_at", nowIso),
    supabaseAdmin
      .from("ad_campaign_tournaments")
      .select("campaign_id")
      .eq("tournament_id", tournamentId),
  ]);

  if (campaignsRes.error) {
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }

  const campaigns = (campaignsRes.data ?? []) as CampaignRow[];
  const listedIds = new Set(
    (listRes.data ?? []).map((r) => r.campaign_id as string)
  );

  const t: TournamentTargeting = {
    sport: tourn.sport ?? null,
    status: tourn.status ?? null,
    scope: tourn.scope ?? null,
    department: tourn.department ?? null,
    municipality: tourn.municipality ?? null,
  };

  const pool = campaigns.filter((c) =>
    c.target_mode === "list" ? listedIds.has(c.id) : ruleMatches(c, t)
  );

  const chosen = weightedPick(pool);
  if (!chosen) return NextResponse.json({ ad: null });

  return NextResponse.json({
    ad: {
      id: chosen.id,
      imageUrl: chosen.image_url,
      linkUrl: chosen.link_url,
      whatsapp: chosen.whatsapp,
    },
  });
}
