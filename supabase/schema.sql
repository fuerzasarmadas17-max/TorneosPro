-- ============================================================
-- MisTorneos - Schema para Supabase (PostgreSQL)
-- ============================================================

-- ========================
-- ENUMS
-- ========================

CREATE TYPE user_role AS ENUM ('user', 'admin');

CREATE TYPE sport AS ENUM (
  'futbol', 'futsal', 'microfutbol', 'beisbol', 'softball', 'wiffleball',
  'volleyball', 'basketball', 'ping-pong', 'tenis', 'padel'
);

CREATE TYPE tournament_format AS ENUM ('elimination', 'round-robin', 'group-playoff');

CREATE TYPE tournament_status AS ENUM ('upcoming', 'in-progress', 'completed');

CREATE TYPE tournament_plan AS ENUM ('free', 'paid');

CREATE TYPE match_status AS ENUM ('unscheduled', 'scheduled', 'postponed', 'completed');

CREATE TYPE match_phase AS ENUM ('group', 'playoff');

CREATE TYPE match_event_type AS ENUM (
  'goal', 'assist', 'yellow_card', 'red_card', 'goals_against',
  'hit', 'double', 'triple', 'home_run', 'error',
  'ace', 'double_fault', 'winner',
  'block', 'point', 'steal', 'rebound',
  'strikeout', 'ejection',
  'blue_card'
);

-- ========================
-- USERS
-- ========================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supabase Auth: el id se vincula con auth.users.id
-- Para vincular: ALTER TABLE users ADD CONSTRAINT fk_auth FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ========================
-- ORGANIZATION PROFILES
-- ========================

CREATE TABLE organization_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  organization_name TEXT NOT NULL,
  bio TEXT,
  logo_url TEXT,
  location TEXT,
  founded_year INT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9-]{3,50}$')
);

CREATE INDEX idx_org_profiles_slug ON organization_profiles(slug);
CREATE INDEX idx_org_profiles_user_id ON organization_profiles(user_id);

-- ========================
-- SOCIAL LINKS
-- ========================

CREATE TABLE social_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_profile_id UUID NOT NULL UNIQUE REFERENCES organization_profiles(id) ON DELETE CASCADE,
  website TEXT,
  facebook TEXT,
  instagram TEXT,
  twitter TEXT
);

-- ========================
-- SPONSORS
-- ========================

CREATE TABLE sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  link_url TEXT NOT NULL,
  -- Sponsor puede pertenecer a una org, a un torneo, o a ambos
  organization_profile_id UUID REFERENCES organization_profiles(id) ON DELETE CASCADE,
  tournament_id UUID, -- FK se agrega despues de crear la tabla tournaments
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sponsor_has_owner CHECK (
    organization_profile_id IS NOT NULL OR tournament_id IS NOT NULL
  )
);

CREATE INDEX idx_sponsors_org ON sponsors(organization_profile_id);
CREATE INDEX idx_sponsors_tournament ON sponsors(tournament_id);

-- ========================
-- TEAMS
-- ========================

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- PLAYERS
-- ========================

CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INT,
  document_number TEXT,
  eps TEXT,
  birth_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_players_team ON players(team_id);

-- ========================
-- TOURNAMENTS
-- ========================

CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sport sport NOT NULL,
  format tournament_format NOT NULL,
  plan tournament_plan NOT NULL DEFAULT 'free',
  status tournament_status NOT NULL DEFAULT 'upcoming',
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  group_stage_complete BOOLEAN NOT NULL DEFAULT false,
  double_round_robin BOOLEAN NOT NULL DEFAULT false,
  max_players_per_team INT,
  best_of SMALLINT CHECK (best_of IN (3, 5)),
  price INT, -- COP (pago unico por torneo)
  tier TEXT, -- basico, medio, pro, premium
  enabled_stats match_event_type[] DEFAULT '{}',
  phase_configs JSONB DEFAULT NULL,
  visible_tabs TEXT[] DEFAULT NULL,
  disqualified_team_ids TEXT[] DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tournaments_created_by ON tournaments(created_by);
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_tournaments_sport ON tournaments(sport);

-- FK para sponsors.tournament_id
ALTER TABLE sponsors
  ADD CONSTRAINT fk_sponsors_tournament
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE;

-- ========================
-- TOURNAMENT <-> TEAMS (many to many)
-- ========================

CREATE TABLE tournament_teams (
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  PRIMARY KEY (tournament_id, team_id)
);

CREATE INDEX idx_tournament_teams_tournament ON tournament_teams(tournament_id);
CREATE INDEX idx_tournament_teams_team ON tournament_teams(team_id);

-- ========================
-- TOURNAMENT GROUPS
-- ========================

CREATE TABLE tournament_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phase INT NOT NULL DEFAULT 1
);

CREATE INDEX idx_tournament_groups_tournament ON tournament_groups(tournament_id);

-- ========================
-- GROUP <-> TEAMS (many to many)
-- ========================

CREATE TABLE tournament_group_teams (
  group_id UUID NOT NULL REFERENCES tournament_groups(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, team_id)
);

-- ========================
-- PLAYOFF CONFIG
-- ========================

CREATE TABLE playoff_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL UNIQUE REFERENCES tournaments(id) ON DELETE CASCADE,
  advance_per_group INT NOT NULL,
  total_advancing INT NOT NULL
);

-- ========================
-- MATCHES
-- ========================

CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round INT NOT NULL,
  match_number INT NOT NULL,
  home_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  away_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  home_score INT,
  away_score INT,
  winner_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  status match_status NOT NULL DEFAULT 'unscheduled',
  date DATE,
  time TEXT,
  venue TEXT,
  postponed_reason TEXT,
  next_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  phase match_phase,
  group_id UUID REFERENCES tournament_groups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_home_team ON matches(home_team_id);
CREATE INDEX idx_matches_away_team ON matches(away_team_id);
CREATE INDEX idx_matches_group ON matches(group_id);

-- ========================
-- MATCH EVENTS (estadisticas)
-- ========================

CREATE TABLE match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  type match_event_type NOT NULL,
  position TEXT, -- para beisbol: P, C, 1B, 2B, 3B, SS, LF, CF, RF
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_match_events_match ON match_events(match_id);
CREATE INDEX idx_match_events_team ON match_events(team_id);
CREATE INDEX idx_match_events_type ON match_events(type);

-- ========================
-- VOLLEYBALL SETS
-- ========================

CREATE TABLE volleyball_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  set_number SMALLINT NOT NULL,
  home_points INT NOT NULL DEFAULT 0,
  away_points INT NOT NULL DEFAULT 0,

  UNIQUE (match_id, set_number)
);

CREATE INDEX idx_volleyball_sets_match ON volleyball_sets(match_id);

-- ========================
-- ROW LEVEL SECURITY (RLS)
-- ========================

-- Habilitar RLS en todas las tablas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_group_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE playoff_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE volleyball_sets ENABLE ROW LEVEL SECURITY;

-- ========================
-- POLICIES: Lectura publica
-- ========================

-- Cualquiera puede ver perfiles publicos
CREATE POLICY "Perfiles publicos visibles"
  ON organization_profiles FOR SELECT
  USING (is_public = true);

-- Cualquiera puede ver torneos
CREATE POLICY "Torneos visibles"
  ON tournaments FOR SELECT
  USING (true);

-- Cualquiera puede ver equipos
CREATE POLICY "Equipos visibles"
  ON teams FOR SELECT
  USING (true);

-- Cualquiera puede ver jugadores
CREATE POLICY "Jugadores visibles"
  ON players FOR SELECT
  USING (true);

-- Cualquiera puede ver partidos
CREATE POLICY "Partidos visibles"
  ON matches FOR SELECT
  USING (true);

-- Cualquiera puede ver eventos
CREATE POLICY "Eventos visibles"
  ON match_events FOR SELECT
  USING (true);

-- Cualquiera puede ver sets
CREATE POLICY "Sets visibles"
  ON volleyball_sets FOR SELECT
  USING (true);

-- Cualquiera puede ver grupos
CREATE POLICY "Grupos visibles"
  ON tournament_groups FOR SELECT
  USING (true);

CREATE POLICY "Grupo teams visibles"
  ON tournament_group_teams FOR SELECT
  USING (true);

CREATE POLICY "Tournament teams visibles"
  ON tournament_teams FOR SELECT
  USING (true);

CREATE POLICY "Playoff configs visibles"
  ON playoff_configs FOR SELECT
  USING (true);

CREATE POLICY "Social links visibles"
  ON social_links FOR SELECT
  USING (true);

CREATE POLICY "Sponsors visibles"
  ON sponsors FOR SELECT
  USING (true);

-- ========================
-- POLICIES: Usuarios autenticados
-- ========================

-- Usuarios pueden ver su propio registro
CREATE POLICY "Usuarios ven su propio perfil"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Admin puede ver todos los usuarios
CREATE POLICY "Admin ve todos los usuarios"
  ON users FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Usuarios pueden editar su propio perfil de org
CREATE POLICY "Usuario edita su perfil"
  ON organization_profiles FOR ALL
  USING (user_id = auth.uid());

-- Usuarios pueden editar sus social links
CREATE POLICY "Usuario edita social links"
  ON social_links FOR ALL
  USING (
    organization_profile_id IN (
      SELECT id FROM organization_profiles WHERE user_id = auth.uid()
    )
  );

-- Creador del torneo puede editarlo
CREATE POLICY "Creador edita torneo"
  ON tournaments FOR ALL
  USING (created_by = auth.uid());

-- Creador del torneo puede gestionar sus partidos
CREATE POLICY "Creador gestiona partidos"
  ON matches FOR ALL
  USING (
    tournament_id IN (
      SELECT id FROM tournaments WHERE created_by = auth.uid()
    )
  );

-- Creador gestiona eventos de partidos
CREATE POLICY "Creador gestiona eventos"
  ON match_events FOR ALL
  USING (
    match_id IN (
      SELECT m.id FROM matches m
      JOIN tournaments t ON m.tournament_id = t.id
      WHERE t.created_by = auth.uid()
    )
  );

-- Creador gestiona sets
CREATE POLICY "Creador gestiona sets"
  ON volleyball_sets FOR ALL
  USING (
    match_id IN (
      SELECT m.id FROM matches m
      JOIN tournaments t ON m.tournament_id = t.id
      WHERE t.created_by = auth.uid()
    )
  );

-- ========================
-- POLICIES: Admin
-- ========================

-- Admin puede hacer todo en usuarios
CREATE POLICY "Admin gestiona usuarios"
  ON users FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Admin puede gestionar sponsors en cualquier torneo
CREATE POLICY "Admin gestiona sponsors"
  ON sponsors FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Creador gestiona sus propios sponsors
CREATE POLICY "Creador gestiona sponsors de org"
  ON sponsors FOR ALL
  USING (
    organization_profile_id IN (
      SELECT id FROM organization_profiles WHERE user_id = auth.uid()
    )
    OR
    tournament_id IN (
      SELECT id FROM tournaments WHERE created_by = auth.uid()
    )
  );

-- ========================
-- FUNCTIONS: updated_at automatico
-- ========================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_tournaments_updated
  BEFORE UPDATE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_matches_updated
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_org_profiles_updated
  BEFORE UPDATE ON organization_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================
-- COUPONS
-- ========================

CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'free_tournament')),
  value INT NOT NULL DEFAULT 0,
  used_by UUID REFERENCES users(id),
  used_at TIMESTAMPTZ,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- Cualquiera autenticado puede leer cupones (para validar codigos)
CREATE POLICY "Cupones visibles para autenticados"
  ON coupons FOR SELECT
  USING (auth.role() = 'authenticated');

-- Solo admin puede crear/editar/eliminar cupones
CREATE POLICY "Admin gestiona cupones"
  ON coupons FOR INSERT
  USING (is_admin());

CREATE POLICY "Admin actualiza cupones"
  ON coupons FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admin elimina cupones"
  ON coupons FOR DELETE
  USING (is_admin());

-- Usuarios pueden reclamar cupones no usados O actualizar los suyos (ej: agregar tournament_id)
CREATE POLICY "Usuario usa cupon"
  ON coupons FOR UPDATE
  USING (
    (used_by IS NULL AND auth.role() = 'authenticated')
    OR
    (used_by = auth.uid())
  );

-- Agregar columna coupon_id a tournaments
ALTER TABLE tournaments ADD COLUMN coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL;

-- ========================
-- PAYMENTS
-- ========================

CREATE TYPE payment_status AS ENUM ('pending', 'approved', 'declined', 'voided', 'error');

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
  amount_cop INT NOT NULL,
  amount_in_cents INT NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  wompi_transaction_id TEXT,
  wompi_status TEXT,
  payment_method TEXT,
  integrity_signature TEXT NOT NULL,
  tournament_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_reference ON payments(reference);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_tournament ON payments(tournament_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve sus pagos"
  ON payments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admin ve todos los pagos"
  ON payments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Usuario actualiza su pago"
  ON payments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER tr_payments_updated
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================
-- STORAGE BUCKET (para imagenes de sponsors/logos)
-- ========================

-- Ejecutar en Supabase Dashboard > Storage:
-- Crear bucket "images" con acceso publico
-- O via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: cualquier usuario autenticado puede subir imagenes
CREATE POLICY "Usuarios suben imagenes"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'images'
    AND auth.role() = 'authenticated'
  );

-- Policy: imagenes son publicas
CREATE POLICY "Imagenes publicas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'images');
