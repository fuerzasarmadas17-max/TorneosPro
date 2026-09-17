-- ============================================================================
-- Corte mensual congelado del reparto de publicidad
-- ----------------------------------------------------------------------------
-- Hasta ahora el reparto se calculaba EN VIVO. Está bien para que el admin
-- mire, pero es una bomba en el momento en que el organizador vea el número:
-- entra el día 12 y ve $40.000; siguen entrando personas-día de otros
-- organizadores, su porcentaje baja; el admin abre el panel el día 20 y ve
-- $31.000. Los dos números están bien calculados, pero él vio uno y el admin
-- ve otro, y con plata de por medio esa conversación no termina bien.
--
-- Dos tablas:
--
--   ad_period_revenue  qué se le cobró a cada campaña ese mes. Hoy el panel
--                      precarga `monthly_price` y deja corregirlo, pero esa
--                      corrección vivía en la memoria del componente y se
--                      perdía al recargar. Congelar sin esto habría tomado el
--                      precio de lista y perdido los ajustes (ej. una campaña
--                      que arrancó el día 20 y cobró un tercio).
--
--   ad_settlements     el corte cerrado, por organizador y mes. Inmutable en
--                      todo lo que es plata; solo el estado de cobro se mueve.
--
-- ad_period_revenue es además el lugar natural donde después se conecta
-- `ad_payments`, cuando se decida si la fuente definitiva es lo facturado o lo
-- efectivamente recaudado. No es trabajo extra, es el mismo en orden correcto.

-- ============================================================
-- 1. Cobro por campaña y período
-- ============================================================

CREATE TABLE IF NOT EXISTS ad_period_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  -- Primer día del mes liquidado. Se guarda el mes y no un rango arbitrario
  -- porque el corte es mensual: un rango libre haría imposible saber si un mes
  -- ya está cerrado.
  period_month DATE NOT NULL,
  amount_cop INT NOT NULL CHECK (amount_cop >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT period_is_first_of_month
    CHECK (period_month = date_trunc('month', period_month)::date),
  CONSTRAINT one_amount_per_campaign_month UNIQUE (campaign_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_ad_period_revenue_month
  ON ad_period_revenue (period_month);

-- ============================================================
-- 2. Corte cerrado por organizador
-- ============================================================

CREATE TABLE IF NOT EXISTS ad_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month DATE NOT NULL,
  organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- ---- Congelado: lo que se le prometió y por qué ----
  -- Suma de sus personas-día sobre las campañas donde aportó. NO es un
  -- COUNT(DISTINCT) global: cada campaña reparte con su propio denominador, y
  -- esto es la suma de las celdas campaña × organizador. Se guarda para poder
  -- explicarle de dónde salió el monto.
  person_days INT NOT NULL CHECK (person_days >= 0),
  amount_cop INT NOT NULL CHECK (amount_cop >= 0),
  -- Detalle por campaña: [{campaign_id, person_days, share, amount_cop}].
  -- Es la auditoría: sin esto, un total sin desglose es indefendible cuando el
  -- organizador pregunta de dónde salió.
  breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- ---- Estado de la cuenta de cobro ----
  status TEXT NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued', 'approved', 'paid', 'void')),
  paid_at TIMESTAMPTZ,
  notes TEXT,

  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT period_is_first_of_month
    CHECK (period_month = date_trunc('month', period_month)::date),
  CONSTRAINT one_settlement_per_organizer_month UNIQUE (period_month, organizer_id)
);

CREATE INDEX IF NOT EXISTS idx_ad_settlements_month
  ON ad_settlements (period_month);
CREATE INDEX IF NOT EXISTS idx_ad_settlements_organizer
  ON ad_settlements (organizer_id, period_month);

-- ------------------------------------------------------------
-- Inmutabilidad de la plata
-- ------------------------------------------------------------
-- "Inmutable" tiene que ser una regla de la base, no una intención. Sin esto,
-- un bug o un UPDATE apurado desde el dashboard cambia una cifra que el
-- organizador ya vio, y no queda rastro de que cambió.
--
-- Lo que SÍ se puede mover: status, paid_at, notes, updated_at. El resto no.
CREATE OR REPLACE FUNCTION ad_settlements_freeze()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.period_month  IS DISTINCT FROM OLD.period_month
     OR NEW.organizer_id IS DISTINCT FROM OLD.organizer_id
     OR NEW.person_days  IS DISTINCT FROM OLD.person_days
     OR NEW.amount_cop   IS DISTINCT FROM OLD.amount_cop
     OR NEW.breakdown    IS DISTINCT FROM OLD.breakdown
     OR NEW.closed_at    IS DISTINCT FROM OLD.closed_at
  THEN
    RAISE EXCEPTION
      'ad_settlements es inmutable en las cifras: solo se puede cambiar status, paid_at y notes. Para corregir un corte hay que anularlo (status = void) y cerrar el mes de nuevo.';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ad_settlements_freeze ON ad_settlements;
CREATE TRIGGER trg_ad_settlements_freeze
  BEFORE UPDATE ON ad_settlements
  FOR EACH ROW EXECUTE FUNCTION ad_settlements_freeze();

-- ============================================================
-- 3. RLS: solo admin
-- ============================================================
-- El organizador todavía NO lee esta tabla: la sección "Monetizar" no existe.
-- Cuando exista habrá que agregarle una policy de lectura de lo propio
-- (organizer_id = auth.uid()), no antes — mostrarle cifras sin la sección
-- armada es filtrar plata a medias.

ALTER TABLE ad_period_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_settlements    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gestiona ad_period_revenue" ON ad_period_revenue;
CREATE POLICY "Admin gestiona ad_period_revenue"
  ON ad_period_revenue FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin gestiona ad_settlements" ON ad_settlements;
CREATE POLICY "Admin gestiona ad_settlements"
  ON ad_settlements FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- 4. Cerrar un mes
-- ============================================================
-- El CLIENTE calcula y esta función VALIDA y congela.
--
-- Por qué así y no calculando todo en SQL: el reparto por residuo mayor ya
-- vive en `lib/ad-analytics.ts`, probado contra el ejemplo del plan y contra
-- montos que descuadran con redondeo ingenuo. Reimplementarlo acá crearía dos
-- versiones de la misma matemática de plata que tendrían que coincidir para
-- siempre — el peor tipo de duplicación que se puede tener.
--
-- Para que "el cliente calcula" no signifique "el cliente manda lo que
-- quiera", esta función RE-DERIVA las personas-día desde `analytics_events` y
-- rechaza el cierre si no coinciden con lo que le mandaron. Y verifica que el
-- total no exceda la bolsa que sale de `ad_period_revenue`. Así lo que se
-- congela no puede ser una cifra inventada ni una cifra vieja.
--
-- p_rows: [{organizer_id, person_days, amount_cop, breakdown}]

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

  -- No se cierra un mes que todavía corre: las personas-día seguirían subiendo
  -- después de congelar y el corte quedaría por debajo de lo real.
  IF p_month >= date_trunc('month', now())::date THEN
    RAISE EXCEPTION 'No se puede cerrar % porque el mes no ha terminado.', p_month;
  END IF;

  IF EXISTS (
    SELECT 1 FROM ad_settlements
    WHERE period_month = p_month AND status <> 'void'
  ) THEN
    RAISE EXCEPTION 'El período % ya está cerrado. Anular los cortes (status = void) antes de volver a cerrar.', p_month;
  END IF;

  v_from := p_month::timestamptz;
  v_to   := (p_month + interval '1 month')::timestamptz;

  -- Bolsa del período: la mitad de lo cobrado por las campañas con audiencia.
  -- 0.5 está duplicado respecto a ORGANIZER_SHARE en el cliente; si cambia,
  -- cambia en los dos lados. Se valida acá porque es el techo de lo que se
  -- puede prometer.
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

  -- Personas-día reales por organizador en el mes, sumadas por campaña — el
  -- mismo criterio que usa el reparto: cada celda campaña × organizador con su
  -- propio COUNT(DISTINCT), y después se suman las celdas.
  --
  -- Solo se validan los organizadores que MANDARON. Que la base tenga uno que
  -- no vino en p_rows es legítimo: es el no elegible, cuya parte queda con la
  -- plataforma y no genera corte.
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
        COUNT(DISTINCT (e.visitor_id, e.created_at::date)) AS person_days
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

COMMENT ON TABLE ad_period_revenue IS
  'Lo que se le cobró a cada campaña en un mes. Precargado de monthly_price pero corregible: una campaña que arrancó a mitad de mes cobra menos. Es la base de la bolsa del corte.';
COMMENT ON TABLE ad_settlements IS
  'Corte mensual CONGELADO del reparto, por organizador. Inmutable en las cifras (trigger): solo se mueve status/paid_at/notes. Para corregir hay que anular (void) y cerrar de nuevo.';
COMMENT ON FUNCTION close_ad_period(DATE, JSONB) IS
  'Congela el reparto de un mes terminado. El cliente calcula (la matemática vive en lib/ad-analytics.ts) y esta función valida: re-deriva personas-día desde analytics_events y verifica que el total no exceda la bolsa.';
