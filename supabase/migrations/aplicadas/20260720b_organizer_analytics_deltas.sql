-- ============================================================================
-- get_organizer_analytics v2: agrega el período ANTERIOR para calcular deltas
-- (▲/▼ vs los 7/30/90 días previos). Una sola pasada sobre 2×ventana.
-- ============================================================================
CREATE OR REPLACE FUNCTION get_organizer_analytics(p_days integer DEFAULT 30)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT pv.*
    FROM page_views pv
    WHERE pv.created_at >= NOW() - ((2 * p_days) || ' days')::interval
      AND (
        (pv.entity_type = 'organization' AND pv.entity_id = auth.uid())
        OR (pv.entity_type = 'tournament' AND pv.entity_id IN (
          SELECT id FROM tournaments WHERE created_by = auth.uid()
        ))
      )
  ),
  cur AS (
    SELECT * FROM base
    WHERE created_at >= NOW() - (p_days || ' days')::interval
  ),
  prev AS (
    SELECT * FROM base
    WHERE created_at < NOW() - (p_days || ' days')::interval
  )
  SELECT json_build_object(
    'total_views', (SELECT COUNT(*) FROM cur),
    'unique_visitors', (SELECT COUNT(DISTINCT session_id) FROM cur),
    'unique_persons', (SELECT COUNT(DISTINCT visitor_id) FROM cur),
    'avg_duration_ms', (SELECT COALESCE(AVG(NULLIF(duration_ms, 0))::integer, 0) FROM cur),
    'views_by_day', (
      SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json)
      FROM (
        SELECT created_at::date AS date, COUNT(*) AS views,
               COUNT(DISTINCT session_id) AS unique_visitors,
               COUNT(DISTINCT visitor_id) AS unique_persons
        FROM cur
        GROUP BY created_at::date ORDER BY date
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

NOTIFY pgrst, 'reload schema';
