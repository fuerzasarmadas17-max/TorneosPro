-- Tier 1 baseball/softball/wiffleball individual stats: AB, BB, RBI, R.
-- Postgres requires one ALTER TYPE ADD VALUE per statement (no IF NOT EXISTS pre-pg12-style here).
-- Each must run outside a transaction block — execute one by one in the Supabase SQL editor.

ALTER TYPE match_event_type ADD VALUE IF NOT EXISTS 'at_bat';
ALTER TYPE match_event_type ADD VALUE IF NOT EXISTS 'walk';
ALTER TYPE match_event_type ADD VALUE IF NOT EXISTS 'rbi';
ALTER TYPE match_event_type ADD VALUE IF NOT EXISTS 'run_scored';
