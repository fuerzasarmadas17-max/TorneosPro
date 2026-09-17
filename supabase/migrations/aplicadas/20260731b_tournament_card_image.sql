-- ============================================================================
-- Foto de la tarjeta, elegida por el organizador
-- ----------------------------------------------------------------------------
-- El set de fotos sigue siendo curado y fijo (no se suben por torneo), pero el
-- organizador elige CUÁL de las de su deporte va en su tarjeta. El motivo son
-- las categorías: en un mismo deporte hay torneos infantiles, femeninos y
-- masculinos, y una foto de hombres adultos en un torneo de niños se ve mal.
--
-- Se guarda la CLAVE de la foto (p. ej. 'volleyball-femenino-1'), no una URL.
-- Es deliberado: la policy "Creador edita torneo" deja que cada organizador
-- haga UPDATE de su propio torneo, así que si acá guardáramos una URL libre,
-- cualquiera podría hacer que su tarjeta renderice una imagen arbitraria. Con
-- claves, un valor que no esté en `src/data/sport-images.ts` no resuelve y la
-- tarjeta cae al degradado del deporte.
--
-- Por lo mismo NO hace falta trigger acá: el peor caso de un valor inventado
-- es que no se muestre nada. Distinto de `featured`, donde un valor inventado
-- te pone en la portada.

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS card_image TEXT;

COMMENT ON COLUMN tournaments.card_image IS
  'Clave de la foto de la tarjeta (no una URL). Se resuelve contra src/data/sport-images.ts; si no existe o no es de ese deporte, la tarjeta cae al degradado. NULL = reparto automático por deporte.';
