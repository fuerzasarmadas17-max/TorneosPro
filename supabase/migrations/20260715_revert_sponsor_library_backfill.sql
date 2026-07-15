-- REVERT del backfill de biblioteca (20260714c).
--
-- Motivo: el backfill se corrió en prod ANTES de desplegar el código que hace
-- que cada torneo muestre solo sus propios patrocinadores (Parte 3). Con el
-- código viejo en prod (mostrar = biblioteca de la org + sponsors del torneo),
-- los logos de la biblioteca aparecían en TODOS los torneos de esa org.
--
-- Este revert deshace SOLO las filas de biblioteca creadas por el backfill.
-- Verificado con datos reales: las 29 filas org-level fueron creadas por el
-- backfill (la biblioteca estaba vacía antes) y están todas referenciadas por
-- algún sponsor de torneo.
--
-- 100% SEGURO para lo configurado:
--   * NO toca las filas de torneo (tournament_id IS NOT NULL) — esos son los
--     patrocinadores reales de cada torneo, con su imagen y URL.
--   * Al borrar la fila de biblioteca, ON DELETE SET NULL pone library_sponsor_id
--     = NULL en los usos, sin cambiar su imagen ni su URL.
--
-- Cuando se despliegue la Parte 3 a prod, se puede volver a correr el backfill
-- (20260714c) sin efectos secundarios.

DELETE FROM sponsors
WHERE organization_profile_id IS NOT NULL
  AND tournament_id IS NULL
  AND id IN (SELECT library_sponsor_id FROM sponsors WHERE library_sponsor_id IS NOT NULL);
