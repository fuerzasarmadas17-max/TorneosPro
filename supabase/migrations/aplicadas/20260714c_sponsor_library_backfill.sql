-- Parte 2 — Backfill de la biblioteca de logos.
--
-- Objetivo: que los patrocinadores que YA existían en torneos aparezcan en la
-- biblioteca del organizador y queden linkeados, para que editar su imagen en
-- la biblioteca se propague a los torneos que los usan.
--
-- 100% SEGURO e IDEMPOTENTE:
--   * NO borra ni modifica imágenes de ningún torneo.
--   * Solo (a) crea en la biblioteca los logos que faltan y (b) setea
--     library_sponsor_id donde está NULL.
--   * Se puede correr varias veces sin duplicar (dedup por org + image_url,
--     y solo toca filas con library_sponsor_id IS NULL).
--   * Los sponsors de torneos cuyo creador no tiene perfil de organización se
--     omiten (no hay biblioteca donde ponerlos) — no se rompen, quedan igual.

-- Paso A: crear en la biblioteca (nivel organización) los logos usados en
-- torneos que todavía no existen ahí.
WITH tourn_sponsors AS (
  SELECT s.image_url,
         s.name,
         s.link_url,
         op.id AS org_id
  FROM sponsors s
  JOIN tournaments t ON t.id = s.tournament_id
  JOIN organization_profiles op ON op.user_id = t.created_by
  WHERE s.tournament_id IS NOT NULL
),
to_create AS (
  SELECT ts.org_id,
         ts.image_url,
         -- name/link representativos: preferimos el primer valor no vacío.
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

-- Paso B: linkear cada sponsor de torneo (sin link) al logo de la biblioteca
-- correspondiente (mismo org + misma imagen).
-- Nota Postgres: en UPDATE ... FROM no se puede referenciar la tabla objetivo
-- (s) dentro de un JOIN ... ON, así que todas las correlaciones con `s` van en
-- el WHERE y las demás tablas se listan por coma.
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
  AND s.library_sponsor_id IS NULL;
