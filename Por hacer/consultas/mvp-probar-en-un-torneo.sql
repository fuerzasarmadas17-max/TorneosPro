-- ============================================================================
-- MVP: prenderlo en un torneo que YA existe, para probarlo
-- ----------------------------------------------------------------------------
-- Para el editor SQL de Supabase. Correr los bloques de a uno.
--
-- POR QUÉ HACE FALTA ESTO
-- Las estadísticas de un torneo se eligen al CREARLO (`tournaments.enabled_stats`)
-- y hoy no hay pantalla para cambiarlas después. Los torneos nuevos van a traer
-- el MVP marcado solo; los que ya están corriendo, no. Así que para probar el
-- MVP sin crear un torneo de verdad ($40.000 el más barato), se le presta la
-- stat a un torneo existente y después se le saca.
--
-- CÓMO SE USA: reemplazá Volleyball Mujeres 3 por el nombre exacto, tal como
-- aparece en el listado del bloque 1. Va en los bloques 2, 3 y 4.
--
-- ⚠️ Esto escribe en la base de PRODUCCIÓN. Usá un torneo de prueba, y acordate
-- de correr el bloque 4 cuando termines: deja todo como estaba.

-- ---------------------------------------------------------------------------
-- 1) Ver los torneos y cómo se llaman exactamente.
-- ---------------------------------------------------------------------------
SELECT name, sport, created_at::date AS creado, enabled_stats
FROM   tournaments
ORDER  BY created_at DESC
LIMIT  20;

-- ---------------------------------------------------------------------------
-- 2) Prenderle el MVP a ese torneo.
--    Ojo: correlo en una ejecución APARTE de la que agregó 'mvp' al enum.
--    Postgres no deja usar un valor de enum recién creado en la misma
--    transacción. (Si ya corriste el ALTER TYPE antes, esto va sin problema.)
--    Tiene que devolver una fila. Si devuelve cero, el nombre no coincide.
-- ---------------------------------------------------------------------------
UPDATE tournaments
SET    enabled_stats = enabled_stats || 'mvp'::match_event_type
WHERE  name = 'Volleyball Mujeres 3'
  AND  NOT ('mvp' = ANY(enabled_stats))
RETURNING name, enabled_stats;

-- ---------------------------------------------------------------------------
-- 3) Ver los MVP cargados, después de guardar algún partido desde la app.
--    `player_id` con valor = quedó atado al jugador de la plantilla.
--    `player_id` en NULL = se guardó solo el nombre suelto (pasa cuando el
--    nombre no estaba en la nómina; el planillero no inscribe a nadie).
-- ---------------------------------------------------------------------------
SELECT m.round AS jornada, m.match_number AS partido,
       e.player_name AS mvp, t.name AS equipo, e.player_id,
       e.entered_by_name AS lo_cargo
FROM   match_events e
JOIN   matches m ON m.id = e.match_id
JOIN   teams   t ON t.id = e.team_id
WHERE  e.type = 'mvp'
  AND  m.tournament_id = (SELECT id FROM tournaments WHERE name = 'Volleyball Mujeres 3')
ORDER  BY m.round, m.match_number;

-- ---------------------------------------------------------------------------
-- 4) Dejar el torneo como estaba: borra los MVP cargados y le saca la stat.
-- ---------------------------------------------------------------------------
DELETE FROM match_events
WHERE  type = 'mvp'
  AND  match_id IN (
         SELECT id FROM matches
         WHERE  tournament_id = (SELECT id FROM tournaments WHERE name = 'Volleyball Mujeres 3')
       );

UPDATE tournaments
SET    enabled_stats = array_remove(enabled_stats, 'mvp'::match_event_type)
WHERE  name = 'Volleyball Mujeres 3'
RETURNING name, enabled_stats;
