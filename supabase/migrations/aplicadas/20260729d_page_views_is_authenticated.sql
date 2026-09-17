-- ============================================================================
-- page_views: marcar si la visita era de alguien logueado
-- ----------------------------------------------------------------------------
-- Hace falta para los requisitos de la sección "Monetizar" (Paso 3 de
-- Por hacer/monetizacion-analitica-publicidad.md).
--
-- El requisito de audiencia se mide con personas-día de `page_views` y NO con
-- las de publicidad, porque las impresiones dependen de que el admin le haya
-- asignado una campaña al torneo: un organizador con audiencia real pero sin
-- campaña marcaría cero y nunca podría desbloquear la sección. O sea la puerta
-- dependería de una decisión del admin, no del mérito del organizador.
--
-- El costo de usar `page_views` es que ahí entran TODAS las visitas, incluidas
-- las del propio organizador revisando su torneo. Con un umbral de 300
-- personas-día eso es ~10% de ruido (él solo puede aportar ~30 al mes, una por
-- día), y para alguien justo en la línea puede ser la diferencia entre cobrar
-- y no cobrar.
--
-- Hoy no se puede descontar: `page_views` guarda `visitor_id` y `session_id`,
-- pero nada que diga si había sesión iniciada.
--
-- Para el PAGO este problema no existe y ya estaba resuelto: las impresiones de
-- publicidad no se le muestran a nadie logueado (`ad-modal.tsx` chequea
-- `isAuthenticated`), así que el organizador nunca se cuenta a sí mismo en lo
-- que cobra. Esto es solo para la puerta.
--
-- OJO: aplica solo hacia adelante. Las visitas ya registradas no se pueden
-- clasificar. Cada mes que pase sin esto es un mes en que el requisito de
-- audiencia se evalúa con el organizador incluido.
--
-- Se deja NULLABLE a propósito: NULL = "no sabemos" (visita anterior a esta
-- migración), distinto de false = "confirmado anónimo". Un DEFAULT false
-- mentiría sobre el histórico.

ALTER TABLE page_views
  ADD COLUMN IF NOT EXISTS is_authenticated BOOLEAN;

-- Soporta el corte de la puerta: audiencia de un torneo en una ventana de
-- fechas, contando visitantes distintos y excluyendo a los logueados.
CREATE INDEX IF NOT EXISTS idx_page_views_entity_anon
  ON page_views (entity_type, entity_id, created_at, visitor_id)
  WHERE is_authenticated IS NOT TRUE;

COMMENT ON COLUMN page_views.is_authenticated IS
  'La visita venía con sesión iniciada. NULL = anterior a 20260729d, no se sabe. Se usa para excluir al propio organizador del requisito de audiencia de "Monetizar"; el pago ya lo excluye por otra vía (el modal no se muestra a logueados).';
