-- ============================================================================
-- Borrar las fechas tentativas que el generador de calendario dejaba puestas
-- ----------------------------------------------------------------------------
-- Hasta hoy, "Generar Aleatorio" (match-schedule.tsx) le escribía a cada
-- jornada una fecha inventada: inicio del torneo, +7 días por jornada. La
-- intención era ahorrar tecleo; el efecto fue el contrario. El organizador
-- abría la pestaña Fechas, veía la fecha YA ESCRITA y sólo llenaba hora y
-- lugar —los dos que sí venían en blanco—, dando por buena una fecha que
-- nadie eligió. Torneos programados para el 20 de diciembre porque el
-- generador contó semanas desde el inicio.
--
-- Ese cálculo ya se quitó del código, así que de acá en adelante los partidos
-- nacen con los tres campos vacíos y "Programar" no se habilita hasta que el
-- organizador ponga fecha, hora y lugar. Falta limpiar lo ya generado.
--
-- A quién le borramos la fecha — las tres condiciones juntas:
--
--   status = 'unscheduled'  → el partido todavía no está programado. Uno ya
--                             programado tiene fecha real y equipos avisados;
--                             ahí no se toca nada.
--   date IS NOT NULL        → arrastra una fecha.
--   time IS NULL            → nadie le puso hora...
--   venue IS NULL           → ...ni lugar.
--
-- Las dos últimas son la firma de un partido que nadie tocó: si el organizador
-- hubiera estado trabajando en él, habría al menos hora o cancha. Cuando hay
-- una de las dos, la fecha puede ser suya de verdad y borrarla sería tirarle
-- el trabajo — por eso quedan afuera.
--
-- Al 13 de agosto de 2026, en producción: 1194 partidos entran (17 torneos),
-- 32 quedan afuera por tener hora o lugar cargados.
--
-- Sólo se pone `date` en NULL. Ni el estado, ni los equipos, ni la jornada, ni
-- los resultados se tocan: los partidos siguen exactamente donde estaban, en
-- la pestaña Fechas, sólo que ahora con el casillero de fecha vacío.

BEGIN;

-- Antes: cuántos vamos a limpiar.
SELECT COUNT(*) AS van_a_limpiarse
FROM matches
WHERE status = 'unscheduled'
  AND date IS NOT NULL
  AND time IS NULL
  AND venue IS NULL;

UPDATE matches
SET date = NULL
WHERE status = 'unscheduled'
  AND date IS NOT NULL
  AND time IS NULL
  AND venue IS NULL;

-- Después: `quedan_sin_tocar` debe dar 0, y `respetados` son los que tenían
-- hora o lugar y por eso conservan su fecha.
SELECT
  (SELECT COUNT(*) FROM matches
    WHERE status = 'unscheduled' AND date IS NOT NULL
      AND time IS NULL AND venue IS NULL) AS quedan_sin_tocar,
  (SELECT COUNT(*) FROM matches
    WHERE status = 'unscheduled' AND date IS NOT NULL) AS respetados;

COMMIT;
