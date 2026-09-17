-- ============================================================================
-- get_global_analytics v2: agrega el período ANTERIOR (deltas) y sparklines.
-- Misma lógica que el organizador: base = 2×ventana, se parte en cur/prev.
-- ============================================================================
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
    WITH base AS (
      SELECT * FROM page_views
      WHERE created_at >= NOW() - ((2 * p_days) || ' days')::interval
    ),
    cur AS (
      SELECT * FROM base WHERE created_at >= NOW() - (p_days || ' days')::interval
    ),
    prev AS (
      SELECT * FROM base WHERE created_at < NOW() - (p_days || ' days')::interval
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
          FROM cur GROUP BY created_at::date ORDER BY date
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

NOTIFY pgrst, 'reload schema';
