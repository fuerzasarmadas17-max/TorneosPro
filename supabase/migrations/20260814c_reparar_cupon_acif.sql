-- ============================================================================
-- Reparar lo que dejó dañado el bug de `fair_play`
-- ----------------------------------------------------------------------------
-- Correr DESPUÉS de `20260814b_fair_play_enum.sql`.
--
-- El 2026-08-14 a las 19:33 UTC, ACIF (info@acd.uno) intentó crear un torneo
-- de fútbol con el cupón K5H5U2FT. El insert del torneo falló por el enum
-- incompleto, pero para entonces el cupón YA estaba quemado y los 8 equipos YA
-- estaban creados. La app le dijo "creado correctamente" y lo mandó al
-- dashboard vacío.
--
-- Esto devuelve el cupón y limpia los equipos sueltos.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Devolver el cupón para que ACIF pueda volver a usarlo
-- ---------------------------------------------------------------------------
-- Solo si sigue sin torneo: si entre tanto alguien lo ató a uno, no se toca.

UPDATE coupons
SET    used_by = NULL,
       used_at = NULL
WHERE  code = 'K5H5U2FT'
  AND  tournament_id IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Borrar los equipos que quedaron sueltos
-- ---------------------------------------------------------------------------
-- Los 8 del intento de ACIF, más 2 "Equipo 17" del torneo "2do Torneo
-- Vacacional" (intentos de agregar equipo antes de que se arreglara el cobro).
-- Verificado: ninguno está en `tournament_teams` ni tiene jugadores.

DELETE FROM teams
WHERE id IN (
  '465bcfe5-affd-450b-af35-4ce4eedf4d2d', -- Equipo 8  (ACIF)
  'a7619777-95e4-460e-9431-443a7a83d831', -- Equipo 7  (ACIF)
  'e480bae1-6a20-4707-b119-63dc0d7ebdff', -- Equipo 6  (ACIF)
  '55277e09-ca52-4353-b208-035dfa26bfd6', -- Equipo 5  (ACIF)
  '6ae63e29-69fc-4621-b643-152f3ef29635', -- Equipo 4  (ACIF)
  'aa797d80-285e-4f60-b7df-8e09fc1d2731', -- Equipo 3  (ACIF)
  'bec3d8e3-7504-4c90-803a-915c36b01518', -- Equipo 2  (ACIF)
  'df0554bf-86a6-4e06-842f-d52b8aad2a9a', -- Equipo 1  (ACIF)
  '27df7bb9-2fbe-4a32-8d9b-4d21450f07e8', -- Equipo 17 (Vacacional)
  '49488765-b526-410a-bccc-3ace986af9a2'  -- Equipo 17 (Vacacional)
)
-- Cinturón: solo si de verdad siguen sueltos.
AND NOT EXISTS (
  SELECT 1 FROM tournament_teams tt WHERE tt.team_id = teams.id
);

COMMIT;

-- ---------------------------------------------------------------------------
-- Verificación (debe devolver el cupón libre y 0 equipos)
-- ---------------------------------------------------------------------------
SELECT code, used_by, used_at, tournament_id
FROM   coupons
WHERE  code = 'K5H5U2FT';

SELECT count(*) AS equipos_sueltos_restantes
FROM   teams t
WHERE  t.created_at >= '2026-08-14'
  AND  NOT EXISTS (SELECT 1 FROM tournament_teams tt WHERE tt.team_id = t.id);
