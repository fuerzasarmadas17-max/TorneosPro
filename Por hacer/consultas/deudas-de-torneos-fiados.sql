-- ============================================================================
-- Paso 0.2 del plan: qué torneos fiados hay hoy y cuánto se debe por cada uno
-- ----------------------------------------------------------------------------
-- Para correr a mano en el editor SQL de Supabase. Solo lee, no toca nada.
-- Ver `Por hacer/deuda-contra-publicidad.md`.
--
-- Hace dos cosas a la vez:
--
--   1. Es la AUDITORÍA de `pago-duvan.md`: cuáles ya pagaron por fuera y nadie
--      les soltó el cupón.
--   2. Es la VISTA PREVIA de la deuda: aplica la regla nueva a los datos
--      reales, para ver si los saldos que saldrían tienen sentido antes de
--      construir nada.
--
-- LA REGLA QUE APLICA
--   Debe si el torneo tiene un cupón que lo dejó en $0 — `free_tournament`, o
--   `percentage` con valor 100 — y su dueño no está excluido por política.
--   Un descuento de 30% o 50% NO genera deuda: ese pagó lo que se le pidió.
--
--   saldo = precio de lista actual del torneo − lo que ya abonó
--
-- Todavía no existe la tabla de abonos, así que acá "lo ya abonado" es solo lo
-- que entró por `payments`. Cuando exista, se le suma ese lado.
--
-- ⚠️ `ya_cobrado` PUEDE QUEDARSE CORTO. Suma los `payments` que tienen
-- `tournament_id`, y hay pagos que quedan sueltos sin torneo asociado (para eso
-- existe `/api/payments/link-tournament`). Un pago suelto hace que el saldo
-- salga más alto de lo real. La consulta 2 del final los busca.
--
-- ⚠️ `t.price` significa cosas distintas según cómo se creó el torneo: para los
-- de cortesía es el precio de LISTA (lo crea el cliente), para los pagados por
-- Wompi es lo que entró. Acá solo miramos los de cortesía, así que siempre es
-- el precio de lista — que es exactamente lo que se debe.

SELECT
  COALESCE(op.organization_name, u.name)  AS organizador,
  u.email,
  t.name                                  AS torneo,
  t.created_at::date                      AS creado,
  t.plan,
  t.tier,
  c.code                                  AS cupon,
  CASE
    WHEN c.type = 'free_tournament'            THEN 'Torneo gratis'
    WHEN c.type = 'percentage' AND c.value >= 100 THEN 'Descuento 100%'
    ELSE 'Descuento ' || c.value || '%'
  END                                     AS bono,

  -- ¿Genera deuda con la regla nueva?
  CASE
    WHEN COALESCE(u.revenue_share_excluded, false) THEN 'no — cuenta excluida'
    WHEN c.type = 'free_tournament'
      OR (c.type = 'percentage' AND c.value >= 100) THEN 'SI'
    ELSE 'no — pagó con descuento'
  END                                     AS genera_deuda,

  t.price                                 AS precio_lista,
  COALESCE(pg.cobrado, 0)                 AS ya_cobrado,

  -- El saldo que mostraría el sistema hoy.
  CASE
    WHEN COALESCE(u.revenue_share_excluded, false) THEN 0
    WHEN c.type = 'free_tournament'
      OR (c.type = 'percentage' AND c.value >= 100)
      THEN GREATEST(0, t.price - COALESCE(pg.cobrado, 0))
    ELSE 0
  END                                     AS saldo,

  -- Señales para revisar a mano.
  --
  -- OJO: "sigue con cupón" solo es anomalía en las CORTESÍAS. Un torneo con
  -- descuento en % conserva su `coupon_id` a propósito —es donde queda
  -- registrado el descuento, y de ahí lo lee `computeUpgradeQuote`—, así que
  -- marcar esos en rojo es un falso positivo. (Lo fue en la primera corrida,
  -- 2026-08-25: el 15% de Daniel salió en rojo estando bien.)
  CASE
    WHEN (c.type = 'free_tournament' OR (c.type = 'percentage' AND c.value >= 100))
         AND COALESCE(pg.cobrado, 0) > 0
      THEN '🔴 cortesía ya pagada y sigue con cupón — soltarlo (ver pago-duvan.md)'
    WHEN c.type = 'percentage' AND c.value < 100 AND COALESCE(pg.cobrado, 0) = 0
      THEN '⚠️ descuento sin pago ligado — ¿no pagó, o el pago quedó suelto?'
    WHEN t.plan = 'free'
      THEN '⚠️ plan free: ponerlo en paid antes de soltar el cupón'
    ELSE ''
  END                                     AS revisar

FROM tournaments t
JOIN coupons c                     ON c.id = t.coupon_id
JOIN users u                       ON u.id = t.created_by
LEFT JOIN organization_profiles op ON op.user_id = t.created_by
LEFT JOIN LATERAL (
  SELECT SUM(p.amount_cop) AS cobrado
  FROM payments p
  WHERE p.tournament_id = t.id AND p.status = 'approved'
) pg ON true
ORDER BY genera_deuda DESC, saldo DESC, t.created_at DESC;

-- ============================================================
-- CÓMO LEERLA
-- ============================================================
--
-- | Lo que ves | Qué significa |
-- |---|---|
-- | `genera_deuda = SI`, `ya_cobrado = 0` | Fiado de verdad. Ese saldo es lo que va a empezar a abonarse con publicidad. |
-- | `genera_deuda = SI`, `ya_cobrado > 0` | 🔴 Ya pagó por fuera y nadie soltó el cupón. **Arreglar antes de prender los abonos**, o le vas a descontar plata a alguien que ya pagó. |
-- | `genera_deuda = no — pagó con descuento` | Cortesía real (premio de referido, descuento comercial). No debe nada. |
-- | `genera_deuda = no — cuenta excluida` | Prueba, demo o socio. Nunca cobra publicidad, así que una deuda ahí no bajaría nunca. |
--
-- LO QUE HAY QUE DECIDIR MIRANDO ESTO
--
--   1. ¿Los saldos de la columna `saldo` son los que esperabas? Si alguno está
--      muy alto, probablemente el torneo subió de plan y la deuda subió con él
--      — eso es correcto, pero conviene verlo antes de que lo vea él.
--   2. ¿Hay filas en 🔴? Ésas se arreglan primero, con los dos UPDATE de
--      `pago-duvan.md`. La lista se vacía sola a medida que se resuelven.
--   3. ¿Aparece algún torneo que vos considerabas regalado de verdad y que acá
--      sale con deuda? Si pasa seguido, hace falta el campo "fiado vs. regalo"
--      que se descartó por ahora.


-- ============================================================
-- CONSULTA 2 — pagos que no quedaron ligados a ningún torneo
-- ============================================================
-- Antes de darle por buena la columna `saldo`, hay que descartar que alguno de
-- estos organizadores haya pagado y que el pago no se haya asociado al torneo.
-- Si aparece plata acá, cruzarla a mano con la lista de arriba.
SELECT
  COALESCE(op.organization_name, u.name) AS organizador,
  u.email,
  p.amount_cop,
  p.status,
  p.created_at::date                     AS pago,
  p.reference
FROM payments p
JOIN users u                       ON u.id = p.user_id
LEFT JOIN organization_profiles op ON op.user_id = p.user_id
WHERE p.tournament_id IS NULL
  AND p.status = 'approved'
ORDER BY p.created_at DESC;

-- ============================================================
-- CONSULTA 3 — ¿qué cuentas están excluidas por política?
-- ============================================================
-- La cuenta de la propia plataforma TIENE que estar acá. Si no está, entra al
-- reparto como un organizador más y se lleva parte de cada campaña.
SELECT u.email, u.name, u.revenue_share_excluded
FROM users u
WHERE u.revenue_share_excluded IS TRUE;
