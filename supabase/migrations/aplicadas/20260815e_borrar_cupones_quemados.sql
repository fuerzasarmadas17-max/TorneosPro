-- ============================================================================
-- Borrar los 15 cupones quemados que no produjeron ningún torneo
-- ----------------------------------------------------------------------------
-- Son códigos marcados como usados cuyo torneo no existe por ningún lado: o
-- se borró el torneo (el FK los deja huérfanos con ON DELETE SET NULL), o la
-- creación falló después de quemar el cupón. Ocupan lugar y no le sirven a
-- nadie.
--
-- Decisión del organizador (2026-08-15): borrarlos, no liberarlos.
-- Lo que se pierde es sólo el registro de que ese código existió — a quién se
-- le dio y cuándo. Los torneos, pagos y equipos no se tocan: el cupón no es
-- padre de nada.
--
-- Los 15 códigos, verificados contra producción el 2026-08-15:
--   WNGQUN3X  WNGQUN3T  AWVEXHN2  75T56SC7  EAHYKDXU
--   NGGEPKNM  2Y9A3X48  X64DTM3K  M8K9H6AV  BWCC7QAF
--   VBUCDEZD  85HEYWCL  XC6ST5GT  MHLVPUH8  F9FMSB2D

-- ---------------------------------------------------------------------------
-- PASO 1 — Mirá qué se va a borrar ANTES de borrarlo
-- ---------------------------------------------------------------------------
-- Corré esto solo primero. Tienen que salir 15 filas y ninguna más.

SELECT c.code, c.type, c.value, c.used_at::date AS usado_el, u.name AS lo_uso
FROM   coupons c
LEFT   JOIN users u ON u.id = c.used_by
WHERE  c.used_by IS NOT NULL
  AND  c.tournament_id IS NULL
  AND  NOT EXISTS (SELECT 1 FROM tournaments t WHERE t.coupon_id = c.id)
ORDER  BY c.used_at;

-- ---------------------------------------------------------------------------
-- PASO 2 — El borrado
-- ---------------------------------------------------------------------------
-- Las tres condiciones son un candado, no adorno:
--   used_by IS NOT NULL      → nunca borra un cupón disponible sin usar
--   tournament_id IS NULL    → nunca borra uno atado a un torneo
--   NOT EXISTS (...)         → ni uno que un torneo vivo referencie por el
--                              otro lado (`tournaments.coupon_id`), que es el
--                              enlace fácil de pasar por alto
--
-- Si borrás una condición, esto deja de ser seguro.

BEGIN;

DELETE FROM coupons c
WHERE  c.used_by IS NOT NULL
  AND  c.tournament_id IS NULL
  AND  NOT EXISTS (SELECT 1 FROM tournaments t WHERE t.coupon_id = c.id);

COMMIT;

-- ---------------------------------------------------------------------------
-- PASO 3 — Verificación
-- ---------------------------------------------------------------------------
-- Debe quedar: total 21, disponibles 0, usados 21, usados_sin_torneo 0.

SELECT
  count(*)                                              AS total,
  count(*) FILTER (WHERE used_by IS NULL)               AS disponibles,
  count(*) FILTER (WHERE used_by IS NOT NULL)           AS usados,
  count(*) FILTER (WHERE used_by IS NOT NULL
                     AND tournament_id IS NULL)         AS usados_sin_torneo
FROM coupons;

-- Y que los 21 torneos que usan cupón sigan con el suyo (deben ser 17 filas,
-- que son los torneos vivos que referencian un cupón):
SELECT count(*) AS torneos_con_cupon_intacto
FROM   tournaments t
JOIN   coupons c ON c.id = t.coupon_id;
