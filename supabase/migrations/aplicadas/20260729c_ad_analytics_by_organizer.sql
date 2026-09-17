-- ============================================================================
-- get_ad_analytics v2: corte por ORGANIZADOR (base del reparto)
-- ----------------------------------------------------------------------------
-- La v1 (20260729b) dejó el reparto a medias: devolvía `by_tournament` y el
-- panel agrupaba por organizador en el cliente. Eso vuelve a ser una SUMA, y
-- personas-día no se suma: quien el mismo día abre dos torneos del mismo
-- organizador se contaba dos veces, inflando a los organizadores con varios
-- torneos activos justo en la cuenta que define cuánta plata recibe cada uno.
-- Este corte lo calcula la base con su propio COUNT(DISTINCT).
--
-- Agrega también `organizer_name` a `by_tournament` y `detail`, para que el
-- informe al anunciante y el desglose del panel no tengan que resolver UUIDs
-- con una segunda consulta.
--
-- ----------------------------------------------------------------------------
-- OJO CON EL DENOMINADOR DEL REPARTO
-- ----------------------------------------------------------------------------
-- El porcentaje de cada organizador se calcula sobre la SUMA de las filas de
-- `by_organizer`, NO sobre `totals.person_days`.
--
-- No son lo mismo y la diferencia no es un error: `totals.person_days` cuenta
-- personas-día distintas en toda la plataforma, así que alguien que el mismo
-- día ve torneos de dos organizadores aporta 1 al total pero 1 a cada uno de
-- los dos. Por eso la suma de las filas es SIEMPRE >= el total global.
--
-- Para repartir hay que usar la suma de las filas, porque es lo único que da
-- 100% exacto. Usar el total global dejaría plata sin asignar: los porcentajes
-- sumarían más de 100% y la última fila se llevaría de menos o el reparto
-- excedería el fondo. `totals.person_days` sigue sirviendo para "cuánta gente
-- distinta alcanzamos", que es la cifra para el anunciante, no para liquidar.

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

  -- Nombre a mostrar del organizador: el de la organización si tiene perfil,
  -- si no el del usuario. Se resuelve una vez acá y se reusa en los tres
  -- cortes que lo necesitan.
  ev_org AS (
    SELECT
      ev.*,
      t.name       AS tournament_name,
      t.created_by AS organizer_id,
      COALESCE(op.organization_name, u.name) AS organizer_name
    FROM ev
    LEFT JOIN tournaments t             ON t.id = ev.tournament_id
    LEFT JOIN users u                   ON u.id = t.created_by
    LEFT JOIN organization_profiles op  ON op.user_id = t.created_by
  ),

  -- El FILTER por visitor_id NOT NULL es obligatorio en todo person_days: sin
  -- él, el par (NULL, day) NO es nulo como registro y COUNT DISTINCT lo
  -- cuenta, devolviendo "cantidad de días con actividad" disfrazado de
  -- personas-día. Los eventos previos a la migración
  -- 20260729_analytics_events_visitor_id no tienen persona y quedan fuera.
  by_campaign AS (
    SELECT
      ev_org.campaign_id,
      COUNT(*) FILTER (WHERE ev_org.event_type = 'ad_impression') AS impressions,
      COUNT(*) FILTER (WHERE ev_org.event_type = 'ad_click')      AS clicks,
      COUNT(DISTINCT ev_org.visitor_id)
        FILTER (WHERE ev_org.event_type = 'ad_impression')        AS persons,
      COUNT(DISTINCT (ev_org.visitor_id, ev_org.day)) FILTER (
        WHERE ev_org.event_type = 'ad_impression' AND ev_org.visitor_id IS NOT NULL
      ) AS person_days,
      COUNT(*) FILTER (
        WHERE ev_org.event_type = 'ad_impression' AND ev_org.visitor_id IS NOT NULL
      ) AS impressions_with_person
    FROM ev_org
    GROUP BY ev_org.campaign_id
  ),

  by_tournament AS (
    SELECT
      ev_org.tournament_id,
      ev_org.tournament_name,
      ev_org.organizer_id,
      ev_org.organizer_name,
      COUNT(*) FILTER (WHERE ev_org.event_type = 'ad_impression') AS impressions,
      COUNT(*) FILTER (WHERE ev_org.event_type = 'ad_click')      AS clicks,
      COUNT(DISTINCT (ev_org.visitor_id, ev_org.day)) FILTER (
        WHERE ev_org.event_type = 'ad_impression' AND ev_org.visitor_id IS NOT NULL
      ) AS person_days
    FROM ev_org
    WHERE ev_org.tournament_id IS NOT NULL
    GROUP BY ev_org.tournament_id, ev_org.tournament_name,
             ev_org.organizer_id, ev_org.organizer_name
  ),

  -- LA BASE DEL REPARTO. Se agrupa por organizador ANTES de contar, así la
  -- persona que vio dos torneos del mismo organizador el mismo día aporta 1.
  -- Los eventos de torneos borrados (organizer_id NULL) quedan fuera: no hay
  -- a quién pagarle, y dejarlos adentro crearía una fila fantasma que se
  -- llevaría parte del fondo.
  by_organizer AS (
    SELECT
      ev_org.organizer_id,
      ev_org.organizer_name,
      COUNT(DISTINCT ev_org.tournament_id)                        AS tournaments,
      COUNT(*) FILTER (WHERE ev_org.event_type = 'ad_impression') AS impressions,
      COUNT(*) FILTER (WHERE ev_org.event_type = 'ad_click')      AS clicks,
      COUNT(DISTINCT (ev_org.visitor_id, ev_org.day)) FILTER (
        WHERE ev_org.event_type = 'ad_impression' AND ev_org.visitor_id IS NOT NULL
      ) AS person_days
    FROM ev_org
    WHERE ev_org.organizer_id IS NOT NULL
    GROUP BY ev_org.organizer_id, ev_org.organizer_name
  ),

  detail AS (
    SELECT
      ev_org.campaign_id,
      ev_org.tournament_id,
      ev_org.tournament_name,
      ev_org.organizer_id,
      ev_org.organizer_name,
      COUNT(*) FILTER (WHERE ev_org.event_type = 'ad_impression') AS impressions,
      COUNT(*) FILTER (WHERE ev_org.event_type = 'ad_click')      AS clicks,
      COUNT(DISTINCT (ev_org.visitor_id, ev_org.day)) FILTER (
        WHERE ev_org.event_type = 'ad_impression' AND ev_org.visitor_id IS NOT NULL
      ) AS person_days
    FROM ev_org
    GROUP BY ev_org.campaign_id, ev_org.tournament_id, ev_org.tournament_name,
             ev_org.organizer_id, ev_org.organizer_name
  ),

  totals AS (
    SELECT
      COUNT(*) FILTER (WHERE ev_org.event_type = 'ad_impression') AS impressions,
      COUNT(*) FILTER (WHERE ev_org.event_type = 'ad_click')      AS clicks,
      COUNT(DISTINCT (ev_org.visitor_id, ev_org.day)) FILTER (
        WHERE ev_org.event_type = 'ad_impression' AND ev_org.visitor_id IS NOT NULL
      ) AS person_days,
      COUNT(*) FILTER (
        WHERE ev_org.event_type = 'ad_impression' AND ev_org.visitor_id IS NOT NULL
      ) AS impressions_with_person
    FROM ev_org
  )

  SELECT json_build_object(
    'by_campaign',   (SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json) FROM by_campaign c),
    'by_tournament', (SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM by_tournament t),
    'by_organizer',  (SELECT COALESCE(json_agg(row_to_json(o)), '[]'::json) FROM by_organizer o),
    'detail',        (SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json) FROM detail d),
    'totals',        (SELECT row_to_json(x) FROM totals x)
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_ad_analytics(timestamptz, timestamptz) IS
  'Métricas de publicidad por campaña/torneo/organizador. Solo admin. person_days NO es aditivo: cada corte trae su propio COUNT(DISTINCT). El reparto se calcula sobre la suma de by_organizer, nunca sobre totals.person_days.';
