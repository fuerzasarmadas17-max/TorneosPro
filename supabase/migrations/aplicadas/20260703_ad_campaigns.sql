-- Modal de publicidad configurable — Pieza 2 de
-- `Por hacer/modal-publicidad-y-tienda.md`.
--
-- Este NO es `sponsors` (esos son los 6 espacios que controla el organizador).
-- El modal es un inventario 100% nuestro: anunciantes externos que pagan un
-- mensual, administrados a mano por el super admin. El espectador anónimo ve
-- un modal (cerrable a los 2s) que rota entre las campañas activas cuyo
-- targeting le pega al torneo que está viendo.
--
-- Conteo: reutiliza `analytics_events` (event_type 'ad_impression' /
-- 'ad_click', target_id = campaign.id). No hay tabla de métricas aquí.
--
-- Seguridad: las campañas guardan datos sensibles (precio, contacto del
-- anunciante), así que NO se exponen con lectura pública. El modal del
-- espectador resuelve qué anuncio mostrar vía un endpoint con service role
-- (`/api/ads/resolve`), igual que el patrón de `scorer_links`. Solo el admin
-- gestiona las campañas directamente (RLS), como en `coupons`.

-- ============================================================
-- 1. Campañas
-- ============================================================

CREATE TABLE ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_name TEXT NOT NULL,
  -- Contacto para renovar (WhatsApp / IG / web). Sensible → no público.
  contact TEXT,
  image_url TEXT NOT NULL,           -- pieza que se muestra en el modal
  link_url TEXT NOT NULL,            -- destino del clic
  is_active BOOLEAN NOT NULL DEFAULT true,  -- prender/apagar sin borrar
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,      -- fin de la vigencia pagada
  -- Precio mensual en COP. Además de registro, ES EL PESO de rotación:
  -- share of voice proporcional al monto (decisión 2026-07-03). El resolver
  -- usa GREATEST(monthly_price, 1) para que una promo a $0 igual aparezca,
  -- pero sin opacar a los que pagan.
  monthly_price INT NOT NULL DEFAULT 0,

  -- ---- TARGETING ----
  -- 'rule' = filtros dinámicos (torneos futuros que cumplan entran solos).
  -- 'list' = torneos elegidos a mano (ver ad_campaign_tournaments).
  target_mode TEXT NOT NULL DEFAULT 'rule'
    CHECK (target_mode IN ('rule', 'list')),
  -- En modo 'rule'. Arreglo vacío = no filtra por ese criterio (comodín).
  -- Todos son TEXT[] (no los tipos enum `sport`/`tournament_status`) a
  -- propósito: el esquema base de `tournaments` vive fuera de estas migraciones
  -- y no podemos garantizar que esos tipos enum existan al aplicar esto. El
  -- resolver compara por string de todas formas, y la validación de valores
  -- válidos la hace el panel admin (solo ofrece las opciones correctas).
  target_sports        TEXT[]  NOT NULL DEFAULT '{}',
  target_statuses      TEXT[]  NOT NULL DEFAULT '{}',
  target_scopes        TEXT[]  NOT NULL DEFAULT '{}',  -- nacional/departamental/municipal
  target_departments   TEXT[]  NOT NULL DEFAULT '{}',
  target_municipalities TEXT[] NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ad_campaigns_vigencia CHECK (ends_at > starts_at)
);

-- Búsqueda del pool: campañas prendidas y vigentes.
CREATE INDEX idx_ad_campaigns_active
  ON ad_campaigns (ends_at)
  WHERE is_active;

-- ============================================================
-- 2. Modo lista: torneos elegidos a mano
-- ============================================================

CREATE TABLE ad_campaign_tournaments (
  campaign_id   UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES tournaments(id)  ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, tournament_id)
);

-- El resolver, dado un torneo, busca qué campañas en modo lista lo incluyen.
CREATE INDEX idx_ad_campaign_tournaments_tournament
  ON ad_campaign_tournaments (tournament_id);

-- ============================================================
-- 3. RLS — solo el admin gestiona; el espectador va por service role
-- ============================================================

ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_campaign_tournaments ENABLE ROW LEVEL SECURITY;

-- Sin policy pública a propósito: precio y contacto no se filtran al cliente
-- anónimo. La resolución del modal usa service role en `/api/ads/resolve`.
CREATE POLICY "Admin gestiona ad_campaigns"
  ON ad_campaigns FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin gestiona ad_campaign_tournaments"
  ON ad_campaign_tournaments FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Comentarios para el dashboard de Supabase.
COMMENT ON TABLE ad_campaigns IS
  'Campañas del modal de publicidad (Pieza 2). Inventario nuestro, no del organizador. Ver Por hacer/modal-publicidad-y-tienda.md.';
COMMENT ON COLUMN ad_campaigns.monthly_price IS
  'COP/mes. También es el peso de rotación (share of voice proporcional al monto).';
COMMENT ON COLUMN ad_campaigns.target_mode IS
  'rule = filtros dinámicos (deporte/estado/geo); list = torneos a mano en ad_campaign_tournaments.';

-- ============================================================
-- 4. Storage: permitir el prefijo `ads/` para las piezas del modal
-- ============================================================
-- La policy `Usuarios suben imagenes` whitelistea logos/sponsors/champions.
-- El uploader de campañas escribe en `ads/<rand>.<ext>`, así que la
-- extendemos (drop & recreate, igual que en 20260607_storage_champions_prefix).

DROP POLICY IF EXISTS "Usuarios suben imagenes" ON storage.objects;

CREATE POLICY "Usuarios suben imagenes"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'images'
    AND auth.role() = 'authenticated'
    AND storage.extension(name) = ANY (
      ARRAY['jpg', 'jpeg', 'png', 'webp', 'gif']
    )
    AND (
      name LIKE 'logos/%'
      OR name LIKE 'sponsors/%'
      OR name LIKE 'champions/%'
      OR name LIKE 'ads/%'
    )
  );
