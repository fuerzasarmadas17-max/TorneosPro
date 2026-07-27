-- Links de anotador que cruzan torneos + cupo global por organizador.
--
-- Motivación: la agenda del dashboard ya muestra los partidos de todos los
-- torneos en curso juntos. El organizador quiere armarle a un anotador el
-- link de "todo lo que se juega el sábado en la cancha 2" sin importar a qué
-- torneo pertenece cada partido. Hasta ahora un link era de UN solo torneo.
--
-- Cambios:
--   1. `tournament_ids UUID[]` — los torneos que toca el link (1..N).
--   2. `tournament_id` pasa a NULLABLE. Se sigue seteando cuando el link es
--      de un solo torneo, así conserva el ON DELETE CASCADE y el
--      comportamiento de la sección por torneo. Queda NULL en multi-torneo.
--   3. La RLS ancla en `created_by` en vez de `tournament_id` (que ahora
--      puede ser NULL). `created_by` ya existía y siempre es el organizador,
--      así que la policy sigue diciendo exactamente lo mismo.
--
-- Nota sobre borrado: un link multi-torneo no tiene FK (vive en el array),
-- así que borrar uno de sus torneos no lo borra en cascada. Degrada bien —
-- los partidos de ese torneo se van por su propio CASCADE y el link sigue
-- sirviendo para los que quedan. Además expiran 24h después del último
-- partido, así que la ventana de basura es corta.

-- ============================================================
-- 1. Columna multi-torneo + backfill
-- ============================================================

ALTER TABLE scorer_links
  ADD COLUMN IF NOT EXISTS tournament_ids UUID[];

UPDATE scorer_links
  SET tournament_ids = ARRAY[tournament_id]
  WHERE tournament_ids IS NULL
    AND tournament_id IS NOT NULL;

ALTER TABLE scorer_links
  ALTER COLUMN tournament_ids SET NOT NULL;

ALTER TABLE scorer_links
  ALTER COLUMN tournament_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'scorer_links_tournament_ids_not_empty'
  ) THEN
    ALTER TABLE scorer_links
      ADD CONSTRAINT scorer_links_tournament_ids_not_empty
      CHECK (array_length(tournament_ids, 1) > 0);
  END IF;
END $$;

COMMENT ON COLUMN scorer_links.tournament_ids IS
  'Torneos que cubre el link (1..N). Fuente de verdad; tournament_id queda solo para links de un torneo.';
COMMENT ON COLUMN scorer_links.tournament_id IS
  'Torneo único del link, o NULL si cruza varios. Se conserva por el ON DELETE CASCADE.';

-- ============================================================
-- 2. Índices
-- ============================================================

-- Cupo global: COUNT(*) WHERE created_by = X AND revoked_at IS NULL
-- AND expires_at > now().
CREATE INDEX IF NOT EXISTS idx_scorer_links_creator_active
  ON scorer_links(created_by)
  WHERE revoked_at IS NULL;

-- Búsqueda inversa "¿este partido ya está en un link activo?" — la lista de
-- selección esconde los partidos ya tomados, y el endpoint lo revalida.
CREATE INDEX IF NOT EXISTS idx_scorer_links_match_ids
  ON scorer_links USING GIN (match_ids);

-- ============================================================
-- 3. RLS anclada en created_by
-- ============================================================

DROP POLICY IF EXISTS "Organizer manages own tournament's scorer links" ON scorer_links;

CREATE POLICY "Organizer manages own scorer links"
  ON scorer_links FOR ALL
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
