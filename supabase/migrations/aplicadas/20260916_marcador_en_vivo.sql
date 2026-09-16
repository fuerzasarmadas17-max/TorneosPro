-- ============================================================================
-- Vóley: el marcador en vivo que ve el público
-- ----------------------------------------------------------------------------
-- ORDEN: esta migración va ANTES de desplegar el código. La tabla nace vacía y
-- hoy no la lee nadie, así que correrla antes no rompe nada. Si el código sale
-- primero, la planilla manda a una tabla que no existe: no se rompe nada para
-- la mesa (el envío en vivo falla callado), pero el en vivo no aparece.
--
-- QUÉ ES
-- Mientras la mesa lleva la planilla, cada 30 segundos (y al cerrar cada set)
-- manda cómo va el partido. Acá se guarda UNA fila por partido con esa foto, y
-- se REEMPLAZA en cada envío: no crece. La página del torneo muestra como "EN
-- VIVO" los partidos cuya foto tiene 5 minutos o menos.
--
-- POR QUÉ UNA TABLA APARTE Y NO UNA COLUMNA EN `matches`
-- La página del torneo escucha en tiempo real los cambios de `matches`. Si la
-- foto viviera ahí, cada envío de cada partido le llegaría a CADA persona que
-- tenga abierta la página, cada 30 segundos: el costo crecería con la gente que
-- mira, que es justo lo que el diseño evita. Esta tabla no está en el tiempo
-- real; la página la pide por una puerta con copia compartida.
--
-- QUIÉN LA LEE Y ESCRIBE
-- Solo el servidor (service role). Se prende RLS sin políticas a propósito: ni
-- el público ni un organizador logueado la tocan directo.
--
-- CUÁNDO SE BORRA LA FILA
-- Cuando el partido termina (se guarda el resultado) o se aplaza. Si la mesa
-- abandona la planilla sin terminar, la fila queda pero deja de mostrarse a
-- los 5 minutos, porque la página filtra por la hora del último envío.
--
-- Ver `Por hacer/deportes/voley/PLANILLA-EN-VIVO-PUBLICO.md`.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS match_live_scores (
  match_id      UUID PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  state         JSONB NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- La única consulta del público: "los partidos de este torneo con foto fresca".
CREATE INDEX IF NOT EXISTS idx_match_live_scores_tournament
  ON match_live_scores (tournament_id, updated_at);

ALTER TABLE match_live_scores ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE match_live_scores IS
  'Solo vóley: la última foto del marcador que mandó la planilla mientras se juega. Una fila por partido, se reemplaza en cada envío. {sets:{home,away}, setEnJuego:{n,home,away}|null}. NO es el resultado oficial. Solo la escribe y la lee el servidor. Ver Por hacer/deportes/voley/PLANILLA-EN-VIVO-PUBLICO.md';

COMMIT;
