-- Canchas parecidas: guardar los "no, son distintas".
--
-- QUÉ RESUELVE
-- La cancha de un partido es texto libre. Un mismo lugar termina escrito de dos
-- formas ("Rita" y "Rita de Arrazola") y el filtro por cancha lo parte en dos.
-- La app detecta esos pares sola, en el navegador, y le propone al organizador
-- unirlos. Si dice que SÍ, se reescribe la cancha de sus partidos y no queda
-- nada que recordar. Si dice que NO, hay que acordarse, o mañana se le vuelve a
-- preguntar lo mismo desde otro teléfono. Esta tabla es esa memoria.
--
-- POR QUÉ UNA TABLA Y NO EL NAVEGADOR
-- Guardarlo en el navegador (localStorage) lo ata a un dispositivo: el mismo
-- organizador entra desde el celular y la sugerencia que ya descartó en la
-- computadora le aparece de nuevo. Es exactamente la molestia que se quiere
-- evitar.
--
-- ORDEN: correr ANTES de desplegar. Sin la tabla, decir "no son la misma" no
-- falla, pero no se recuerda, y la sugerencia vuelve en la próxima carga.

CREATE TABLE IF NOT EXISTS venue_merge_dismissals (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Las dos canchas del par, ya normalizadas (minúscula, sin espacios de más).
  -- Se guardan ORDENADAS alfabéticamente para que el par (Rita, Rita de
  -- Arrazola) y el par (Rita de Arrazola, Rita) sean la misma fila y no se
  -- pregunte dos veces lo mismo.
  venue_a    text NOT NULL,
  venue_b    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT venue_merge_dismissals_ordenado CHECK (venue_a < venue_b),
  CONSTRAINT venue_merge_dismissals_unico UNIQUE (user_id, venue_a, venue_b)
);

CREATE INDEX IF NOT EXISTS idx_venue_merge_dismissals_user
  ON venue_merge_dismissals (user_id);

COMMENT ON TABLE venue_merge_dismissals IS
  'Pares de canchas que el organizador marcó como distintas. Evita repreguntar.';

ALTER TABLE venue_merge_dismissals ENABLE ROW LEVEL SECURITY;

-- Cada organizador ve y escribe solo lo suyo. No hay lectura pública: a nadie
-- más le sirve saber qué canchas descartó.
DROP POLICY IF EXISTS "Organizador gestiona sus descartes de cancha"
  ON venue_merge_dismissals;
CREATE POLICY "Organizador gestiona sus descartes de cancha"
  ON venue_merge_dismissals FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
