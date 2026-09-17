-- ============================================================================
-- Auditar los cupones: cuáles quedaron quemados sin producir nada
-- ----------------------------------------------------------------------------
-- Un cupón se marca como usado (`used_by` + `used_at`) ANTES de crear el
-- torneo. Si el torneo después se borra, el `ON DELETE SET NULL` del FK deja
-- el cupón usado pero sin torneo. Y si la creación falla, queda igual.
--
-- En los dos casos el resultado es el mismo: un código quemado que no le
-- sirve a nadie, y que tampoco se puede volver a dar.
--
-- ⚠️ EL ENLACE VIVE EN DOS LADOS Y HAY QUE MIRAR LOS DOS:
--     coupons.tournament_id   ← lo escribe el form después de crear
--     tournaments.coupon_id   ← lo escribe el insert del torneo
-- Si sólo mirás el primero, podés "liberar" un cupón que un torneo vivo
-- todavía está usando, y ese torneo pasaría a verse como pago sin serlo.
-- Las consultas de abajo cruzan los dos.

-- ---------------------------------------------------------------------------
-- 1. Panorama general
-- ---------------------------------------------------------------------------
SELECT
  count(*)                                              AS total,
  count(*) FILTER (WHERE used_by IS NULL)               AS disponibles,
  count(*) FILTER (WHERE used_by IS NOT NULL)           AS usados,
  count(*) FILTER (WHERE used_by IS NOT NULL
                     AND tournament_id IS NULL)         AS usados_sin_torneo
FROM coupons;

-- ---------------------------------------------------------------------------
-- 2. Los sueltos de verdad: usados, sin torneo por ningún lado
-- ---------------------------------------------------------------------------
-- Estos son los candidatos a liberar. Muestra quién lo usó, para distinguir
-- las pruebas propias de los organizadores reales.

SELECT
  c.code,
  c.type,
  c.value,
  c.used_at::date        AS usado_el,
  u.name                 AS lo_uso,
  u.email
FROM   coupons c
LEFT   JOIN users u ON u.id = c.used_by
WHERE  c.used_by IS NOT NULL
  AND  c.tournament_id IS NULL
  -- Cinturón: que ningún torneo vivo lo esté usando por el otro lado.
  AND  NOT EXISTS (SELECT 1 FROM tournaments t WHERE t.coupon_id = c.id)
ORDER  BY c.used_at;

-- ---------------------------------------------------------------------------
-- 3. LIBERAR (comentado — descomentá cuando decidas)
-- ---------------------------------------------------------------------------
-- Liberar es mejor que borrar: el código sobrevive y se le puede dar a otro
-- organizador. Borrar pierde el registro de que ese código existió.
--
-- Esto libera SOLO los que usaste vos mismo probando (Torneos Pro y Josh
-- SuperAdmin). Los de organizadores reales quedan afuera a propósito: ellos
-- sí recibieron el beneficio, aunque después borraran el torneo.

-- UPDATE coupons c
-- SET    used_by = NULL,
--        used_at = NULL
-- FROM   users u
-- WHERE  u.id = c.used_by
--   AND  c.tournament_id IS NULL
--   AND  NOT EXISTS (SELECT 1 FROM tournaments t WHERE t.coupon_id = c.id)
--   AND  u.name IN ('Torneos Pro', 'Josh SuperAdmin');

-- Si querés liberar TODOS los sueltos, incluidos los de organizadores reales,
-- usá esta otra en vez de la de arriba:

-- UPDATE coupons c
-- SET    used_by = NULL,
--        used_at = NULL
-- WHERE  c.used_by IS NOT NULL
--   AND  c.tournament_id IS NULL
--   AND  NOT EXISTS (SELECT 1 FROM tournaments t WHERE t.coupon_id = c.id);

-- ---------------------------------------------------------------------------
-- 4. Después de liberar: cuántos quedaron disponibles
-- ---------------------------------------------------------------------------
-- SELECT code, type, value FROM coupons WHERE used_by IS NULL ORDER BY code;
