-- ============================================================================
-- RUNBOOK PROD — Biblioteca de logos de patrocinadores
-- ============================================================================
--
-- Correr en el SQL Editor de Supabase (prod) cuando despliegues el código de
-- la feature.
--
-- ⚠️ ORDEN OBLIGATORIO:
--   1) PRIMERO desplegar el código (incluye la "Parte 3": cada torneo muestra
--      SOLO sus propios patrocinadores). Si corrés el backfill ANTES de
--      desplegar, en prod los logos de la biblioteca aparecen en TODOS los
--      torneos de cada org (flooding), porque el código viejo hace
--      "mostrar = biblioteca de la org + sponsors del torneo".
--   2) DESPUÉS correr este archivo (de arriba hacia abajo).
--
-- Todo es ADITIVO e IDEMPOTENTE:
--   * No borra ni cambia imágenes de ningún torneo.
--   * Se puede correr más de una vez sin duplicar (dedup por org + image_url,
--     y solo toca filas con library_sponsor_id IS NULL).
--   * Los sponsors reales de cada torneo (filas con tournament_id) no se tocan.
--
-- Si necesitás DESHACER: ver el bloque REVERT al final (comentado).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- SECCIÓN 1 — Columnas (por si el prod no las tiene aún). Seguras si ya existen.
-- ----------------------------------------------------------------------------

-- name: nombre opcional/etiqueta del logo en la biblioteca.
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS name TEXT DEFAULT '';

-- library_sponsor_id: referencia del sponsor de torneo al logo canónico de la
-- biblioteca. ON DELETE SET NULL: si se borra el logo de la biblioteca, los
-- usos quedan desvinculados pero conservan su imagen (no se borran).
ALTER TABLE sponsors
  ADD COLUMN IF NOT EXISTS library_sponsor_id UUID
  REFERENCES sponsors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sponsors_library_ref
  ON sponsors(library_sponsor_id);


-- ----------------------------------------------------------------------------
-- SECCIÓN 2 — Backfill (TODOS los organizadores).
--   Paso A: crear en la biblioteca los logos usados en torneos que aún no
--           existen ahí (uno por org + image_url, dedup).
--   Paso B: linkear cada sponsor de torneo (sin link) a su logo de biblioteca.
--
--   NOTA: para acotar a UNA sola org, agregá el filtro por slug indicado en
--   los comentarios "-- (scope)".
-- ----------------------------------------------------------------------------

-- Paso A
WITH tourn_sponsors AS (
  SELECT s.image_url, s.name, s.link_url, op.id AS org_id
  FROM sponsors s
  JOIN tournaments t ON t.id = s.tournament_id
  JOIN organization_profiles op ON op.user_id = t.created_by
  WHERE s.tournament_id IS NOT NULL
  -- (scope) AND op.slug = 'TU_SLUG'
),
to_create AS (
  SELECT ts.org_id, ts.image_url,
         (array_agg(ts.name     ORDER BY (ts.name     <> '') DESC))[1] AS name,
         (array_agg(ts.link_url ORDER BY (ts.link_url <> '') DESC))[1] AS link_url
  FROM tourn_sponsors ts
  WHERE NOT EXISTS (
    SELECT 1 FROM sponsors lib
    WHERE lib.organization_profile_id = ts.org_id
      AND lib.tournament_id IS NULL
      AND lib.image_url = ts.image_url
  )
  GROUP BY ts.org_id, ts.image_url
)
INSERT INTO sponsors (image_url, link_url, name, organization_profile_id)
SELECT image_url, COALESCE(link_url, ''), COALESCE(name, ''), org_id
FROM to_create;

-- Paso B
-- Nota Postgres: en UPDATE ... FROM no se puede referenciar la tabla objetivo
-- (s) dentro de un JOIN ... ON; por eso todo va por coma + WHERE.
UPDATE sponsors s
SET library_sponsor_id = lib.id
FROM tournaments t,
     organization_profiles op,
     sponsors lib
WHERE s.tournament_id = t.id
  AND op.user_id = t.created_by
  AND lib.organization_profile_id = op.id
  AND lib.tournament_id IS NULL
  AND lib.image_url = s.image_url
  AND s.library_sponsor_id IS NULL
  -- (scope) AND op.slug = 'TU_SLUG'
;


-- ----------------------------------------------------------------------------
-- SECCIÓN 3 — Verificación (correr y revisar los números).
-- ----------------------------------------------------------------------------

-- Cuántos logos hay en la biblioteca (org-level) y cuántos usos quedaron linkeados.
SELECT
  (SELECT count(*) FROM sponsors WHERE organization_profile_id IS NOT NULL AND tournament_id IS NULL) AS logos_en_biblioteca,
  (SELECT count(*) FROM sponsors WHERE tournament_id IS NOT NULL) AS sponsors_de_torneo,
  (SELECT count(*) FROM sponsors WHERE tournament_id IS NOT NULL AND library_sponsor_id IS NOT NULL) AS sponsors_linkeados,
  (SELECT count(*) FROM sponsors WHERE tournament_id IS NOT NULL AND library_sponsor_id IS NULL) AS sponsors_sin_linkear;
-- Esperado: sponsors_linkeados ≈ sponsors_de_torneo (los sin_linkear son de
-- orgs sin perfil, o imágenes que no matchearon — revisar si es != 0).


-- ============================================================================
-- REVERT (solo si hace falta deshacer el backfill). DESCOMENTAR PARA USAR.
-- Borra SOLO las filas de biblioteca creadas por el backfill (las referenciadas
-- por algún sponsor de torneo). NO toca los sponsors reales de los torneos.
-- ============================================================================
-- DELETE FROM sponsors
-- WHERE organization_profile_id IS NOT NULL
--   AND tournament_id IS NULL
--   AND id IN (SELECT library_sponsor_id FROM sponsors WHERE library_sponsor_id IS NOT NULL);
