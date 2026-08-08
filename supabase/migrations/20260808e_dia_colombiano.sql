-- ============================================================================
-- El día del reparto pasa a ser el día colombiano, no el día UTC
-- ----------------------------------------------------------------------------
-- EL PROBLEMA
-- La base corre en UTC (verificado: `show timezone` → UTC). Todas las cuentas de
-- personas-día agrupaban por `created_at::date`, que es la fecha UTC. Colombia
-- va 5 horas atrás, así que **el día se cortaba a las 7 de la noche**.
--
-- Consecuencia: alguien que entraba a las 6pm y volvía a las 8pm del mismo día
-- contaba como DOS personas-día. Y las 7pm es justo cuando la gente revisa
-- resultados, así que no era un caso raro: era el horario principal.
--
-- POR QUÉ IMPORTA AUNQUE EL SESGO SEA PAREJO
-- Para el reparto proporcional casi no importa —infla a todos por igual y la
-- proporción se mantiene—. Pero los UMBRALES son números absolutos: los 300
-- personas-día de `monetization_config` se alcanzan más fácil con público de
-- noche que con público de mañana, sin que ninguno de los dos organizadores haga
-- nada distinto. Y los umbrales se calibran en septiembre, así que había que
-- corregirlo antes de tomar esa medida.
--
-- Y ARREGLA UN SEGUNDO BUG, DE PASO
-- El panel de admin cuenta con la ventana del mes en hora LOCAL (`rangeBounds`
-- en el navegador), mientras que `close_ad_period` re-derivaba las personas-día
-- con la ventana en UTC. Son ventanas corridas 5 horas: el cierre habría
-- rechazado el corte con "Personas-día no coinciden" y nadie habría entendido
-- por qué. Nunca se notó porque el cierre todavía no se ha corrido ni una vez.
--
-- ⚠️ ESTO CAMBIA NÚMEROS YA CALCULADOS
-- Las personas-día de meses pasados van a dar distinto después de esta
-- migración. Se puede hacer sin problema **hoy** porque `ad_settlements` está
-- vacía: no hay ningún corte congelado al que contradecir. Después del primer
-- cierre real, esto ya no se podría correr sin dejar el histórico peleado con lo
-- que se pagó.

-- ============================================================
-- 1. El día colombiano, en un solo lugar
-- ============================================================
-- Colombia no tiene horario de verano desde 1993: es UTC-5 todo el año. Aun así
-- se usa el nombre de zona y no un `- interval '5 hours'`, para que si algún día
-- eso cambia lo resuelva la base de datos de zonas horarias y no haya que salir
-- a buscar restas de cinco horas por todo el esquema.

CREATE OR REPLACE FUNCTION co_day(ts timestamptz)
RETURNS date
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT (ts AT TIME ZONE 'America/Bogota')::date
$$;

COMMENT ON FUNCTION co_day(timestamptz) IS
  'Fecha calendario en Colombia. Usar SIEMPRE esto en vez de created_at::date para agrupar por día: la base corre en UTC y ::date corta el día a las 7pm hora local.';

-- Instante en que empieza un día (o un mes) colombiano, como timestamptz.
CREATE OR REPLACE FUNCTION co_start(d date)
RETURNS timestamptz
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT (d::timestamp AT TIME ZONE 'America/Bogota')
$$;

COMMENT ON FUNCTION co_start(date) IS
  'Medianoche colombiana de esa fecha, como instante. Para acotar ventanas de mes: co_start(mes) <= created_at < co_start(mes + 1 mes).';

-- ============================================================
-- 2. get_ad_analytics v4 — mismo cuerpo, día colombiano
-- ============================================================
-- Idéntica a la v3 (20260729e) salvo `co_day(e.created_at)` en vez de
-- `e.created_at::date`. Todo el razonamiento del reparto por campaña y del
-- denominador que incluye a los no elegibles está en el encabezado de aquella
-- migración y sigue igual.
--
-- `p_from`/`p_to` no se tocan: llegan del cliente como instantes ya resueltos.

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
      co_day(e.created_at) AS day
    FROM analytics_events e
    WHERE e.event_type IN ('ad_impression', 'ad_click')
      AND e.target_id IS NOT NULL
      AND (p_from IS NULL OR e.created_at >= p_from)
      AND (p_to   IS NULL OR e.created_at <  p_to)
  ),

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

-- ============================================================
-- 3. close_ad_period v2 — ventana y día colombianos
-- ============================================================
-- Idéntica a la de 20260729f salvo la ventana del mes y el día. Sin este cambio
-- el cierre habría rechazado cortes correctos: el panel cuenta con la ventana
-- local y la validación contaba con la ventana UTC.

CREATE OR REPLACE FUNCTION close_ad_period(
  p_month DATE,
  p_rows  JSONB
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from        timestamptz;
  v_to          timestamptz;
  v_pool        bigint;
  v_claimed     bigint;
  v_bad_org     uuid;
  v_bad_sent    int;
  v_bad_actual  int;
  v_inserted    int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Solo un admin puede cerrar un período.';
  END IF;

  IF p_month <> date_trunc('month', p_month)::date THEN
    RAISE EXCEPTION 'p_month debe ser el primer día del mes, recibido %', p_month;
  END IF;

  -- "Mes en curso" según el calendario colombiano: el 1 de septiembre a la
  -- medianoche de Bogotá agosto ya terminó, aunque en UTC sean las 5am.
  IF p_month >= date_trunc('month', co_day(now()))::date THEN
    RAISE EXCEPTION 'No se puede cerrar % porque el mes no ha terminado.', p_month;
  END IF;

  IF EXISTS (
    SELECT 1 FROM ad_settlements
    WHERE period_month = p_month AND status <> 'void'
  ) THEN
    RAISE EXCEPTION 'El período % ya está cerrado. Anular los cortes (status = void) antes de volver a cerrar.', p_month;
  END IF;

  v_from := co_start(p_month);
  v_to   := co_start((p_month + interval '1 month')::date);

  SELECT COALESCE(SUM(FLOOR(r.amount_cop * 0.5)), 0) INTO v_pool
  FROM ad_period_revenue r
  WHERE r.period_month = p_month;

  SELECT COALESCE(SUM((x->>'amount_cop')::bigint), 0) INTO v_claimed
  FROM jsonb_array_elements(p_rows) x;

  IF v_claimed > v_pool THEN
    RAISE EXCEPTION
      'El reparto (%) excede la bolsa del período (%). ¿Falta registrar el cobro de alguna campaña en ad_period_revenue?',
      v_claimed, v_pool;
  END IF;

  WITH sent AS (
    SELECT
      (x->>'organizer_id')::uuid AS organizer_id,
      (x->>'person_days')::int   AS person_days
    FROM jsonb_array_elements(p_rows) x
  ),
  actual AS (
    SELECT cell.organizer_id, SUM(cell.person_days)::int AS person_days
    FROM (
      SELECT
        t.created_by AS organizer_id,
        COUNT(DISTINCT (e.visitor_id, co_day(e.created_at))) AS person_days
      FROM analytics_events e
      JOIN tournaments t ON t.id = e.tournament_id
      WHERE e.event_type = 'ad_impression'
        AND e.target_id  IS NOT NULL
        AND e.visitor_id IS NOT NULL
        AND t.created_by IS NOT NULL
        AND e.created_at >= v_from
        AND e.created_at <  v_to
      GROUP BY e.target_id, t.created_by
    ) cell
    GROUP BY cell.organizer_id
  )
  SELECT s.organizer_id, s.person_days, COALESCE(a.person_days, 0)
  INTO v_bad_org, v_bad_sent, v_bad_actual
  FROM sent s
  LEFT JOIN actual a ON a.organizer_id = s.organizer_id
  WHERE s.person_days IS DISTINCT FROM COALESCE(a.person_days, 0)
  LIMIT 1;

  IF v_bad_org IS NOT NULL THEN
    RAISE EXCEPTION
      'Personas-día no coinciden para el organizador %: mandaste %, la base calcula %. Recargá el panel antes de cerrar.',
      v_bad_org, v_bad_sent, v_bad_actual;
  END IF;

  INSERT INTO ad_settlements (
    period_month, organizer_id, person_days, amount_cop, breakdown, closed_by
  )
  SELECT
    p_month,
    (x->>'organizer_id')::uuid,
    (x->>'person_days')::int,
    (x->>'amount_cop')::int,
    COALESCE(x->'breakdown', '[]'::jsonb),
    auth.uid()
  FROM jsonb_array_elements(p_rows) x;

  v_inserted := (SELECT COUNT(*) FROM jsonb_array_elements(p_rows));

  RETURN json_build_object(
    'period_month', p_month,
    'settlements',  v_inserted,
    'pool_cop',     v_pool,
    'payable_cop',  v_claimed,
    'retained_cop', v_pool - v_claimed
  );
END;
$$;

-- ============================================================
-- 4. get_my_ad_earnings v3 — ventana y día colombianos
-- ============================================================
-- Idéntica a la de 20260808c. Todo el razonamiento —solo service_role, devuelve
-- ingredientes y no pesos, el denominador es la suma de celdas— está allá.

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
                      date_trunc('month', co_day(now()))::date);

  v_from := co_start(v_month);
  v_to   := co_start((v_month + interval '1 month')::date);

  WITH ev AS (
    SELECT
      e.target_id          AS campaign_id,
      e.tournament_id,
      e.visitor_id,
      co_day(e.created_at) AS day,
      t.created_by         AS organizer_id,
      t.name               AS tournament_name
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

REVOKE ALL ON FUNCTION get_my_ad_earnings(UUID, DATE)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_my_ad_earnings(UUID, DATE) TO service_role;

-- ============================================================
-- 5. get_monetization_status v4 — ventana y día colombianos
-- ============================================================
-- Idéntica a la de 20260808d (la que agregó la aprobación). Acá el día importa
-- doble: además de `person_days`, define `active_days` —"días con audiencia"—,
-- que con el corte UTC podía contar dos días por una sola noche.

CREATE OR REPLACE FUNCTION get_monetization_status(p_month DATE DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_month    date;
  v_from     timestamptz;
  v_to       timestamptz;
  v_cfg      monetization_config;
  result     json;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

  v_month := COALESCE(date_trunc('month', p_month)::date,
                      date_trunc('month', co_day(now()))::date);
  v_from  := co_start(v_month);
  v_to    := co_start((v_month + interval '1 month')::date);

  SELECT * INTO v_cfg FROM monetization_config WHERE id;

  WITH orgs AS (
    SELECT DISTINCT t.created_by AS user_id
    FROM tournaments t
    WHERE t.created_by IS NOT NULL
      AND (v_is_admin OR t.created_by = auth.uid())
  ),

  en_curso AS (
    SELECT
      t.created_by AS user_id,
      COUNT(*)                     AS tournaments_in_progress,
      COALESCE(MAX(tt.equipos), 0) AS max_teams
    FROM tournaments t
    LEFT JOIN (
      SELECT tournament_id, COUNT(*) AS equipos
      FROM tournament_teams
      GROUP BY tournament_id
    ) tt ON tt.tournament_id = t.id
    WHERE t.status = 'in-progress'
    GROUP BY t.created_by
  ),

  partidos AS (
    SELECT t.created_by AS user_id, COUNT(*) AS matches_with_result
    FROM matches m
    JOIN tournaments t ON t.id = m.tournament_id
    WHERE m.status = 'completed'
      AND (m.home_score IS NOT NULL OR m.away_score IS NOT NULL
           OR m.walkover IS TRUE)
      AND m.updated_at >= v_from
      AND m.updated_at <  v_to
    GROUP BY t.created_by
  ),

  audiencia AS (
    SELECT
      t.created_by AS user_id,
      COUNT(DISTINCT (pv.visitor_id, co_day(pv.created_at))) AS person_days,
      COUNT(DISTINCT co_day(pv.created_at))                  AS active_days
    FROM page_views pv
    JOIN tournaments t ON t.id = pv.entity_id
    WHERE pv.entity_type = 'tournament'
      AND pv.visitor_id IS NOT NULL
      AND pv.is_authenticated IS NOT TRUE
      AND pv.created_at >= v_from
      AND pv.created_at <  v_to
    GROUP BY t.created_by
  ),

  base AS (
    SELECT
      o.user_id,
      COALESCE(op.organization_name, u.name) AS organizer_name,
      COALESCE(u.revenue_share_excluded, false) AS excluded,
      EXTRACT(day FROM (now() - u.created_at))::int AS account_age_days,
      (op.organization_name IS NOT NULL AND op.logo_url IS NOT NULL)
        AS profile_complete,
      (pi.user_id IS NOT NULL) AS payout_info_complete,
      (pi.approval_status = 'approved') AS payout_approved,
      COALESCE(pi.approval_status, 'missing') AS payout_status,
      pi.rejection_reason,
      COALESCE(ec.tournaments_in_progress, 0) AS tournaments_in_progress,
      COALESCE(ec.max_teams, 0)               AS max_teams,
      COALESCE(pa.matches_with_result, 0)     AS matches_with_result,
      COALESCE(au.person_days, 0)             AS person_days,
      COALESCE(au.active_days, 0)             AS active_days
    FROM orgs o
    JOIN users u                        ON u.id = o.user_id
    LEFT JOIN organization_profiles op  ON op.user_id = o.user_id
    LEFT JOIN organizer_payout_info pi  ON pi.user_id = o.user_id
    LEFT JOIN en_curso ec               ON ec.user_id = o.user_id
    LEFT JOIN partidos pa               ON pa.user_id = o.user_id
    LEFT JOIN audiencia au              ON au.user_id = o.user_id
  ),

  evaluado AS (
    SELECT
      b.*,
      (b.tournaments_in_progress >= v_cfg.min_tournaments_in_progress
        AND b.max_teams >= v_cfg.min_teams) AS lvl1,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN b.matches_with_result < v_cfg.min_matches_with_result
             THEN 'matches_with_result' END,
        CASE WHEN b.person_days < v_cfg.min_person_days
             THEN 'person_days' END,
        CASE WHEN b.active_days < v_cfg.min_active_days
             THEN 'active_days' END,
        CASE WHEN b.account_age_days < v_cfg.min_account_age_days
             THEN 'account_age_days' END,
        CASE WHEN v_cfg.require_profile AND NOT b.profile_complete
             THEN 'profile' END,
        CASE WHEN NOT b.payout_info_complete
             THEN 'payout_info' END,
        CASE WHEN b.payout_info_complete AND NOT b.payout_approved
             THEN 'payout_approval' END,
        CASE WHEN b.excluded THEN 'excluded' END
      ], NULL) AS missing
    FROM base b
  ),

  final AS (
    SELECT
      e.user_id AS organizer_id,
      e.organizer_name,
      e.excluded,
      e.person_days,
      e.active_days,
      e.matches_with_result,
      e.max_teams,
      e.tournaments_in_progress,
      e.account_age_days,
      e.profile_complete,
      e.payout_info_complete,
      e.payout_approved,
      e.payout_status,
      e.rejection_reason,
      e.missing,
      CASE
        WHEN e.lvl1 AND cardinality(e.missing) = 0 THEN 2
        WHEN e.lvl1 THEN 1
        ELSE 0
      END AS level,
      (e.lvl1 AND cardinality(e.missing) = 0) AS eligible
    FROM evaluado e
  )

  SELECT json_build_object(
    'month', v_month,
    'config', row_to_json(v_cfg),
    'organizers', (
      SELECT COALESCE(json_agg(row_to_json(f) ORDER BY f.level DESC,
                               f.person_days DESC), '[]'::json)
      FROM final f
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_monetization_status(DATE) TO authenticated;

-- ============================================================
-- Lo que NO toca esta migración
-- ============================================================
-- Las funciones de analítica del organizador (`20260720`, `20260720b`,
-- `20260720c`) siguen agrupando sus gráficas diarias por `created_at::date`, o
-- sea por día UTC. No alimentan plata ni umbrales —son las curvas de visitas que
-- ve el organizador— así que quedan para otra pasada. Cuando se corrijan, usar
-- `co_day()`.

-- ============================================================
-- Comprobación
-- ============================================================
-- El corte del día tiene que caer a la medianoche de Bogotá:
--
--   select co_day('2026-08-08 23:30:00-05'::timestamptz),  -- 2026-08-08
--          co_day('2026-08-09 00:30:00-05'::timestamptz);  -- 2026-08-09
--
-- Antes, las dos daban 2026-08-09 (04:30 y 05:30 UTC).
--
-- Y para ver cuánto cambia en tus datos reales, comparar el antes y el después:
--
--   select
--     count(distinct (visitor_id, created_at::date)) as utc,
--     count(distinct (visitor_id, co_day(created_at))) as colombia
--   from analytics_events
--   where event_type = 'ad_impression' and visitor_id is not null;
--
-- `colombia` debe dar igual o MENOR: lo que se corrige es un inflado.
