-- ============================================================================
-- MVP del torneo: foto y quién fue
-- ----------------------------------------------------------------------------
-- Cuando el torneo termina, el organizador ya podía subir la foto del equipo
-- campeón (`champion_photo_url`, migración 20260607_champion_photo.sql). Ahora
-- puede subir además la foto del MVP del torneo — el mejor jugador — y decir
-- quién es. El público lo ve junto al campeón, con un botón para pasar de una
-- foto a la otra.
--
-- Aplica a TODOS los deportes, tenga o no prendida la estadística de MVP por
-- partido: el organizador elige al jugador de la lista de todos los inscritos.
-- Si el torneo sí llevó MVP por partido, la app le sugiere al que más ganó,
-- pero es solo una sugerencia — la decisión es suya.
--
-- POR QUÉ CUATRO COLUMNAS Y NO UNA
--   mvp_photo_url    la foto (vertical, retrato). NULL = todavía no subió nada.
--   mvp_player_id    vínculo estable al jugador. Si le corrigen el nombre en la
--                    nómina, el MVP sigue siendo él. Nullable a propósito: el
--                    organizador puede escribir un nombre que no esté inscrito,
--                    igual que en el resto de las estadísticas.
--   mvp_player_name  el nombre como se muestra. Va aparte del id porque tiene
--                    que sobrevivir al borrado del jugador: si alguien depura
--                    la nómina, la foto del MVP no puede quedar sin nombre
--                    debajo (por eso el ON DELETE SET NULL de arriba y este
--                    texto acá).
--   mvp_team_id      para mostrar "NICOLL OCAMPO · Las Panteras".
--
-- LA FOTO NO NECESITA TOCAR STORAGE. Se sube al bucket `images` bajo el prefijo
-- `champions/` (con `-mvp-` en el nombre del archivo), que ya está habilitado
-- en la policy `Usuarios suben imagenes` desde 20260607_storage_champions_prefix.
-- Agregar un prefijo nuevo obligaba a borrar y recrear esa policy, que es la
-- que deja subir TODAS las imágenes del sistema —logos, patrocinadores— y no
-- vale el riesgo por una carpeta.
--
-- Nada cambia para los torneos que ya existen: las cuatro columnas nacen en
-- NULL y la app no muestra nada del MVP hasta que haya foto.

BEGIN;

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS mvp_photo_url   TEXT,
  ADD COLUMN IF NOT EXISTS mvp_player_id   UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mvp_player_name TEXT,
  ADD COLUMN IF NOT EXISTS mvp_team_id     UUID REFERENCES teams(id) ON DELETE SET NULL;

COMMENT ON COLUMN tournaments.mvp_photo_url IS
  'Foto vertical (3:4) del MVP del torneo, subida por el organizador cuando el torneo está completed. NULL = no subió ninguna.';
COMMENT ON COLUMN tournaments.mvp_player_name IS
  'Nombre del MVP tal como se muestra. Se guarda aparte de mvp_player_id para que sobreviva al borrado del jugador.';

COMMIT;
