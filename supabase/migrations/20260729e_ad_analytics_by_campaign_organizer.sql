-- ============================================================================
-- get_ad_analytics v3: reparto POR CAMPAÑA + exclusión de cuentas
-- ----------------------------------------------------------------------------
-- Corrige un hueco de fondo del modelo de reparto.
--
-- EL PROBLEMA
-- Hasta la v2 toda la plata caía en un fondo único que se repartía según las
-- personas-día TOTALES de cada organizador en la plataforma. Pero las campañas
-- están segmentadas: una de Córdoba solo se muestra en torneos de Córdoba.
--
-- Con fondo único, una campaña de $600.000 dirigida a Córdoba y mostrada solo
-- en los torneos de dos organizadores de Montería terminaba pagándole ~$147.000
-- al organizador más grande de la plataforma, que aportó CERO audiencia a esa
-- campaña, mientras los dos que entregaron el 100% recibían migajas. El
-- anunciante de Montería financiando a un organizador de otro departamento.
--
-- LA CORRECCIÓN
-- Cada campaña reparte su propia plata entre quienes le entregaron audiencia a
-- ELLA. El pago de un organizador es la suma de lo que le tocó en cada campaña.
-- Eso exige el cruce campaña × organizador, que es lo que agrega esta versión.
--
-- No se puede calcular en el cliente agrupando `detail` (campaña × torneo):
-- sería una suma, y quien vio la misma campaña en dos torneos del mismo
-- organizador el mismo día contaría dos veces. Necesita su propio
-- COUNT(DISTINCT), como todos los cortes de esta función.
--
-- ----------------------------------------------------------------------------
-- EL DENOMINADOR INCLUYE A LOS QUE NO CALIFICAN
-- ----------------------------------------------------------------------------
-- `by_campaign_organizer` devuelve TODOS los organizadores que aportaron a la
-- campaña, incluido el excluido y el que no llega al umbral de monetización.
-- Es a propósito: el porcentaje del que no califica se lo queda la plataforma,
-- no se redistribuye entre los que sí. Si el denominador fueran solo los
-- elegibles, ellos absorberían esa parte y cobrarían más que su aporte real.
--
-- Quién es elegible lo decide el cliente (ver lib/ad-analytics.ts), no esta
-- función: el umbral de monetización se mide sobre `page_views` y es un cálculo
-- aparte del de publicidad.
--
-- ----------------------------------------------------------------------------
-- CUENTAS EXCLUIDAS
-- ----------------------------------------------------------------------------
-- `users.revenue_share_excluded` marca cuentas que no cobran: la cuenta de
-- pruebas de la plataforma ("Torneos Pro"), demos, socios. Se marca explícito y
-- no se adivina por rol ni por nombre, para poder excluir cuentas nuevas sin
-- tocar código ni migraciones.
--
-- La bandera NO filtra filas acá — el organizador excluido tiene que seguir
-- apareciendo para que cuente en el denominador (su parte se queda con la
-- plataforma, igual que el que no califica). Se devuelve como columna.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS revenue_share_excluded BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN users.revenue_share_excluded IS
  'No participa del reparto de publicidad (cuenta de pruebas, demo, socio). Sigue contando en el denominador: su parte queda con la plataforma, no se redistribuye.';

-- Cuenta de pruebas de la plataforma. Confirmada por el organizador el
-- 2026-07-29: hoy entraría a cobrar como cualquier organizador.
-- Verificar que haya afectado 1 fila.
UPDATE users u
SET revenue_share_excluded = true
WHERE EXISTS (
  SELECT 1 FROM organization_profiles op
  WHERE op.user_id = u.id AND op.organization_name = 'Torneos Pro'
);

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
  -- si no el del usuario. Se resuelve una vez acá y se reusa en los cortes.
  ev_org AS (
    SELECT
      ev.*,
      t.name       AS tournament_name,
      t.created_by AS organizer_id,
      COALESCE(op.organization_name, u.name)        AS organizer_name,
      COALESCE(u.revenue_share_excluded, false)     AS organizer_excluded
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

  -- LA BASE DEL REPARTO: campaña × organizador, cada celda con su propio
  -- COUNT(DISTINCT). Incluye excluidos y no-elegibles a propósito (ver la nota
  -- del encabezado sobre el denominador).
  by_campaign_organizer AS (
    SELECT
      ev_org.campaign_id,
      ev_org.organizer_id,
      ev_org.organizer_name,
      ev_org.organizer_excluded,
      COUNT(DISTINCT ev_org.tournament_id)                        AS tournaments,
      COUNT(*) FILTER (WHERE ev_org.event_type = 'ad_impression') AS impressions,
      COUNT(*) FILTER (WHERE ev_org.event_type = 'ad_click')      AS clicks,
      COUNT(DISTINCT (ev_org.visitor_id, ev_org.day)) FILTER (
        WHERE ev_org.event_type = 'ad_impression' AND ev_org.visitor_id IS NOT NULL
      ) AS person_days
    FROM ev_org
    WHERE ev_org.organizer_id IS NOT NULL
    GROUP BY ev_org.campaign_id, ev_org.organizer_id,
             ev_org.organizer_name, ev_org.organizer_excluded
  ),

  -- Resumen por organizador sobre TODAS las campañas. Ya no es la base del
  -- reparto (eso es by_campaign_organizer), pero sirve para el panel: "cuánta
  -- audiencia aportó este organizador en total".
  by_organizer AS (
    SELECT
      ev_org.organizer_id,
      ev_org.organizer_name,
      ev_org.organizer_excluded,
      COUNT(DISTINCT ev_org.tournament_id)                        AS tournaments,
      COUNT(*) FILTER (WHERE ev_org.event_type = 'ad_impression') AS impressions,
      COUNT(*) FILTER (WHERE ev_org.event_type = 'ad_click')      AS clicks,
      COUNT(DISTINCT (ev_org.visitor_id, ev_org.day)) FILTER (
        WHERE ev_org.event_type = 'ad_impression' AND ev_org.visitor_id IS NOT NULL
      ) AS person_days
    FROM ev_org
    WHERE ev_org.organizer_id IS NOT NULL
    GROUP BY ev_org.organizer_id, ev_org.organizer_name, ev_org.organizer_excluded
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
    'by_campaign',           (SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json) FROM by_campaign c),
    'by_tournament',         (SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM by_tournament t),
    'by_organizer',          (SELECT COALESCE(json_agg(row_to_json(o)), '[]'::json) FROM by_organizer o),
    'by_campaign_organizer', (SELECT COALESCE(json_agg(row_to_json(x)), '[]'::json) FROM by_campaign_organizer x),
    'detail',                (SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json) FROM detail d),
    'totals',                (SELECT row_to_json(x) FROM totals x)
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_ad_analytics(timestamptz, timestamptz) IS
  'Métricas de publicidad por campaña/torneo/organizador. Solo admin. person_days NO es aditivo: cada corte trae su propio COUNT(DISTINCT). El reparto se calcula POR CAMPAÑA sobre by_campaign_organizer: las campañas están segmentadas, así que un fondo único le pagaría a organizadores que no aportaron audiencia a esa campaña.';
