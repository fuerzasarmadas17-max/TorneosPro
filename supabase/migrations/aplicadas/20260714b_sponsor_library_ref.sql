-- Biblioteca de logos (v2): modelo por referencia.
--
-- Cada patrocinador USADO en un torneo puede referenciar el logo canónico de
-- la biblioteca (una fila de sponsors a nivel organización). Así, editar la
-- imagen en la biblioteca se propaga a todos los torneos que la usan, mientras
-- que la URL de destino queda independiente por torneo (es una columna de la
-- fila del torneo, no de la biblioteca).
--
-- 100% ADITIVO y SEGURO:
--   * Columna nullable. Las filas existentes quedan con library_sponsor_id = NULL
--     (no vinculadas) y siguen funcionando exactamente igual.
--   * ON DELETE SET NULL: si se borra un logo de la biblioteca, los usos NO se
--     borran — solo se desvinculan y conservan su última imagen.
ALTER TABLE sponsors
  ADD COLUMN IF NOT EXISTS library_sponsor_id UUID
  REFERENCES sponsors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sponsors_library_ref
  ON sponsors(library_sponsor_id);
