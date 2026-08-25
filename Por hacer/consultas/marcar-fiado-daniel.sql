-- ============================================================================
-- Paso 2: marcar como fiado el único torneo que debe
-- ----------------------------------------------------------------------------
-- Correr DESPUÉS de la migración `20260825_deuda_torneos_fiados.sql`.
--
-- El torneo es el de Daniel Rodríguez, cupón TQ7RGE39, $70.000. Se identifica
-- por el CÓDIGO DE CUPÓN y no por el nombre: el organizador ya le cambió el
-- nombre una vez (era "SANTO COFFEE MASCULINO 🏐🏆🔥 SENIOR", hoy es
-- "MASCULINO 1 🏐🏆🔥 2edicion 2026"), así que el nombre no es un
-- identificador confiable.
--
-- Reversible: `DELETE FROM tournament_debts WHERE tournament_id = '...'`.

-- ---------------------------------------------------------------------------
-- PASO A — Mirá qué se va a marcar, ANTES de marcarlo
-- ---------------------------------------------------------------------------
-- Tiene que salir UNA fila, con el nombre que esperás y precio 70000.

SELECT t.id, t.name, t.price, t.tier, t.plan, t.created_at::date AS creado,
       u.email, c.code AS cupon
FROM   tournaments t
JOIN   coupons c ON c.id = t.coupon_id
JOIN   users u   ON u.id = t.created_by
WHERE  c.code = 'TQ7RGE39';

-- ---------------------------------------------------------------------------
-- PASO B — Marcarlo
-- ---------------------------------------------------------------------------
-- El SELECT de adentro es el mismo candado del paso A: si el cupón no existe o
-- no está atado a un torneo, no inserta nada en vez de insertar algo raro.

INSERT INTO tournament_debts (tournament_id, organizer_id, note, created_by)
SELECT
  t.id,
  t.created_by,
  'Fiado al crear el torneo (2026-08-19). Único fiado vigente al 2026-08-25.',
  auth.uid()
FROM   tournaments t
JOIN   coupons c ON c.id = t.coupon_id
WHERE  c.code = 'TQ7RGE39'
ON CONFLICT (tournament_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PASO C — Verificación
-- ---------------------------------------------------------------------------
-- Debe salir una fila: el torneo, saldo 70000, abonado 0.
-- (Correr como admin; la función filtra por rol.)

SELECT * FROM get_tournament_debts();

-- Y el candado del trigger, para comprobar que funciona. Esto TIENE que fallar
-- con "deja el saldo en negativo" — si pasa, el trigger no quedó instalado:
--
--   INSERT INTO tournament_debt_payments (tournament_id, organizer_id, amount_cop)
--   SELECT tournament_id, organizer_id, 999999 FROM tournament_debts;
