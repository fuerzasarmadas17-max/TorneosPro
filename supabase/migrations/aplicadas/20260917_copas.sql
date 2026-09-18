-- Torneo con varias copas: la lista de copas y de qué copa es cada partido.
--
-- QUÉ RESUELVE
-- Hoy, después de los grupos, hay una sola llave y un solo campeón. El formato
-- que se quiere correr reparte a los equipos en varias eliminaciones directas
-- en paralelo (Oro, Plata, Bronce) según el puesto en que quedaron en su grupo.
-- Falta el lugar donde vive esa lista de copas, y la forma de saber a cuál
-- pertenece cada partido.
--
-- LO QUE HACE
-- 1. Crea la tabla `tournament_cups`: una fila por copa de un torneo.
-- 2. Le agrega a `matches` la columna `cup_id`, que dice de qué copa es ese
--    partido.
--
-- LO QUE NO HACE
-- No inventa una fase nueva. Un partido de copa sigue siendo `phase =
-- 'playoff'`, igual que hoy; la copa es solo una etiqueta encima. Por eso las
-- estadísticas, la postemporada y todo lo que ya funciona no se tocan.
--
-- A LOS TORNEOS QUE YA EXISTEN NO LES PASA NADA
-- No tienen filas en `tournament_cups` y su `cup_id` queda vacío. Vacío
-- significa "el playoff de siempre".
--
-- ORDEN: se puede correr ANTES de desplegar. Hasta que exista la pantalla,
-- nadie escribe ni lee estas columnas: no rompe nada ni cambia lo que se ve.

-- Hace falta para el candado de más abajo (que dos copas no se peleen el mismo
-- puesto). Viene incluida en Supabase; esta línea solo la prende.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ========================
-- 1. LA LISTA DE COPAS
-- ========================

CREATE TABLE IF NOT EXISTS tournament_cups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  -- El nombre lo pone el organizador. Viene propuesto: Oro, Plata, Bronce.
  name          text NOT NULL,
  -- En qué orden se muestran y cuál es la más alta. 1 = la Oro.
  sort_order    smallint NOT NULL,
  -- De qué puestos de cada grupo se alimenta, inclusive: Oro = 1 a 2,
  -- Plata = 3 a 4. El puesto que no reclama ninguna copa se va a casa.
  position_from smallint NOT NULL,
  position_to   smallint NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- Puestos con sentido: del 1 para arriba y de menor a mayor.
  CONSTRAINT tournament_cups_puestos_validos
    CHECK (position_from >= 1 AND position_to >= position_from),
  -- El diseño aguanta 6 copas. Que el tope de prueba sea 3 lo decide la app,
  -- no la base: subirlo no es correr otra migración.
  CONSTRAINT tournament_cups_orden_valido
    CHECK (sort_order BETWEEN 1 AND 6),
  -- Dos copas del mismo torneo no comparten ni puesto en la lista ni nombre.
  CONSTRAINT tournament_cups_orden_unico UNIQUE (tournament_id, sort_order),
  CONSTRAINT tournament_cups_nombre_unico UNIQUE (tournament_id, name)
);

-- EL CANDADO IMPORTANTE: dos copas del mismo torneo no pueden reclamar el
-- mismo puesto. Sin esto, un error al crear el torneo (Oro = 1 a 3 y Plata =
-- 3 a 4) mete al tercero de cada grupo en dos llaves a la vez, y eso no se
-- descubre hasta que el bracket sale mal.
ALTER TABLE tournament_cups
  DROP CONSTRAINT IF EXISTS tournament_cups_puestos_sin_solapar;
ALTER TABLE tournament_cups
  ADD CONSTRAINT tournament_cups_puestos_sin_solapar
  EXCLUDE USING gist (
    tournament_id WITH =,
    int4range(position_from::int, position_to::int, '[]') WITH &&
  );

CREATE INDEX IF NOT EXISTS idx_tournament_cups_tournament
  ON tournament_cups (tournament_id, sort_order);

COMMENT ON TABLE tournament_cups IS
  'Las copas de un torneo (Oro, Plata, Bronce) y de qué puestos de grupo se alimenta cada una. Un torneo sin copas no tiene filas acá.';

-- Se ven en público, como los grupos: son parte del torneo.
ALTER TABLE tournament_cups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Copas visibles" ON tournament_cups;
CREATE POLICY "Copas visibles"
  ON tournament_cups FOR SELECT
  USING (true);

-- Solo el dueño del torneo las crea y las edita.
DROP POLICY IF EXISTS "Creador gestiona copas" ON tournament_cups;
CREATE POLICY "Creador gestiona copas"
  ON tournament_cups FOR ALL
  USING (
    tournament_id IN (SELECT id FROM tournaments WHERE created_by = auth.uid())
  )
  WITH CHECK (
    tournament_id IN (SELECT id FROM tournaments WHERE created_by = auth.uid())
  );

-- ========================
-- 2. DE QUÉ COPA ES CADA PARTIDO
-- ========================

-- Vacío = el playoff de siempre. Si se borra una copa, sus partidos quedan
-- con la columna vacía en vez de desaparecer.
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS cup_id uuid
  REFERENCES tournament_cups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_matches_cup ON matches (cup_id);

COMMENT ON COLUMN matches.cup_id IS
  'De qué copa es este partido de playoff. NULL = torneo de una sola llave, como siempre.';

-- ========================
-- 3. PARA CONFIRMAR QUE QUEDÓ BIEN
-- ========================
-- Después de correr todo, esto tiene que devolver una línea que diga
-- "listo, 0 copas por ahora": la tabla creada y vacía, y la columna puesta.

SELECT
  (SELECT count(*) FROM tournament_cups) AS copas_creadas,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'cup_id') AS columna_en_partidos;
