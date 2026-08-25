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
-- ⚠️ NO uses `SELECT * FROM get_tournament_debts()` desde el editor SQL: ahí no
-- hay sesión, `auth.uid()` da NULL y la función devuelve cero filas aunque todo
-- esté bien. Esa función es para el navegador, con el admin logueado.
--
-- Desde el editor, la misma cuenta a mano. Debe salir UNA fila:
-- precio 70000, abonado 0, saldo 70000.

SELECT
  t.name                                        AS torneo,
  u.email,
  t.price                                       AS precio,
  COALESCE(SUM(p.amount_cop), 0)                AS abonado,
  t.price - COALESCE(SUM(p.amount_cop), 0)      AS saldo,
  d.created_by                                  AS marcado_por,
  d.note
FROM tournament_debts d
JOIN tournaments t                        ON t.id = d.tournament_id
JOIN users u                              ON u.id = d.organizer_id
LEFT JOIN tournament_debt_payments p      ON p.tournament_id = d.tournament_id
GROUP BY t.name, u.email, t.price, d.created_by, d.note;

-- `marcado_por` va a salir NULL, y está bien: `auth.uid()` es NULL en el editor.
-- Cuando esto se haga desde el panel va a quedar tu id.

-- ---------------------------------------------------------------------------
-- PASO D — Probar el candado
-- ---------------------------------------------------------------------------
-- Los triggers SÍ corren desde el editor (a diferencia de RLS, que la conexión
-- privilegiada se saltea). Este INSERT TIENE QUE FALLAR con "deja el saldo en
-- negativo". Si en vez de fallar inserta la fila, el trigger no quedó
-- instalado y hay que revisar la migración.

INSERT INTO tournament_debt_payments (tournament_id, organizer_id, amount_cop)
SELECT tournament_id, organizer_id, 999999 FROM tournament_debts;

-- Y por las dudas, que no haya quedado nada: debe dar 0.
SELECT count(*) AS abonos_que_no_deberian_existir FROM tournament_debt_payments;
