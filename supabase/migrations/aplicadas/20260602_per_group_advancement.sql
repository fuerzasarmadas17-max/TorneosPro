-- Per-group advancement counts for the elimination bracket.
-- Allows uneven cupos across groups (e.g. Grupo A → 2, Grupo B → 3).
--
-- Shape stored:
--   { "<group_id_uuid>": 2, "<group_id_uuid>": 3, ... }
--
-- When NULL, the legacy `advance_per_group INT` column is used as a uniform
-- value applied to every group of the tournament. New tournaments will
-- populate this column; old ones keep working with the uniform value.
--
-- The legacy column is kept on purpose for back-compat. Drop in a follow-up
-- migration once no client code reads it anymore.

ALTER TABLE playoff_configs
  ADD COLUMN IF NOT EXISTS advance_per_group_json JSONB;
