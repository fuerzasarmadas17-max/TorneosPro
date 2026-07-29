-- ============================================================================
-- get_ad_analytics: métricas de publicidad agregadas
-- ----------------------------------------------------------------------------
-- Reemplaza el conteo que hacía `admin/ads/page.tsx` en el navegador: se traía
-- TODOS los eventos de publicidad y los tallaba en JS, sin paginar. PostgREST
-- corta en 1000 filas por defecto, así que pasado ese punto el panel mostraba
-- un número congelado y EN SILENCIO — sin error, sin aviso. Medición del
-- 2026-07-29: 796 eventos históricos, ~26/día, faltaban ~8 días para cruzarlo.
-- Mismo problema que `fetchMatchEventsByMatchIds` ya resuelve paginando
-- (db/tournaments.ts).
--
-- PERSONA-DÍA es la métrica de reparto con organizadores: visitantes distintos
-- que vieron publicidad cada día, sumados en el período. Inmune al refresh
-- (quien recarga 50 veces el sábado aporta 1) pero crece con la actividad real
-- del torneo. Ver Por hacer/monetizacion-analitica-publicidad.md.
--
-- POR QUÉ DEVUELVE VARIOS CORTES YA CALCULADOS
-- Personas-día NO es aditivo: no se puede calcular el total de una campaña
-- sumando sus filas por torneo, porque la misma persona el mismo día pudo ver
-- esa campaña en dos torneos distintos y se contaría dos veces. Cada nivel
-- necesita su propio COUNT(DISTINCT), y eso solo lo puede hacer la base. Por
-- eso no devolvemos el grano fino para que el cliente sume, sino cada
-- agrupación resuelta:
--
--   by_campaign    → para la lista de campañas del panel
--   by_tournament  → base del reparto con organizadores (agrupa por
--                    tournaments.created_by en el cliente; ver nota abajo)
--   detail         → grano campaña × torneo, para el informe al anunciante
--   totals         → tarjetas de resumen
--
-- NOTA sobre el reparto: agrupar `by_tournament` por organizador en el cliente
-- vuelve a ser una suma, con el mismo sesgo (una persona que el mismo día ve
-- dos torneos del mismo organizador cuenta dos veces). Para el Paso 2 se
-- agregará un corte `by_organizer` calculado acá. Mientras tanto `by_tournament`
-- es exacto a nivel torneo, que es lo que muestra el panel hoy.
--
-- Seguridad: SECURITY DEFINER (los eventos son de lectura restringida a dueño
-- del torneo / admin) con chequeo de admin adentro, igual que
-- get_global_analytics. Un no-admin recibe NULL.

CREATE OR REPLACE FUNCTION get_ad_analytics(
  p_from timestamptz DEFAULT NULL,
  p_to   timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN NULL;
  END IF;

  WITH ev AS (
    SELECT
      e.target_id     AS campaign_id,
      e.tournament_id,
      e.event_type,
      e.visitor_id,
      e.created_at::date AS day
    FROM analytics_events e
    WHERE e.event_type IN ('ad_impression', 'ad_click')
      AND e.target_id IS NOT NULL
      AND (p_from IS NULL OR e.created_at >= p_from)
      AND (p_to   IS NULL OR e.created_at <  p_to)
  ),

  -- El FILTER por visitor_id NOT NULL es obligatorio en todo person_days: sin
  -- él, el par (NULL, day) NO es nulo como registro y COUNT DISTINCT lo
  -- cuenta, devolviendo "cantidad de días con actividad" disfrazado de
  -- personas-día. Los eventos previos a la migración
  -- 20260729_analytics_events_visitor_id no tienen persona y quedan fuera.
  by_campaign AS (
    SELECT
      ev.campaign_id,
      COUNT(*) FILTER (WHERE ev.event_type = 'ad_impression') AS impressions,
      COUNT(*) FILTER (WHERE ev.event_type = 'ad_click')      AS clicks,
      COUNT(DISTINCT ev.visitor_id)
        FILTER (WHERE ev.event_type = 'ad_impression')        AS persons,
      COUNT(DISTINCT (ev.visitor_id, ev.day)) FILTER (
        WHERE ev.event_type = 'ad_impression' AND ev.visitor_id IS NOT NULL
      ) AS person_days,
      COUNT(*) FILTER (
        WHERE ev.event_type = 'ad_impression' AND ev.visitor_id IS NOT NULL
      ) AS impressions_with_person
    FROM ev
    GROUP BY ev.campaign_id
  ),

  by_tournament AS (
    SELECT
      ev.tournament_id,
      t.name       AS tournament_name,
      t.created_by AS organizer_id,
      COUNT(*) FILTER (WHERE ev.event_type = 'ad_impression') AS impressions,
      COUNT(*) FILTER (WHERE ev.event_type = 'ad_click')      AS clicks,
      COUNT(DISTINCT (ev.visitor_id, ev.day)) FILTER (
        WHERE ev.event_type = 'ad_impression' AND ev.visitor_id IS NOT NULL
      ) AS person_days
    FROM ev
    LEFT JOIN tournaments t ON t.id = ev.tournament_id
    WHERE ev.tournament_id IS NOT NULL
    GROUP BY ev.tournament_id, t.name, t.created_by
  ),

  detail AS (
    SELECT
      ev.campaign_id,
      ev.tournament_id,
      t.name       AS tournament_name,
      t.created_by AS organizer_id,
      COUNT(*) FILTER (WHERE ev.event_type = 'ad_impression') AS impressions,
      COUNT(*) FILTER (WHERE ev.event_type = 'ad_click')      AS clicks,
      COUNT(DISTINCT (ev.visitor_id, ev.day)) FILTER (
        WHERE ev.event_type = 'ad_impression' AND ev.visitor_id IS NOT NULL
      ) AS person_days
    FROM ev
    LEFT JOIN tournaments t ON t.id = ev.tournament_id
    GROUP BY ev.campaign_id, ev.tournament_id, t.name, t.created_by
  ),

  totals AS (
    SELECT
      COUNT(*) FILTER (WHERE ev.event_type = 'ad_impression') AS impressions,
      COUNT(*) FILTER (WHERE ev.event_type = 'ad_click')      AS clicks,
      COUNT(DISTINCT (ev.visitor_id, ev.day)) FILTER (
        WHERE ev.event_type = 'ad_impression' AND ev.visitor_id IS NOT NULL
      ) AS person_days,
      COUNT(*) FILTER (
        WHERE ev.event_type = 'ad_impression' AND ev.visitor_id IS NOT NULL
      ) AS impressions_with_person
    FROM ev
  )

  SELECT json_build_object(
    'by_campaign',   (SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json) FROM by_campaign c),
    'by_tournament', (SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM by_tournament t),
    'detail',        (SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json) FROM detail d),
    'totals',        (SELECT row_to_json(x) FROM totals x)
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_ad_analytics(timestamptz, timestamptz) IS
  'Métricas de publicidad por campaña/torneo. Solo admin. person_days NO es aditivo: cada corte trae su propio COUNT(DISTINCT).';
