-- Estadísticas defensivas de béisbol/softball/wiffleball.
-- Nuevos valores del enum match_event_type para la planilla defensiva:
--   putout          = Out (PO)
--   winning_pitcher = Pitcher ganador (PG)
-- 'assist' (asistencia de fildeo) ya existe en el enum, se reutiliza.
--
-- Postgres exige ALTER TYPE ADD VALUE fuera de un bloque de transacción —
-- ejecutar cada sentencia por separado en el SQL editor de Supabase.

ALTER TYPE match_event_type ADD VALUE IF NOT EXISTS 'putout';
ALTER TYPE match_event_type ADD VALUE IF NOT EXISTS 'winning_pitcher';
