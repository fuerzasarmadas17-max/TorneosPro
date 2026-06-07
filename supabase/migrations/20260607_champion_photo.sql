-- Pieza J: foto del equipo campeón.
--
-- Cuando el torneo se completa, el organizador puede subir una foto horizontal
-- del equipo ganador desde el modal "¡Tenemos campeón!". A partir de ahí,
-- cualquier visitante (incluso público sin sesión) que entre al detalle del
-- torneo verá un modal centrado con la foto del campeón y su nombre.
--
-- NULL = el organizador todavía no subió una foto. La columna se llena con la
-- URL pública del bucket `images`.

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS champion_photo_url TEXT;
