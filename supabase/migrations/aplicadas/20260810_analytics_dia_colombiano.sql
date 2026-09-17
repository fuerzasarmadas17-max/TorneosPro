-- ============================================================================
-- Las gráficas de vistas también en día colombiano
-- ----------------------------------------------------------------------------
-- `20260808e_dia_colombiano` arregló el día en las cuentas de PUBLICIDAD
-- (get_ad_analytics, close_ad_period, get_my_ad_earnings,
-- get_monetization_status), que era lo que bloqueaba el reparto. Las gráficas
-- de vistas quedaron por fuera y siguieron agrupando por `created_at::date`,
-- que es UTC: para ellas el día se acaba a las 7:00 PM hora Colombia.
--
-- El síntoma: a las 7:24 PM del 10 de agosto de 2026, el panel ya mostraba 21
-- visitas anotadas al 11. Contra los datos reales de ese momento:
--
--     por día UTC (lo que se veía):   11 ago → 21   |  10 ago → 379
--     por día Colombia (lo correcto): 10 ago → 383  |   9 ago → 17
--
-- Y las 7 PM es justo cuando la gente entra a mirar resultados, así que la
-- última franja del día —la más cargada— se iba entera al día siguiente. Eso
-- deja el histórico incomparable con las cifras de publicidad, que desde el 8
-- de agosto sí cuentan bien.
--
-- No hay que migrar ni un dato: el día se calcula al leer, así que corregir
-- estas cuatro funciones reacomoda todo el histórico de una vez.
--
-- `co_day()` y `co_start()` ya existen desde `20260808e`.
--
-- Va todo en una transacción: si alguna de las cuatro falla, no queda el panel
-- a medias con unas funciones contando en Colombia y otras en UTC.

BEGIN;

-- ============================================================
-- La ventana también se alinea al día colombiano
-- ============================================================
-- Antes la ventana era `NOW() - N días`: un corte a la hora exacta en que se
-- abría el panel, así que el primer día del gráfico salía siempre mocho (solo
-- las horas posteriores a esa). Ahora se toman N días calendario completos,
-- terminando en el de hoy:
--
--     co_start(co_day(NOW()) - (p_days - 1))  = medianoche colombiana del 1er día
--
-- El período anterior (los deltas ▲/▼) usa la misma regla corrida N días, para
-- que se comparen dos ventanas del mismo tamaño y no una completa contra una
-- mocha.

-- ============================================================
-- 1. get_entity_analytics — vistas de un torneo / perfil
-- ============================================================
-- Idéntica a la de `20260720_analytics_visitor_id` salvo el día y la ventana.
-- Pasa a plpgsql solo para poder nombrar el inicio de la ventana una vez en
-- vez de repetir la expresión ocho veces.

CREATE OR REPLACE FUNCTION get_entity_analytics(
  p_entity_type text,
  p_entity_id uuid,
  p_days integer DEFAULT 30
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := co_start(co_day(NOW()) - (p_days - 1));
BEGIN
  RETURN (
    SELECT json_build_object(
      'total_views', COUNT(*),
      'unique_visitors', COUNT(DISTINCT session_id),
      'unique_persons', COUNT(DISTINCT visitor_id),
      'avg_duration_ms', COALESCE(AVG(NULLIF(duration_ms, 0))::integer, 0),
      -- Personas cuya PRIMERA visita (histórica) a esta entidad cae dentro de
      -- la ventana: son nuevas.
      'new_visitors', (
        SELECT COUNT(*) FROM (
          SELECT visitor_id
          FROM page_views
          WHERE entity_type = p_entity_type AND entity_id = p_entity_id
            AND visitor_id IS NOT NULL
          GROUP BY visitor_id
          HAVING MIN(created_at) >= v_start
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
          HAVING MIN(created_at) < v_start
             AND MAX(created_at) >= v_start
        ) rv
      ),
      'views_by_day', (
        SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json)
        FROM (
          SELECT co_day(created_at) AS date, COUNT(*) AS views,
                 COUNT(DISTINCT session_id) AS unique_visitors,
                 COUNT(DISTINCT visitor_id) AS unique_persons
          FROM page_views
          WHERE entity_type = p_entity_type AND entity_id = p_entity_id
            AND created_at >= v_start
          GROUP BY co_day(created_at) ORDER BY date
        ) d
      ),
      'top_referrers', (
        SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
        FROM (
          SELECT referrer, COUNT(*) AS count
          FROM page_views
          WHERE entity_type = p_entity_type AND entity_id = p_entity_id
            AND created_at >= v_start
            AND referrer IS NOT NULL AND referrer != ''
          GROUP BY referrer ORDER BY count DESC LIMIT 10
        ) r
      ),
      -- Visitas sin referrer conocido (acceso directo o navegación interna).
      'direct_views', (
        SELECT COUNT(*)
        FROM page_views
        WHERE entity_type = p_entity_type AND entity_id = p_entity_id
          AND created_at >= v_start
          AND (referrer IS NULL OR referrer = '')
      ),
      'device_breakdown', (
        SELECT COALESCE(json_agg(row_to_json(dev)), '[]'::json)
        FROM (
          SELECT device_type, COUNT(*) AS count
          FROM page_views
          WHERE entity_type = p_entity_type AND entity_id = p_entity_id
            AND created_at >= v_start
          GROUP BY device_type
        ) dev
      ),
      'browser_breakdown', (
        SELECT COALESCE(json_agg(row_to_json(br)), '[]'::json)
        FROM (
          SELECT browser, COUNT(*) AS count
          FROM page_views
          WHERE entity_type = p_entity_type AND entity_id = p_entity_id
            AND created_at >= v_start
          GROUP BY browser ORDER BY count DESC LIMIT 10
        ) br
      )
    )
    FROM page_views
    WHERE entity_type = p_entity_type AND entity_id = p_entity_id
      AND created_at >= v_start
  );
END;
$$;

-- ============================================================
-- 2. get_organizer_tournament_views — vistas por torneo
-- ============================================================

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
      AND pv.created_at >= co_start(co_day(NOW()) - (p_days - 1))
    GROUP BY pv.entity_id
  ) tv;
$$;

-- ============================================================
-- 3. get_organizer_analytics — panel del organizador (con deltas)
-- ============================================================
-- Misma estructura que `20260720b`: base = 2×ventana, partida en cur/prev.

CREATE OR REPLACE FUNCTION get_organizer_analytics(p_days integer DEFAULT 30)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT pv.*
    FROM page_views pv
    WHERE pv.created_at >= co_start(co_day(NOW()) - (2 * p_days - 1))
      AND (
        (pv.entity_type = 'organization' AND pv.entity_id = auth.uid())
        OR (pv.entity_type = 'tournament' AND pv.entity_id IN (
          SELECT id FROM tournaments WHERE created_by = auth.uid()
        ))
      )
  ),
  cur AS (
    SELECT * FROM base
    WHERE created_at >= co_start(co_day(NOW()) - (p_days - 1))
  ),
  prev AS (
    SELECT * FROM base
    WHERE created_at < co_start(co_day(NOW()) - (p_days - 1))
  )
  SELECT json_build_object(
    'total_views', (SELECT COUNT(*) FROM cur),
    'unique_visitors', (SELECT COUNT(DISTINCT session_id) FROM cur),
    'unique_persons', (SELECT COUNT(DISTINCT visitor_id) FROM cur),
    'avg_duration_ms', (SELECT COALESCE(AVG(NULLIF(duration_ms, 0))::integer, 0) FROM cur),
    'views_by_day', (
      SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json)
      FROM (
        SELECT co_day(created_at) AS date, COUNT(*) AS views,
               COUNT(DISTINCT session_id) AS unique_visitors,
               COUNT(DISTINCT visitor_id) AS unique_persons
        FROM cur
        GROUP BY co_day(created_at) ORDER BY date
      ) d
    ),
    'previous', json_build_object(
      'total_views', (SELECT COUNT(*) FROM prev),
      'unique_visitors', (SELECT COUNT(DISTINCT session_id) FROM prev),
      'unique_persons', (SELECT COUNT(DISTINCT visitor_id) FROM prev),
      'avg_duration_ms', (SELECT COALESCE(AVG(NULLIF(duration_ms, 0))::integer, 0) FROM prev)
    )
  );
$$;

-- ============================================================
-- 4. get_global_analytics — panel de admin (con deltas)
-- ============================================================
-- Misma estructura que `20260720c`.

CREATE OR REPLACE FUNCTION get_global_analytics(p_days integer DEFAULT 30)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cur_start  timestamptz := co_start(co_day(NOW()) - (p_days - 1));
  v_prev_start timestamptz := co_start(co_day(NOW()) - (2 * p_days - 1));
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN NULL;
  END IF;

  RETURN (
    WITH base AS (
      SELECT * FROM page_views
      WHERE created_at >= v_prev_start
    ),
    cur AS (
      SELECT * FROM base WHERE created_at >= v_cur_start
    ),
    prev AS (
      SELECT * FROM base WHERE created_at < v_cur_start
    )
    SELECT json_build_object(
      'total_views', (SELECT COUNT(*) FROM cur),
      'unique_visitors', (SELECT COUNT(DISTINCT session_id) FROM cur),
      'unique_persons', (SELECT COUNT(DISTINCT visitor_id) FROM cur),
      'avg_duration_ms', (SELECT COALESCE(AVG(NULLIF(duration_ms, 0))::integer, 0) FROM cur),
      'views_by_day', (
        SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json)
        FROM (
          SELECT co_day(created_at) AS date, COUNT(*) AS views,
                 COUNT(DISTINCT session_id) AS unique_visitors,
                 COUNT(DISTINCT visitor_id) AS unique_persons
          FROM cur GROUP BY co_day(created_at) ORDER BY date
        ) d
      ),
      'views_by_page_type', (
        SELECT COALESCE(json_agg(row_to_json(pt)), '[]'::json)
        FROM (
          SELECT page_type, COUNT(*) AS count FROM cur GROUP BY page_type ORDER BY count DESC
        ) pt
      ),
      'top_pages', (
        SELECT COALESCE(json_agg(row_to_json(tp)), '[]'::json)
        FROM (
          SELECT page_path, COUNT(*) AS views, COUNT(DISTINCT session_id) AS unique_visitors
          FROM cur GROUP BY page_path ORDER BY views DESC LIMIT 20
        ) tp
      ),
      'top_referrers', (
        SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
        FROM (
          SELECT referrer, COUNT(*) AS count FROM cur
          WHERE referrer IS NOT NULL AND referrer != ''
          GROUP BY referrer ORDER BY count DESC LIMIT 10
        ) r
      ),
      'device_breakdown', (
        SELECT COALESCE(json_agg(row_to_json(dev)), '[]'::json)
        FROM (
          SELECT device_type, COUNT(*) AS count FROM cur GROUP BY device_type
        ) dev
      ),
      'browser_breakdown', (
        SELECT COALESCE(json_agg(row_to_json(br)), '[]'::json)
        FROM (
          SELECT browser, COUNT(*) AS count FROM cur GROUP BY browser ORDER BY count DESC LIMIT 10
        ) br
      ),
      'previous', json_build_object(
        'total_views', (SELECT COUNT(*) FROM prev),
        'unique_visitors', (SELECT COUNT(DISTINCT session_id) FROM prev),
        'unique_persons', (SELECT COUNT(DISTINCT visitor_id) FROM prev),
        'avg_duration_ms', (SELECT COALESCE(AVG(NULLIF(duration_ms, 0))::integer, 0) FROM prev)
      )
    )
  );
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
