-- ============================================================================
-- analytics_events: visitor_id permanente
-- ----------------------------------------------------------------------------
-- `page_views` ya tenía `visitor_id` (ver 20260720_analytics_visitor_id.sql),
-- pero la tabla de EVENTOS se quedó solo con `session_id`. Eso impide medir
-- publicidad por persona: la sesión caduca a los 30 min, así que alguien que
-- entra mañana, tarde y noche cuenta como tres personas distintas.
--
-- Lo necesitamos para la métrica de reparto con los organizadores:
-- PERSONA-DÍA = visitantes distintos que vieron la publicidad cada día,
-- sumado en el mes. Crece con la actividad real del torneo (200 personas × 15
-- fechas = 3.000) pero es inmune al refresh: quien recarga 50 veces el sábado
-- aporta 1, porque el visitor_id vive en localStorage y no se mueve durante
-- esa sentada.
--
-- OJO: aplica solo hacia adelante. Las impresiones ya registradas no tienen
-- persona y no se pueden reconstruir — `session_id` no es un reemplazo válido
-- para liquidar. Por eso conviene aplicar esto cuanto antes, aunque el resto
-- del sistema de monetización tarde: el dato empieza a acumularse desde hoy.

ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS visitor_id UUID;

-- Soporta el corte que hace la liquidación: filtrar por tipo de evento y
-- ventana de fechas, y contar visitantes distintos por día.
CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor
  ON analytics_events (event_type, created_at, visitor_id);

-- Mismo corte pero acotado a un torneo, que es como se arma el desglose por
-- organizador (los torneos cuelgan de `tournaments.created_by`).
CREATE INDEX IF NOT EXISTS idx_analytics_events_tournament_visitor
  ON analytics_events (tournament_id, event_type, created_at, visitor_id);
