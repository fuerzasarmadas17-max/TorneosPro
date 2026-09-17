-- Pieza E: persist that the organizer has acknowledged the "fase completada"
-- modal in single-phase tournaments. Multi-phase stores the same flag inside
-- the phase_configs JSONB so no column change is needed for those.
--
-- A NULL value is treated as "not acknowledged" by the read layer.

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS group_stage_notified BOOLEAN;
