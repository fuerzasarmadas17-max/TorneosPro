-- ============================================================================
-- Torneos fiados: la deuda y sus abonos contra el reparto de publicidad
-- ----------------------------------------------------------------------------
-- Paso 1 de la Fase 1 de `Por hacer/deuda-contra-publicidad.md`.
--
-- QUÉ RESUELVE
-- Cuando se le fía un torneo a un organizador, ese torneo queda debiendo su
-- precio de lista. Lo que el organizador gana en el reparto de publicidad va
-- abonando esa deuda, y se le transfiere la diferencia.
--
-- ⚠️ ESTA MIGRACIÓN NO CAMBIA NADA DE LO QUE YA FUNCIONA.
-- Es puramente aditiva: crea dos tablas y una función nuevas. No toca
-- `tournaments`, `coupons`, `payments`, `ad_settlements`, `ad_period_revenue`
-- ni ninguna función existente. Nadie ve nada distinto hasta que se construya
-- la interfaz. Para revertir: `DROP TABLE` de las dos y listo.
--
-- ----------------------------------------------------------------------------
-- POR QUÉ LA DEUDA SE MARCA Y NO SE DEDUCE
-- ----------------------------------------------------------------------------
-- Sería tentador decir "todo torneo con cupón de cortesía es una deuda". Se
-- probó contra producción el 2026-08-25 y no sirve: de 16 torneos con bono del
-- 100% vigente, el dueño revisó uno por uno y **solo uno era deuda real**. Los
-- otros 15 eran regalos, y en la base son idénticos.
--
-- Un cupón de cortesía significa "no pagó", que no es lo mismo que "me debe".
-- No hay ninguna columna que los separe, así que la deuda se crea a propósito
-- en el momento de fiar.
--
-- ----------------------------------------------------------------------------
-- POR QUÉ UNA TABLA APARTE Y NO UNA COLUMNA EN `tournaments`
-- ----------------------------------------------------------------------------
-- Porque la policy "Creador edita torneo" deja que el organizador actualice su
-- propio torneo. Una columna `es_fiado` ahí sería **editable por el deudor**:
-- le bastaría un UPDATE desde el navegador para borrarse la deuda.
--
-- Acá la escritura es solo de admin, y el organizador únicamente lee lo suyo.
--
-- ----------------------------------------------------------------------------
-- POR QUÉ EL MONTO NO SE GUARDA
-- ----------------------------------------------------------------------------
--   saldo = tournaments.price − Σ abonos
--
-- `tournaments.price` de un torneo de cortesía es su precio de LISTA, y
-- `add-teams-dialog` lo reescribe cuando el torneo sube de plan. O sea que la
-- deuda sube sola con el upgrade, que es exactamente lo que se decidió:
-- el upgrade se le deja gratis porque esa plata se cobra igual, por la deuda.
--
-- Guardar el monto obligaría a mantenerlo sincronizado con el precio a mano.
-- Dos números que tienen que coincidir para siempre es la peor forma de llevar
-- una cuenta de plata.

-- ============================================================
-- 1. Qué torneos están fiados
-- ============================================================

CREATE TABLE IF NOT EXISTS tournament_debts (
  -- PK sobre el torneo: un torneo se fía una sola vez. Sin esto, dos clicks
  -- crean dos deudas por el mismo torneo y el organizador paga doble.
  tournament_id UUID PRIMARY KEY REFERENCES tournaments(id) ON DELETE CASCADE,

  -- Derivable de `tournaments.created_by`, pero se guarda igual: es un
  -- registro de plata y tiene que decir a quién se le fió, aunque el torneo
  -- cambie de manos algún día. Mismo criterio que `ad_settlements`.
  organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Por qué se fió. Se lee cuando alguien pregunte, meses después, por qué
  -- este torneo debe y los otros 15 de cortesía no.
  note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tournament_debts_organizer
  ON tournament_debts (organizer_id);

-- ============================================================
-- 2. Los abonos
-- ============================================================

CREATE TABLE IF NOT EXISTS tournament_debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tournament_id UUID NOT NULL
    REFERENCES tournament_debts(tournament_id) ON DELETE CASCADE,
  organizer_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- De qué corte salió. NULL = ajuste a mano fuera de un cierre.
  period_month DATE,

  amount_cop INT NOT NULL CHECK (amount_cop > 0),

  -- Por qué este monto y no otro. Importa porque el monto lo decide una
  -- persona caso por caso: sin el motivo, dentro de tres meses no hay forma de
  -- responder "¿por qué a él le descontaste menos que a mí?".
  note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT period_is_first_of_month
    CHECK (period_month IS NULL OR period_month = date_trunc('month', period_month)::date)
);

CREATE INDEX IF NOT EXISTS idx_debt_payments_tournament
  ON tournament_debt_payments (tournament_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_organizer_month
  ON tournament_debt_payments (organizer_id, period_month);

-- ------------------------------------------------------------
-- El candado: no se puede abonar más de lo que se debe
-- ------------------------------------------------------------
-- Tiene que ser una regla de la base y no una validación de pantalla. Un abono
-- de más le cobra al organizador plata que no debe, y es el tipo de error que
-- nadie nota hasta que él lo reclama.
--
-- El otro tope —que la suma de los abonos del mes no pase de lo que ganó ese
-- mes— no se puede validar acá: depende del corte, que se calcula al cerrar.
-- Va en el cierre.
CREATE OR REPLACE FUNCTION tournament_debt_payment_check()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_price INT;
  v_otros INT;
BEGIN
  SELECT t.price INTO v_price
  FROM tournaments t WHERE t.id = NEW.tournament_id;

  IF v_price IS NULL OR v_price <= 0 THEN
    RAISE EXCEPTION
      'El torneo % no tiene precio de lista cargado, así que no se sabe cuánto debe.',
      NEW.tournament_id;
  END IF;

  SELECT COALESCE(SUM(p.amount_cop), 0) INTO v_otros
  FROM tournament_debt_payments p
  WHERE p.tournament_id = NEW.tournament_id
    AND p.id IS DISTINCT FROM NEW.id;

  IF v_otros + NEW.amount_cop > v_price THEN
    RAISE EXCEPTION
      'El abono de % deja el saldo en negativo: el torneo vale % y ya lleva % abonado (quedan %).',
      NEW.amount_cop, v_price, v_otros, v_price - v_otros;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_debt_payment_check ON tournament_debt_payments;
CREATE TRIGGER trg_debt_payment_check
  BEFORE INSERT OR UPDATE ON tournament_debt_payments
  FOR EACH ROW EXECUTE FUNCTION tournament_debt_payment_check();

-- ============================================================
-- 3. RLS
-- ============================================================
-- Escribe solo el admin. El organizador lee lo suyo y nada más: tiene que
-- poder ver su saldo bajar, que es lo único que lo mantiene enganchado.

ALTER TABLE tournament_debts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_debt_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gestiona las deudas" ON tournament_debts;
CREATE POLICY "Admin gestiona las deudas"
  ON tournament_debts FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "El organizador ve su deuda" ON tournament_debts;
CREATE POLICY "El organizador ve su deuda"
  ON tournament_debts FOR SELECT
  USING (organizer_id = auth.uid());

DROP POLICY IF EXISTS "Admin gestiona los abonos" ON tournament_debt_payments;
CREATE POLICY "Admin gestiona los abonos"
  ON tournament_debt_payments FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "El organizador ve sus abonos" ON tournament_debt_payments;
CREATE POLICY "El organizador ve sus abonos"
  ON tournament_debt_payments FOR SELECT
  USING (organizer_id = auth.uid());

-- ============================================================
-- 4. El saldo
-- ============================================================
-- Un admin sin argumento ve todas las deudas (lo que necesita el cierre).
-- Un organizador ve solo la suya, se lo pida como se lo pida.

CREATE OR REPLACE FUNCTION get_tournament_debts(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  tournament_id   UUID,
  tournament_name TEXT,
  organizer_id    UUID,
  organizer_name  TEXT,
  price_cop       INT,
  paid_cop        BIGINT,
  balance_cop     BIGINT,
  note            TEXT,
  created_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_filter   UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
    INTO v_is_admin;

  -- Un no-admin queda clavado a lo suyo aunque mande otro id.
  v_filter := CASE WHEN v_is_admin THEN p_user_id ELSE auth.uid() END;

  RETURN QUERY
  SELECT
    d.tournament_id,
    t.name,
    d.organizer_id,
    COALESCE(op.organization_name, u.name),
    t.price,
    COALESCE(ab.total, 0)::bigint,
    GREATEST(0, t.price - COALESCE(ab.total, 0))::bigint,
    d.note,
    d.created_at
  FROM tournament_debts d
  JOIN tournaments t                 ON t.id = d.tournament_id
  JOIN users u                       ON u.id = d.organizer_id
  LEFT JOIN organization_profiles op ON op.user_id = d.organizer_id
  LEFT JOIN LATERAL (
    SELECT SUM(p.amount_cop) AS total
    FROM tournament_debt_payments p
    WHERE p.tournament_id = d.tournament_id
  ) ab ON true
  WHERE (v_filter IS NULL OR d.organizer_id = v_filter)
  -- Más viejo primero: es el orden natural para saldar, y es el que el panel
  -- del cierre usa para precargar el abono sugerido.
  ORDER BY d.created_at;
END;
$$;

-- Revocar de PUBLIC se lleva puesto también a `authenticated`, que hereda de
-- ahí, así que hay que volver a concedérselo explícitamente. Sin este GRANT el
-- organizador no puede leer su propio saldo.
REVOKE ALL ON FUNCTION get_tournament_debts(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_tournament_debts(UUID) TO authenticated;

COMMENT ON TABLE tournament_debts IS
  'Qué torneos se fiaron. La marca se crea a mano al fiar: un cupón de cortesía significa "no pagó", no "me debe" (verificado 2026-08-25: 15 de 16 cortesías eran regalos). El monto no se guarda, se deriva de tournaments.price.';
COMMENT ON TABLE tournament_debt_payments IS
  'Abonos de la deuda con lo ganado en el reparto de publicidad. El monto lo decide un admin mes a mes; el trigger impide que la suma supere el precio del torneo.';
COMMENT ON FUNCTION get_tournament_debts(UUID) IS
  'Deudas con su saldo. Admin sin argumento ve todas; un organizador ve solo la suya.';
