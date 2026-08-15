-- ============================================================================
-- Juego Limpio: falta el valor en el enum (arreglo urgente)
-- ----------------------------------------------------------------------------
-- La migración `20260813b_juego_limpio.sql` agregó `matches.fair_play_team_id`
-- pero NO agregó `fair_play` al enum `match_event_type`. Y `fair_play` sí es
-- un `MatchEventType` en el código (`src/types/index.ts`), que se guarda en
-- `tournaments.enabled_stats` — una columna de tipo `match_event_type[]`.
--
-- Resultado: desde que se desplegó Juego Limpio (2026-08-13), TODO organizador
-- de fútbol que marcara "Juego Limpio" al crear su torneo recibía
--
--     invalid input value for enum match_event_type: "fair_play"
--
-- y el torneo no se creaba. Como el error se tragaba en silencio, la app le
-- decía "Torneo creado correctamente" y lo mandaba al dashboard vacío.
--
-- Caso real: ASOCIACION CRISTIANA INTERNACIONAL DE FUTBOL ACIF (info@acd.uno),
-- el 2026-08-14 a las 19:33 UTC. Perdió el cupón y quedó sin torneo.
--
-- ⚠️ IMPORTANTE: `ALTER TYPE ... ADD VALUE` no puede ir dentro de un bloque
-- de transacción. Por eso este archivo NO lleva BEGIN/COMMIT. Corré esta
-- línea sola, primero, y después el bloque de reparación de más abajo.

ALTER TYPE match_event_type ADD VALUE IF NOT EXISTS 'fair_play';

-- Verificación: debe devolver una fila con 'fair_play'.
-- SELECT unnest(enum_range(NULL::match_event_type)) AS valor
-- WHERE  unnest(enum_range(NULL::match_event_type))::text = 'fair_play';
