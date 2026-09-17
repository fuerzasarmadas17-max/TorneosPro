-- ============================================================================
-- Analytics: visitor_id permanente + métricas de personas reales
-- ----------------------------------------------------------------------------
-- El `session_id` caduca a los 30 min de inactividad, así que un jugador que
-- vuelve varias veces en la semana se contaba como varios "únicos". Agregamos
-- un `visitor_id` PERMANENTE (nunca caduca) para contar personas reales
-- distintas y separar nuevos de recurrentes.
--
-- Enriquece get_entity_analytics / get_organizer_tournament_views /
-- get_global_analytics con: unique_persons, new_visitors, returning_visitors.
-- ============================================================================

ALTER TABLE page_views ADD COLUMN IF NOT EXISTS visitor_id UUID;

CREATE INDEX IF NOT EXISTS idx_page_views_visitor
  ON page_views (entity_type, entity_id, visitor_id, created_at);

-- ----------------------------------------------------------------------------
-- RPC: analytics de una entidad (organizador) — ahora con personas reales
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_entity_analytics(
  p_entity_type text,
  p_entity_id uuid,
  p_days integer DEFAULT 30
)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_views', COUNT(*),
    'unique_visitors', COUNT(DISTINCT session_id),
    'unique_persons', COUNT(DISTINCT visitor_id),
    'avg_duration_ms', COALESCE(AVG(NULLIF(duration_ms, 0))::integer, 0),
    -- Personas cuya PRIMERA visita (histórica) a esta entidad cae dentro de la
    -- ventana: son nuevas.
    'new_visitors', (
      SELECT COUNT(*) FROM (
        SELECT visitor_id
        FROM page_views
        WHERE entity_type = p_entity_type AND entity_id = p_entity_id
          AND visitor_id IS NOT NULL
        GROUP BY visitor_id
        HAVING MIN(created_at) >= NOW() - (p_days || ' days')::interval
      ) nv
    ),
    -- Personas que ya habían visitado antes de la ventana y volvieron dentro.
    'returning_visitors', (
      SELECT COUNT(*) FROM (
        SELECT visitor_id
        FROM page_views
        WHERE entity_type = p_entity_type AND entity_id = p_entity_id
          AND visitor_id IS NOT NULL
        GROUP BY visitor_id
        HAVING MIN(created_at) < NOW() - (p_days || ' days')::interval
           AND MAX(created_at) >= NOW() - (p_days || ' days')::interval
      ) rv
    ),
    'views_by_day', (
      SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json)
      FROM (
        SELECT created_at::date AS date, COUNT(*) AS views,
               COUNT(DISTINCT session_id) AS unique_visitors,
               COUNT(DISTINCT visitor_id) AS unique_persons
        FROM page_views
        WHERE entity_type = p_entity_type AND entity_id = p_entity_id
          AND created_at >= NOW() - (p_days || ' days')::interval
        GROUP BY created_at::date ORDER BY date
      ) d
    ),
    'top_referrers', (
      SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
      FROM (
        SELECT referrer, COUNT(*) AS count
        FROM page_views
        WHERE entity_type = p_entity_type AND entity_id = p_entity_id
          AND created_at >= NOW() - (p_days || ' days')::interval
          AND referrer IS NOT NULL AND referrer != ''
        GROUP BY referrer ORDER BY count DESC LIMIT 10
      ) r
    ),
    -- Visitas sin referrer conocido (acceso directo o navegación interna).
    'direct_views', (
      SELECT COUNT(*)
      FROM page_views
      WHERE entity_type = p_entity_type AND entity_id = p_entity_id
        AND created_at >= NOW() - (p_days || ' days')::interval
        AND (referrer IS NULL OR referrer = '')
    ),
    'device_breakdown', (
      SELECT COALESCE(json_agg(row_to_json(dev)), '[]'::json)
      FROM (
        SELECT device_type, COUNT(*) AS count
        FROM page_views
        WHERE entity_type = p_entity_type AND entity_id = p_entity_id
          AND created_at >= NOW() - (p_days || ' days')::interval
        GROUP BY device_type
      ) dev
    ),
    'browser_breakdown', (
      SELECT COALESCE(json_agg(row_to_json(br)), '[]'::json)
      FROM (
        SELECT browser, COUNT(*) AS count
        FROM page_views
        WHERE entity_type = p_entity_type AND entity_id = p_entity_id
          AND created_at >= NOW() - (p_days || ' days')::interval
        GROUP BY browser ORDER BY count DESC LIMIT 10
      ) br
    )
  )
  FROM page_views
  WHERE entity_type = p_entity_type AND entity_id = p_entity_id
    AND created_at >= NOW() - (p_days || ' days')::interval;
$$;

-- ----------------------------------------------------------------------------
-- RPC: views por torneo de un organizador — ahora con personas reales
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_organizer_tournament_views(p_user_id uuid, p_days integer DEFAULT 30)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(row_to_json(tv)), '[]'::json)
  FROM (
    SELECT pv.entity_id AS tournament_id,
           COUNT(*) AS views,
           COUNT(DISTINCT pv.session_id) AS unique_visitors,
           COUNT(DISTINCT pv.visitor_id) AS unique_persons
    FROM page_views pv
    INNER JOIN tournaments t ON t.id = pv.entity_id
    WHERE pv.entity_type = 'tournament' AND t.created_by = p_user_id
      AND pv.created_at >= NOW() - (p_days || ' days')::interval
    GROUP BY pv.entity_id
  ) tv;
$$;

-- ----------------------------------------------------------------------------
-- RPC: analytics AGREGADAS del organizador (perfil público + todos sus torneos)
-- Alimenta el resumen del dashboard: personas, sesiones, visitas, tiempo y la
-- tendencia diaria, todo sumado y deduplicado entre perfil y torneos.
-- Usa auth.uid() como scope => cada quien ve SOLO lo suyo (seguro por diseño).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_organizer_analytics(p_days integer DEFAULT 30)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scoped AS (
    SELECT pv.*
    FROM page_views pv
    WHERE pv.created_at >= NOW() - (p_days || ' days')::interval
      AND (
        (pv.entity_type = 'organization' AND pv.entity_id = auth.uid())
        OR (pv.entity_type = 'tournament' AND pv.entity_id IN (
          SELECT id FROM tournaments WHERE created_by = auth.uid()
        ))
      )
  )
  SELECT json_build_object(
    'total_views', COUNT(*),
    'unique_visitors', COUNT(DISTINCT session_id),
    'unique_persons', COUNT(DISTINCT visitor_id),
    'avg_duration_ms', COALESCE(AVG(NULLIF(duration_ms, 0))::integer, 0),
    'views_by_day', (
      SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json)
      FROM (
        SELECT created_at::date AS date, COUNT(*) AS views,
               COUNT(DISTINCT session_id) AS unique_visitors,
               COUNT(DISTINCT visitor_id) AS unique_persons
        FROM scoped
        GROUP BY created_at::date ORDER BY date
      ) d
    )
  )
  FROM scoped;
$$;

-- ----------------------------------------------------------------------------
-- RPC: analytics globales (admin) — agrega unique_persons
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_global_analytics(p_days integer DEFAULT 30)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT json_build_object(
      'total_views', COUNT(*),
      'unique_visitors', COUNT(DISTINCT session_id),
      'unique_persons', COUNT(DISTINCT visitor_id),
      'avg_duration_ms', COALESCE(AVG(NULLIF(duration_ms, 0))::integer, 0),
      'views_by_day', (
        SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json)
        FROM (
          SELECT created_at::date AS date, COUNT(*) AS views,
                 COUNT(DISTINCT session_id) AS unique_visitors,
                 COUNT(DISTINCT visitor_id) AS unique_persons
          FROM page_views WHERE created_at >= NOW() - (p_days || ' days')::interval
          GROUP BY created_at::date ORDER BY date
        ) d
      ),
      'views_by_page_type', (
        SELECT COALESCE(json_agg(row_to_json(pt)), '[]'::json)
        FROM (
          SELECT page_type, COUNT(*) AS count
          FROM page_views WHERE created_at >= NOW() - (p_days || ' days')::interval
          GROUP BY page_type ORDER BY count DESC
        ) pt
      ),
      'top_pages', (
        SELECT COALESCE(json_agg(row_to_json(tp)), '[]'::json)
        FROM (
          SELECT page_path, COUNT(*) AS views, COUNT(DISTINCT session_id) AS unique_visitors
          FROM page_views WHERE created_at >= NOW() - (p_days || ' days')::interval
          GROUP BY page_path ORDER BY views DESC LIMIT 20
        ) tp
      ),
      'top_referrers', (
        SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
        FROM (
          SELECT referrer, COUNT(*) AS count
          FROM page_views WHERE created_at >= NOW() - (p_days || ' days')::interval
            AND referrer IS NOT NULL AND referrer != ''
          GROUP BY referrer ORDER BY count DESC LIMIT 10
        ) r
      ),
      'device_breakdown', (
        SELECT COALESCE(json_agg(row_to_json(dev)), '[]'::json)
        FROM (
          SELECT device_type, COUNT(*) AS count
          FROM page_views WHERE created_at >= NOW() - (p_days || ' days')::interval
          GROUP BY device_type
        ) dev
      ),
      'browser_breakdown', (
        SELECT COALESCE(json_agg(row_to_json(br)), '[]'::json)
        FROM (
          SELECT browser, COUNT(*) AS count
          FROM page_views WHERE created_at >= NOW() - (p_days || ' days')::interval
          GROUP BY browser ORDER BY count DESC LIMIT 10
        ) br
      )
    )
    FROM page_views WHERE created_at >= NOW() - (p_days || ' days')::interval
  );
END;
$$;
