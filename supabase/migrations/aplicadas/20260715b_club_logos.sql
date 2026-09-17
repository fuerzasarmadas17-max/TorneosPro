-- Biblioteca de logos de clubes (equipos) — mismo patrón que patrocinadores.
--
-- Motivo: un club juega en varias categorías (= varias filas en `teams`, una
-- por categoría). El organizador quiere cargar el logo del club UNA vez y
-- reutilizarlo en cada categoría, y que editarlo se refleje en todas.
--
-- 100% ADITIVO: tabla nueva + columna nullable. No toca datos existentes.

-- 1. Biblioteca de logos de club (a nivel organización).
CREATE TABLE IF NOT EXISTS club_logos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_profile_id UUID NOT NULL REFERENCES organization_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_club_logos_org ON club_logos(organization_profile_id);

ALTER TABLE club_logos ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede verlos (los logos se muestran en las vistas públicas).
CREATE POLICY "Club logos visibles"
  ON club_logos FOR SELECT
  USING (true);

-- Admin gestiona todo.
CREATE POLICY "Admin gestiona club logos"
  ON club_logos FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- El organizador gestiona los logos de su propia organización.
CREATE POLICY "Creador gestiona club logos de org"
  ON club_logos FOR ALL
  USING (
    organization_profile_id IN (
      SELECT id FROM organization_profiles WHERE user_id = auth.uid()
    )
  );

-- 2. El equipo referencia el logo de club (para propagar al editar la imagen).
--    `teams.logo_url` se mantiene (imagen denormalizada para mostrar rápido).
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS club_logo_id UUID
  REFERENCES club_logos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_teams_club_logo ON teams(club_logo_id);
