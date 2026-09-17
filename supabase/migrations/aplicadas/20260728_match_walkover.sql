-- Marca los partidos ganados por W (walkover): el rival no se presentó, o fue
-- descalificado y le quedaban partidos por jugar.
--
-- Hasta ahora la W solo dejaba rastro en el marcador, y eso no alcanza para
-- distinguirla: un 3-0 en fútbol o un 7-0 en béisbol son resultados
-- perfectamente normales. Sin esta columna, cualquier intento de deducir la W
-- desde el marcador marcaría partidos reales como walkover.
--
-- La escriben los tres caminos que generan una W: el botón del organizador al
-- cargar el resultado, el mismo botón en el link del anotador, y
-- `disqualifyTeam`, que da por ganados los partidos pendientes del equipo
-- descalificado. Ver src/lib/walkover.ts.
--
-- NULL y FALSE significan lo mismo (no fue W). Los partidos cargados como W
-- antes de esta migración quedan sin marcar: no hay forma confiable de
-- reconocerlos hacia atrás, justamente por lo anterior.

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS walkover BOOLEAN;
