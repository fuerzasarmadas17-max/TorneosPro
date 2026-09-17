-- ============================================================================
-- Lo que ve el organizador de su reparto de publicidad
-- ----------------------------------------------------------------------------
-- Pasos 1 y 2 del Paso 3 de `Por hacer/monetizacion-analitica-publicidad.md`.
--
-- Hasta hoy toda la analítica de publicidad era admin-only (`get_ad_analytics`
-- devuelve NULL si no sos admin) y `ad_settlements` solo la leía el admin. El
-- organizador no podía ver ni un número propio.
--
-- ----------------------------------------------------------------------------
-- LO QUE EL ORGANIZADOR NO PUEDE VER, Y POR QUÉ
-- ----------------------------------------------------------------------------
-- Se le muestra una TARIFA ("esta campaña paga $85 por persona-día"), no su
-- PORCENTAJE de la campaña. Los dos explican igual de bien de dónde salió su
-- plata, pero el porcentaje se puede invertir: monto ÷ porcentaje ÷ 50% da
-- exactamente lo que pagó el anunciante. Con la tarifa no se puede, porque le
-- faltaría la audiencia total de la campaña.
--
-- Importa porque acá los anunciantes tienen nombre y apellido y están en la
-- misma ciudad que los organizadores. YouTube se puede permitir mostrar el
-- bruto (su CPM) porque su plata viene de una subasta de miles de anunciantes y
-- no es atribuible a ninguno; esto no tiene esa escala.
--
-- Consecuencia de diseño: **esta función es de servidor, no de navegador.**
-- Devuelve los ingredientes crudos —incluida la audiencia total de la campaña y
-- lo que pagó— porque el cálculo lo hace `/api/monetizar/earnings` con
-- `lib/ad-analytics.ts`, y esa ruta le manda al navegador solo la tarifa y el
-- monto. Si esta función se le concediera a `authenticated`, el organizador
-- podría llamarla directo y saltarse ese filtro.
--
-- ----------------------------------------------------------------------------
-- POR QUÉ NO CALCULA LOS PESOS ACÁ
-- ----------------------------------------------------------------------------
-- La matemática del reparto vive en `src/lib/ad-analytics.ts`
-- (`proratedRevenue` + `computeRevenueShare`), probada contra el ejemplo del
-- plan. Reescribirla en SQL dejaría DOS versiones de la misma cuenta de plata
-- que tendrían que coincidir para siempre. Es la misma razón por la que
-- `close_ad_period` valida en vez de calcular.
--
-- Y no es teórico: `proratedRevenue` recorta el mes con límites en hora LOCAL
-- (`new Date(y, m-1, 1)`), mientras que en SQL `p_month::timestamptz` usa la
-- zona horaria de la base. Con la base en UTC y Colombia en UTC-5 son ventanas
-- corridas 5 horas — una campaña que arranca cerca del cambio de mes se
-- prorratearía distinto de cada lado.
--
-- Con la ruta de servidor se consigue lo mismo sin duplicar nada: el cálculo
-- sigue siendo el de siempre, y lo que no debe salir simplemente no sale.
--
-- ----------------------------------------------------------------------------
-- ⚠️ EL DENOMINADOR ES LA SUMA DE CELDAS, NO UN DISTINCT GLOBAL
-- ----------------------------------------------------------------------------
-- `total_person_days` es la suma de las personas-día de CADA organizador en la
-- campaña, no un COUNT(DISTINCT) sobre toda la campaña. Los dos números son
-- distintos: quien vio la misma campaña el mismo día en torneos de dos
-- organizadores cuenta dos veces en el primero y una en el segundo.
--
-- Tiene que ser la suma de celdas porque es exactamente el denominador que usa
-- `computeRevenueShare` (`cells.reduce(...)`). Si acá se devolviera el distinct
-- global —que es más chico— la tarifa saldría MÁS ALTA que la real y la
-- proyección le prometería plata que el corte no le va a pagar. Es el mismo
-- error de denominador que ya se corrigió una vez en este reparto.

-- ============================================================
-- 1. Sobre ad_settlements NO se agrega policy de lectura
-- ============================================================
-- El plan pedía una policy `organizer_id = auth.uid()`. **No se hace, a
-- propósito**, y conviene no "arreglarlo" después sin leer esto.
--
-- `ad_settlements.breakdown` guarda `share` —el porcentaje de cada campaña—
-- porque es la auditoría del corte. Una policy de lectura le daría al
-- organizador ese porcentaje sin filtro alguno, que es justo el número que se
-- decidió no mostrarle. Cerrar la puerta de adelante y dejar la de atrás
-- abierta no es cerrar nada.
--
-- Sus cortes cerrados le llegan por `/api/monetizar/earnings`, que los lee con
-- service role y le manda el monto y la tarifa, sin el porcentaje. Una sola
-- puerta, y con filtro.

-- ============================================================
-- 2. Los ingredientes de la proyección
-- ============================================================
-- Recibe el organizador por parámetro porque la llama el servidor con service
-- role, donde no hay `auth.uid()`. La guarda interna sigue igual que en
-- `20260807b_tournament_credits_grants.sql`: si algún día alguien le concede
-- permiso a `authenticated`, la función igual rechaza pedir datos ajenos.

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

  -- Cada quien lo suyo. El service_role pasa porque la ruta del servidor ya
  -- verificó de quién es la sesión con `requireUser`.
  IF auth.uid() IS DISTINCT FROM p_user_id AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'No podés consultar el reparto de otra cuenta';
  END IF;

  -- Por defecto el mes en curso, igual que `get_monetization_status`.
  v_month := COALESCE(date_trunc('month', p_month)::date,
                      date_trunc('month', now())::date);

  -- Misma ventana que usa `close_ad_period` al re-derivar las personas-día. Si
  -- algún día se corrige la zona horaria del corte, hay que corregirla acá
  -- también o la proyección y el corte dejarían de coincidir.
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

  -- Celda campaña × organizador: cada una con su propio COUNT(DISTINCT).
  -- Igual que `by_campaign_organizer` en get_ad_analytics.
  cells AS (
    SELECT
      ev.campaign_id,
      ev.organizer_id,
      COUNT(DISTINCT (ev.visitor_id, ev.day)) AS person_days
    FROM ev
    GROUP BY ev.campaign_id, ev.organizer_id
  ),

  -- El denominador: la suma de las celdas (ver la nota del encabezado).
  -- `person_days > 0` replica el filtro de computeRevenueShare, que descarta
  -- las celdas vacías antes de sumar.
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

  -- En qué torneos MÍOS salió cada campaña. Solo los propios: es el desglose
  -- que responde "¿de dónde salió este número?", no una ventana a los demás.
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

  -- Lo efectivamente COBRADO por campaña: solo pagos aprobados, sumados (una
  -- renovación son dos pagos). Mismo criterio que el panel de admin: el precio
  -- de lista repartiría plata que quizá nunca entró.
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
          m.person_days                          AS my_person_days,
          d.total_person_days,
          COALESCE(p.paid_cop, 0)::bigint        AS paid_cop,
          -- Si el admin ya corrigió a mano lo cobrado de ese mes, ese valor
          -- manda sobre el prorrateo. Es la misma precedencia del panel
          -- (`valueOf` en ad-revenue-share.tsx), para que las dos pantallas
          -- muestren el mismo número y no haya dos verdades.
          r.amount_cop                           AS revenue_override_cop,
          COALESCE((
            SELECT json_agg(row_to_json(t) ORDER BY t.person_days DESC)
            FROM (
              SELECT tournament_id, tournament_name, person_days
              FROM my_tournaments mt
              WHERE mt.campaign_id = m.campaign_id
            ) t
          ), '[]'::json)                         AS tournaments
        -- ⚠️ `analytics_events.target_id` es TEXT, pero `ad_campaigns.id`,
        -- `ad_payments.campaign_id` y `ad_period_revenue.campaign_id` son UUID.
        -- Sin el `::text` del lado UUID, Postgres corta con
        -- "operator does not exist: uuid = text".
        --
        -- Se castea el UUID a texto y no al revés a propósito: `target_id` es
        -- texto libre y guarda el objetivo de cualquier tipo de evento. Un
        -- `::uuid` sobre una fila que no sea un id de campaña reventaría la
        -- función entera, y sería un dato viejo o de otro evento el que la
        -- tumbe. Estas tablas son chicas, así que perder el índice no importa.
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

-- ------------------------------------------------------------
-- Permisos: SOLO el servidor
-- ------------------------------------------------------------
-- `authenticated` queda FUERA a propósito: esta función devuelve la audiencia
-- total de cada campaña y lo que pagó el anunciante, que es exactamente lo que
-- el organizador no debe poder leer. Le llega filtrado por
-- /api/monetizar/earnings.
--
-- Se nombra a `anon` y a `authenticated` explícitamente porque Supabase les
-- concede EXECUTE por `ALTER DEFAULT PRIVILEGES`, no a través de PUBLIC:
-- revocarle a PUBLIC no les quita el suyo. (Lección de 20260807b.)
REVOKE ALL ON FUNCTION get_my_ad_earnings(UUID, DATE)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_my_ad_earnings(UUID, DATE) TO service_role;

COMMENT ON FUNCTION get_my_ad_earnings(UUID, DATE) IS
  'Ingredientes del reparto de UN organizador en un mes. SOLO service_role: devuelve la audiencia total de cada campaña y lo cobrado, que el organizador no debe ver. /api/monetizar/earnings calcula con lib/ad-analytics.ts y le manda solo tarifa y monto. total_person_days es la SUMA de celdas campaña x organizador, el denominador real de computeRevenueShare.';

-- ============================================================
-- Comprobación
-- ============================================================
-- Con la llave ANÓNIMA y con la de un organizador logueado, las dos deben
-- fallar por permisos (ya no responder 200):
--   select get_my_ad_earnings('<cualquier_user_id>', '2026-08-01');
--
-- Y `ad_settlements` sigue sin devolverle nada a un organizador:
--   select * from ad_settlements;   -- 0 filas
--
-- Para confirmar que el denominador coincide con el del panel de admin,
-- comparar `total_person_days` de una campaña contra la suma de la columna
-- personas-día de esa campaña en el reparto de /admin/ads.
