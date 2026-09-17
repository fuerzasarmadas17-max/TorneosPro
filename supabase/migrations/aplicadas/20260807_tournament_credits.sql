-- ============================================================================
-- Paquetes de torneos (créditos prepagos)
-- ----------------------------------------------------------------------------
-- Diseño completo en `Por hacer/paquetes-de-torneos.md`.
--
-- El organizador compra un paquete de 5 torneos por $320.000 (cada crédito
-- cubre torneos de hasta 24 equipos) y los va usando de a uno. Nace de un caso
-- real: un organizador compró 4 torneos en una sola sentada, pagando precio de
-- lista las 4 veces, en transacciones separadas.
--
-- ⚠️ ESTA MIGRACIÓN SOLA NO HABILITA NADA
-- Crea el almacén y el candado del consumo. La compra, el uso y —sobre todo—
-- la contabilidad van después. NO vender un paquete hasta que Negocios sepa
-- contarlo: hoy `paymentMap` salta los pagos sin `tournament_id`, así que el
-- primer paquete haría que la gráfica mensual y la tarjeta de "Ingreso por
-- torneos" muestren números distintos del mismo dinero, sin dar error.
--
-- POR QUÉ UNA FILA POR CRÉDITO Y NO UN CONTADOR
-- Tres razones, en orden de importancia:
--   1. El consumo se puede reclamar atómicamente (ver `consume_tournament_credit`).
--      Con un contador, dos pestañas abiertas gastan dos créditos en un torneo.
--   2. Cada crédito deja rastro de en qué torneo se usó.
--   3. Cada uno carga su propio valor, que es lo que permite auditar la
--      contabilidad después.
-- Es el mismo criterio que ya usa la tabla `coupons`.
--
-- POR QUÉ NO SE REUSARON LOS CUPONES
-- Tentador —el checkout ya sabe aplicarlos— pero un cupón `free_tournament`
-- deja el torneo marcado como cortesía y Finanzas lo muestra en $0. Es
-- exactamente el problema que hoy se arregla a mano (ver `pago-duvan.md`),
-- multiplicado por cinco.

CREATE TABLE IF NOT EXISTS tournament_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- De qué compra salió. Un paquete de 5 son 5 filas con el mismo payment_id.
  -- Sirve para reconstruir "qué paquete compró" sin una tabla aparte.
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,

  -- Lo que costó este crédito ($64.000 = 320.000 / 5).
  --
  -- NO se le suma al torneo como ingreso: el dinero ya se contó al cobrar el
  -- paquete (decisión 2026-08-07, contabilidad de caja). Contarlo dos veces
  -- inflaría el año. Sirve para dos cosas: avisarle al organizador cuándo NO le
  -- conviene gastar un crédito (un torneo de $40.000 vale menos que el
  -- crédito), y poder repartir el monto más adelante si los paquetes pasan a
  -- ser la mayoría de las ventas.
  value_cop INT NOT NULL CHECK (value_cop >= 0),

  -- Techo de equipos que cubre el crédito, CONGELADO al comprar. Si mañana
  -- cambia la oferta, los créditos ya vendidos conservan sus condiciones.
  max_teams INT NOT NULL CHECK (max_teams > 0),

  expires_at TIMESTAMPTZ NOT NULL,

  -- NULL = disponible. Los dos se llenan juntos al consumir.
  consumed_at TIMESTAMPTZ,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Un crédito consumido tiene que decir en qué torneo. La única excepción es
  -- que ese torneo se borre después (ON DELETE SET NULL), y en ese caso el
  -- crédito NO se libera: ya se usó.
  CONSTRAINT credit_consumed_has_date CHECK (
    tournament_id IS NULL OR consumed_at IS NOT NULL
  )
);

COMMENT ON TABLE tournament_credits IS
  'Créditos prepagos de torneo (paquetes). Una fila por crédito. Ver Por hacer/paquetes-de-torneos.md.';

-- Un torneo no puede haber consumido dos créditos. Es la red de seguridad
-- contra un doble consumo que se le escape a la función de abajo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_credits_one_per_tournament
  ON tournament_credits (tournament_id)
  WHERE tournament_id IS NOT NULL;

-- La consulta caliente: "¿qué créditos usables tiene esta persona?". Índice
-- parcial porque los consumidos no se preguntan nunca por esta vía.
CREATE INDEX IF NOT EXISTS idx_credits_available
  ON tournament_credits (user_id, expires_at)
  WHERE consumed_at IS NULL;

-- Para el corte contable: cuántos créditos salieron de cada compra.
CREATE INDEX IF NOT EXISTS idx_credits_payment
  ON tournament_credits (payment_id);

-- ============================================================
-- Permisos
-- ============================================================
-- El organizador LEE los suyos y nada más. No los crea (los crea el webhook al
-- aprobarse el pago, con service_role) ni los consume por su cuenta (eso pasa
-- por la función de abajo). Si pudiera escribir, se regalaría créditos.

ALTER TABLE tournament_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "El organizador ve sus créditos" ON tournament_credits;
CREATE POLICY "El organizador ve sus créditos"
  ON tournament_credits FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin ve todos los créditos" ON tournament_credits;
CREATE POLICY "Admin ve todos los créditos"
  ON tournament_credits FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

-- ============================================================
-- Consumo atómico
-- ============================================================
-- Reclama UN crédito disponible y lo ata a un torneo.
--
-- El `FOR UPDATE SKIP LOCKED` es el punto de todo esto: sin él, dos pestañas
-- creando un torneo a la vez leen el mismo crédito libre y las dos creen
-- haberlo tomado. Con él, la segunda salta al siguiente disponible o se queda
-- sin ninguno — que es la respuesta correcta.
--
-- Gasta primero el que VENCE ANTES. Es lo que le conviene al organizador y
-- evita que se le pierdan créditos por orden de uso.
--
-- Devuelve el id del crédito consumido, o NULL si no había ninguno usable.
-- Quien llame DEBE tratar el NULL como "no se pudo" y no crear el torneo igual.

CREATE OR REPLACE FUNCTION consume_tournament_credit(
  p_user_id       UUID,
  p_tournament_id UUID,
  p_team_count    INT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_id UUID;
BEGIN
  -- Solo el dueño puede gastar sus créditos. El service_role pasa porque las
  -- rutas del servidor ya verificaron quién es.
  IF auth.uid() IS DISTINCT FROM p_user_id AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'No podés consumir créditos de otra cuenta';
  END IF;

  UPDATE tournament_credits
  SET    consumed_at   = now(),
         tournament_id = p_tournament_id
  WHERE  id = (
    SELECT id
    FROM   tournament_credits
    WHERE  user_id     = p_user_id
      AND  consumed_at IS NULL
      AND  expires_at  > now()
      AND  max_teams  >= p_team_count
    ORDER  BY expires_at ASC
    LIMIT  1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id INTO v_credit_id;

  RETURN v_credit_id;  -- NULL si no había crédito usable
END;
$$;

COMMENT ON FUNCTION consume_tournament_credit IS
  'Reclama atómicamente un crédito disponible y lo ata a un torneo. Devuelve NULL si no hay ninguno usable — el llamador NO debe crear el torneo en ese caso.';

REVOKE ALL ON FUNCTION consume_tournament_credit(UUID, UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_tournament_credit(UUID, UUID, INT) TO authenticated, service_role;

-- ============================================================
-- Cuántos créditos usables tiene una cuenta
-- ============================================================
-- Para la franja de "Crear torneo" y para el diálogo de pago. Va como función
-- y no como consulta suelta para que el criterio de "usable" —no consumido, no
-- vencido, y que cubra el tamaño— viva en un solo lugar.

CREATE OR REPLACE FUNCTION available_tournament_credits(
  p_user_id    UUID,
  p_team_count INT DEFAULT 1
)
RETURNS TABLE (total INT, next_expiry TIMESTAMPTZ, max_teams INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::INT              AS total,
    MIN(c.expires_at)          AS next_expiry,
    COALESCE(MAX(c.max_teams), 0)::INT AS max_teams
  FROM tournament_credits c
  WHERE c.user_id     = p_user_id
    AND c.consumed_at IS NULL
    AND c.expires_at  > now()
    AND c.max_teams  >= p_team_count;
$$;

REVOKE ALL ON FUNCTION available_tournament_credits(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION available_tournament_credits(UUID, INT) TO authenticated, service_role;

-- ============================================================
-- Comprobación
-- ============================================================
-- 1. La tabla existe y está vacía:
--      select count(*) from tournament_credits;   -- 0
--
-- 2. Un organizador sin créditos:
--      select * from available_tournament_credits('<user_id>', 12);
--      -- total = 0, next_expiry = null
--
-- 3. Consumir sin créditos devuelve NULL (no explota):
--      select consume_tournament_credit('<user_id>', '<tournament_id>', 12);
--      -- null
--
-- 4. Con la sesión de OTRO organizador, consumir créditos ajenos debe fallar:
--      select consume_tournament_credit('<otro_user_id>', '<t>', 12);
--      -- ERROR: No podés consumir créditos de otra cuenta
