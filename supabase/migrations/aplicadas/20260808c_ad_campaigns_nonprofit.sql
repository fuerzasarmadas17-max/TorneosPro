-- ============================================================================
-- Campañas sin ánimo de lucro
-- ----------------------------------------------------------------------------
-- Causas sociales, campañas de salud, avisos de la comunidad o de la propia
-- plataforma. No se cobran, así que no reparten plata.
--
-- POR QUÉ NO ALCANZA CON `monthly_price = 0`
-- Una campaña en cero puede ser dos cosas muy distintas: una campaña social, o
-- una campaña comercial a la que todavía no le pusieron precio. Hoy el panel ya
-- trata la segunda como un error —no deja generar el link de pago sin precio—,
-- y con razón. Sin una marca explícita, la pantalla del organizador no puede
-- distinguirlas y le muestra "Sin pagar" a las dos, que en la social se lee como
-- "el anunciante te debe plata" y esa plata no va a llegar nunca.
--
-- El organizador ve estas campañas marcadas; está prometido en las condiciones
-- del programa (`src/lib/monetizar-terms.ts`, sección "Campañas que no pagan").
--
-- ⚠️ NO CAMBIA EL REPARTO, y no hace falta que lo cambie.
-- Cada campaña reparte solo su propia plata: una sin cobro tiene bolsa cero, su
-- propio denominador, y no le paga a nadie. NO entra en el denominador de las
-- campañas que sí pagan, así que no le quita un peso a ningún organizador. Eso
-- ya quedó resuelto en `20260729e`, cuando el reparto pasó de fondo único a por
-- campaña. La marca es para poder EXPLICARLO, no para corregir la cuenta.
--
-- Lo que sí le cuesta al organizador es el espacio: cada persona ve como máximo
-- 7 avisos por torneo y por día (`lib/ad-frequency.ts`), y una campaña social
-- que se muestra gasta uno de esos. En la práctica casi nunca sale cuando
-- compite —el sorteo pondera por precio y una gratis pesa el mínimo— salvo que
-- sea la única campaña elegible para ese torneo, donde se lleva todo. Es una
-- decisión de negocio, no un error: ahí no hay plata que repartir de todos
-- modos, y la audiencia le sigue contando para sus requisitos del mes.

ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS is_nonprofit BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN ad_campaigns.is_nonprofit IS
  'Campaña social: no se cobra y no reparte. Explícito y no deducido de monthly_price = 0, que también significa "campaña comercial sin precio todavía". El organizador la ve marcada en su sección Monetizar.';

-- ============================================================
-- La RPC del organizador la devuelve
-- ============================================================
-- Idéntica a la de `20260808_my_ad_earnings.sql` salvo por `c.is_nonprofit` en
-- el SELECT final. Se repite entera porque CREATE OR REPLACE no admite parches.
-- Todo el razonamiento de por qué esta función es solo de servidor, por qué
-- devuelve ingredientes y no pesos, y por qué el denominador es la suma de
-- celdas, está en el encabezado de aquella migración.

CREATE OR REPLACE FUNCTION get_my_ad_earnings(
  p_user_id UUID,
  p_month   DATE DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month  date;
  v_from   timestamptz;
  v_to     timestamptz;
  result   json;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF auth.uid() IS DISTINCT FROM p_user_id AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'No podés consultar el reparto de otra cuenta';
  END IF;

  v_month := COALESCE(date_trunc('month', p_month)::date,
                      date_trunc('month', now())::date);

  v_from := v_month::timestamptz;
  v_to   := (v_month + interval '1 month')::timestamptz;

  WITH ev AS (
    SELECT
      e.target_id        AS campaign_id,
      e.tournament_id,
      e.visitor_id,
      e.created_at::date AS day,
      t.created_by       AS organizer_id,
      t.name             AS tournament_name
    FROM analytics_events e
    JOIN tournaments t ON t.id = e.tournament_id
    WHERE e.event_type  = 'ad_impression'
      AND e.target_id   IS NOT NULL
      AND e.visitor_id  IS NOT NULL
      AND t.created_by  IS NOT NULL
      AND e.created_at >= v_from
      AND e.created_at <  v_to
  ),

  cells AS (
    SELECT
      ev.campaign_id,
      ev.organizer_id,
      COUNT(DISTINCT (ev.visitor_id, ev.day)) AS person_days
    FROM ev
    GROUP BY ev.campaign_id, ev.organizer_id
  ),

  denom AS (
    SELECT campaign_id, SUM(person_days)::int AS total_person_days
    FROM cells
    WHERE person_days > 0
    GROUP BY campaign_id
  ),

  mine AS (
    SELECT campaign_id, person_days
    FROM cells
    WHERE organizer_id = p_user_id AND person_days > 0
  ),

  my_tournaments AS (
    SELECT
      ev.campaign_id,
      ev.tournament_id,
      MIN(ev.tournament_name) AS tournament_name,
      COUNT(DISTINCT (ev.visitor_id, ev.day)) AS person_days
    FROM ev
    WHERE ev.organizer_id = p_user_id
    GROUP BY ev.campaign_id, ev.tournament_id
  ),

  paid AS (
    SELECT campaign_id, SUM(amount_cop)::bigint AS paid_cop
    FROM ad_payments
    WHERE status = 'approved' AND campaign_id IS NOT NULL
    GROUP BY campaign_id
  )

  SELECT json_build_object(
    'month', v_month,
    'campaigns', COALESCE((
      SELECT json_agg(row_to_json(x) ORDER BY x.my_person_days DESC)
      FROM (
        SELECT
          m.campaign_id,
          c.advertiser_name,
          c.starts_at,
          c.ends_at,
          -- Una campaña borrada deja sus eventos pero no su fila. Se trata como
          -- comercial: si de verdad era social, igual va a mostrar cero, y no
          -- vale la pena marcarla como social sin poder confirmarlo.
          COALESCE(c.is_nonprofit, false)        AS is_nonprofit,
          m.person_days                          AS my_person_days,
          d.total_person_days,
          COALESCE(p.paid_cop, 0)::bigint        AS paid_cop,
          r.amount_cop                           AS revenue_override_cop,
          COALESCE((
            SELECT json_agg(row_to_json(t) ORDER BY t.person_days DESC)
            FROM (
              SELECT tournament_id, tournament_name, person_days
              FROM my_tournaments mt
              WHERE mt.campaign_id = m.campaign_id
            ) t
          ), '[]'::json)                         AS tournaments
        -- El `::text` del lado UUID es obligatorio: `analytics_events.target_id`
        -- es TEXT y los `campaign_id` de las otras tablas son UUID. Ver la nota
        -- completa en 20260808_my_ad_earnings.sql.
        FROM mine m
        JOIN denom d              ON d.campaign_id = m.campaign_id
        LEFT JOIN ad_campaigns c  ON c.id::text = m.campaign_id
        LEFT JOIN paid p          ON p.campaign_id::text = m.campaign_id
        LEFT JOIN ad_period_revenue r
               ON r.campaign_id::text = m.campaign_id AND r.period_month = v_month
      ) x
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

-- CREATE OR REPLACE conserva los permisos, pero se repiten por si esta
-- migración se corre sobre una base donde la función no existía.
REVOKE ALL ON FUNCTION get_my_ad_earnings(UUID, DATE)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_my_ad_earnings(UUID, DATE) TO service_role;

-- ============================================================
-- Comprobación
-- ============================================================
--   select id, advertiser_name, monthly_price, is_nonprofit
--   from ad_campaigns order by created_at desc;
--   -- todas deben quedar en false: ninguna campaña existente cambia de sentido
--   -- por esta migración.
