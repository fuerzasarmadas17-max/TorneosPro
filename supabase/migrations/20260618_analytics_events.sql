-- Eventos de analítica (interacciones, no solo page views).
--
-- A diferencia de `page_views` (que registra visitas), esta tabla registra
-- ACCIONES: clic en patrocinador, impresión de patrocinador, clic en CTA,
-- etc. Es flexible a propósito (event_type + metadata jsonb) para que cada
-- nuevo tipo de evento NO requiera otra migración.
--
-- Primer uso: `sponsor_click` — cuántas personas tocan cada patrocinador
-- dentro de un torneo. Habilita el reporte que el organizador le entrega a
-- su comercio y, agregado, le dice al super admin qué torneos son
-- monetizables.
--
-- Seguridad: cualquiera (anónimo o no) puede INSERTAR (el espectador no
-- tiene sesión). La LECTURA está restringida al dueño del torneo / de la
-- organización, y a los admins — igual que page_views.

CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Tipo de evento: 'sponsor_click', 'sponsor_impression', 'cta_click', ...
  event_type TEXT NOT NULL,
  -- Torneo donde ocurrió (null para eventos a nivel organización/landing).
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  -- Objetivo del evento: id del patrocinador, del equipo, etc. TEXT por
  -- flexibilidad (distintos tipos de target).
  target_id TEXT,
  -- Para eventos a nivel organización/landing cuando no hay torneo.
  entity_type TEXT,            -- 'tournament' | 'organization' | null
  entity_id UUID,              -- user_id del organizador (eventos de org)
  session_id UUID NOT NULL,
  device_type TEXT,            -- 'mobile' | 'tablet' | 'desktop'
  metadata JSONB,              -- extra (ej: { linkUrl, imageUrl })
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_analytics_events_tournament
  ON analytics_events (tournament_id, event_type, created_at);
CREATE INDEX idx_analytics_events_type
  ON analytics_events (event_type, created_at);
CREATE INDEX idx_analytics_events_target
  ON analytics_events (tournament_id, target_id, event_type);
CREATE INDEX idx_analytics_events_entity
  ON analytics_events (entity_type, entity_id, created_at);
CREATE INDEX idx_analytics_events_session
  ON analytics_events (session_id, created_at);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede registrar un evento (el espectador es anónimo).
CREATE POLICY "Anyone can insert analytics events"
  ON analytics_events FOR INSERT
  WITH CHECK (true);

-- Solo el dueño del torneo / organización, o un admin, pueden leer.
CREATE POLICY "Owners and admins read analytics events"
  ON analytics_events FOR SELECT
  USING (
    (tournament_id IN (
      SELECT id FROM tournaments WHERE created_by = auth.uid()
    ))
    OR (entity_type = 'organization' AND entity_id = auth.uid())
    OR (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  );
