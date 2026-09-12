-- ============================================================================
-- Vóley: cuántos jugadores en cancha por equipo
-- ----------------------------------------------------------------------------
-- ORDEN: esta migración va ANTES de desplegar el código. La columna nace en
-- NULL y nada la lee hasta que exista la planilla, así que correrla antes no
-- rompe nada; correrla después sí, porque el formulario de crear torneo va a
-- intentar guardar una columna que todavía no existe.
--
-- QUÉ ES
-- El vóley de siempre son seis por equipo, pero no todos los torneos se juegan
-- así: hay categorías de niños de cuatro por equipo y de cinco. Hasta hoy daba
-- igual, porque de un partido de vóley solo se guarda el marcador y los
-- parciales de cada set, y ahí no aparece cuánta gente había en la cancha.
--
-- Empieza a importar con la planilla en vivo (`Por hacer/planilla-en-vivo-volley.md`).
-- Esa pantalla dibuja la cancha con una casilla por posición y hace girar la
-- rotación sola, y las dos cosas necesitan el número: con seis son tres arriba
-- y tres abajo, con cuatro son dos y dos, y la vuelta de rotación se cierra
-- cada cuatro puntos ganados en recepción en vez de cada seis. Sin este dato la
-- planilla no sabe cuántas casillas dibujar.
--
-- Decisión del dueño, 2026-09-12: va configurable por torneo desde la primera
-- versión, y no fijo en seis. Es lo que evita rehacer las cuatro pantallas de
-- la planilla cuando aparezca el primer torneo de niños.
--
-- POR QUÉ NULLABLE Y SIN BACKFILL
-- Es la misma forma que `best_of`, que vive al lado y resuelve lo mismo (mejor
-- de 3 o de 5). NULL quiere decir "el organizador no lo eligió", y la app lo
-- lee como seis, igual que lee `best_of` como 3. Así los torneos que ya existen
-- siguen funcionando sin tocar una sola fila, y el día que alguien abra la
-- configuración de uno viejo y elija cinco, se guarda y listo.
--
-- El CHECK deja pasar solo 4, 5 y 6. No es un capricho: cada valor nuevo son
-- casillas que alguien tiene que dibujar en la pantalla de rotación, así que es
-- mejor que un 7 rebote acá y no que la planilla quede a medio pintar en una
-- cancha. Si algún día hace falta el vóley playa de 2, se amplía el CHECK.
--
-- Se llena solo en vóley. En los otros deportes queda en NULL para siempre: la
-- columna existe en `tournaments`, que es la tabla de todos, pero el formulario
-- solo la muestra cuando el deporte es vóley — igual que `best_of`.
-- ============================================================================

BEGIN;

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS players_on_court SMALLINT
    CHECK (players_on_court IN (4, 5, 6));

COMMENT ON COLUMN tournaments.players_on_court IS
  'Solo vóley: jugadores en cancha por equipo (4, 5 o 6). Lo elige el organizador al crear el torneo. NULL = no lo eligió, la app lo lee como 6. Lo usa la planilla en vivo para dibujar la cancha y para saber cada cuántos puntos cierra la vuelta de rotación.';

COMMIT;
