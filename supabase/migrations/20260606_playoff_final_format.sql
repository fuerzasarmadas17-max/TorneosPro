-- Pieza I: configurable final series format.
--
-- Allows the organizer to decide, once both finalists are known, whether
-- the final is a single match, ida y vuelta, best of 5, or best of 7. NULL
-- means "follow the bracket-wide format" — single or double-leg depending
-- on playoff_double_leg.

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS playoff_final_format TEXT;
