-- Pieza G: support manual matchup builder for playoffs.
--   playoff_double_leg: whether the bracket is decided over two legs.
--   playoff_fixture_generated: tracks the "matchups configured → fixture
--   generated" UX transition so the playoffs tab knows which view to render.
--
-- Both default to NULL and are read by the client as "false" when absent,
-- so the migration is safe to apply at any time without affecting in-flight
-- tournaments.

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS playoff_double_leg BOOLEAN;

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS playoff_fixture_generated BOOLEAN;
