-- ============================================================================
-- Juego Limpio: premio de equipo que suma un punto en la tabla
-- ----------------------------------------------------------------------------
-- Una liga de fútbol premia el juego limpio: en cada partido uno de los dos
-- equipos puede llevárselo, y eso le vale un punto extra en la tabla de
-- posiciones. Ganando 3+1=4, empatando 1+1=2, perdiendo 0+1=1.
--
-- Es un premio de EQUIPO, no de jugador, así que no va por `match_events`
-- —esa tabla exige `player_name`— sino como una columna del partido. Además,
-- la tabla de posiciones se calcula SOLO con `matches` (ver use-standings.ts);
-- si el dato viviera en los eventos habría que cargarlos enteros para poder
-- sumar un punto.
--
-- NULL = a nadie se le dio el juego limpio en ese partido. Es opcional a
-- propósito: hay fechas donde ninguno de los dos lo merece.
--
-- ON DELETE SET NULL para que borrar un equipo del sistema no arrastre el
-- partido con él, igual que `home_team_id` / `winner_id`.
--
-- Nada cambia para los torneos existentes: la columna nace en NULL y la stat
-- `fair_play` viene desmarcada al crear el torneo, así que la tabla de
-- posiciones sigue dando exactamente lo mismo hasta que alguien la active.

BEGIN;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS fair_play_team_id UUID
    REFERENCES teams(id) ON DELETE SET NULL;

COMMENT ON COLUMN matches.fair_play_team_id IS
  'Equipo que ganó el Juego Limpio del partido (NULL = nadie). Suma 1 punto en la tabla. Solo aplica si el torneo tiene la stat fair_play habilitada.';

-- Índice parcial: las consultas que importan son "partidos donde SÍ se dio el
-- premio" (el ranking de juego limpio). Los NULL son la enorme mayoría de las
-- filas y no aportan nada al índice.
CREATE INDEX IF NOT EXISTS idx_matches_fair_play_team
  ON matches(fair_play_team_id)
  WHERE fair_play_team_id IS NOT NULL;

COMMIT;
