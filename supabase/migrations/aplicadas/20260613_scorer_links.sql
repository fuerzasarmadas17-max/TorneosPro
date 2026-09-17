-- Plan anotadores vía link compartible (Por hacer/anotadores.md).
--
-- El organizador genera un link que cubre N partidos, lo comparte por
-- WhatsApp. El anotador abre el link, escribe su nombre, carga resultados.
-- Sin cuenta, sin email, sin fricción. Cap por tier de cuántos links
-- activos puede tener un torneo simultáneamente.
--
-- Seguridad: los endpoints `/api/scorer/*` validan el token server-side y
-- usan `supabaseAdmin` (service role) para hacer los updates. El anotador
-- nunca toca la DB directamente. Por eso NO se agregan policies RLS para
-- el anotador en matches/events/sets — el cliente del anotador no tiene
-- sesión Supabase.

-- ============================================================
-- 1. Tabla de links
-- ============================================================

CREATE TABLE scorer_links (
  token TEXT PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_ids UUID[] NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Calculado al crear: MAX(match.date + match.time) + 24h. Una vez pasada
  -- esta fecha el link deja de servir aunque exista.
  expires_at TIMESTAMPTZ NOT NULL,
  -- NULL = activo. El organizador puede revocar manualmente.
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  usage_count INT NOT NULL DEFAULT 0,
  CONSTRAINT scorer_links_match_ids_not_empty CHECK (array_length(match_ids, 1) > 0)
);

-- El cap por tier se mide así: COUNT(*) WHERE tournament_id = X AND
-- revoked_at IS NULL AND expires_at > now(). Estos índices parciales
-- aceleran esa query y la de cleanup de expirados.
CREATE INDEX idx_scorer_links_tournament_active
  ON scorer_links(tournament_id)
  WHERE revoked_at IS NULL;
CREATE INDEX idx_scorer_links_expires
  ON scorer_links(expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE scorer_links ENABLE ROW LEVEL SECURITY;

-- El organizador del torneo es el único que ve/edita sus links. Los
-- endpoints públicos (`/api/scorer/[token]`) usan service role para
-- saltarse la RLS — el token es la credencial, no la sesión Supabase.
CREATE POLICY "Organizer manages own tournament's scorer links"
  ON scorer_links FOR ALL
  USING (
    tournament_id IN (
      SELECT id FROM tournaments WHERE created_by = auth.uid()
    )
  )
  WITH CHECK (
    tournament_id IN (
      SELECT id FROM tournaments WHERE created_by = auth.uid()
    )
  );

-- ============================================================
-- 2. Trazabilidad en matches / match_events / volleyball_sets
-- ============================================================

-- entered_by_name: el nombre que el anotador escribió al abrir el link.
-- entered_via_token: el token del link que se usó (NULL si fue el
-- organizador directamente).

ALTER TABLE matches
  ADD COLUMN result_entered_by_name TEXT,
  ADD COLUMN result_entered_via_token TEXT;

ALTER TABLE match_events
  ADD COLUMN entered_by_name TEXT,
  ADD COLUMN entered_via_token TEXT;

ALTER TABLE volleyball_sets
  ADD COLUMN entered_by_name TEXT,
  ADD COLUMN entered_via_token TEXT;

-- Comentarios para el dashboard de Supabase.
COMMENT ON COLUMN matches.result_entered_by_name IS
  'Nombre del anotador (texto libre del link). NULL si fue el organizador.';
COMMENT ON COLUMN matches.result_entered_via_token IS
  'Token del scorer_link usado. NULL si fue el organizador directamente.';
