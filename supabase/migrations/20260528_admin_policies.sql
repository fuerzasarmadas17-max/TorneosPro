-- Admin policies: permiten que un usuario con role='admin' pueda gestionar
-- (leer / insertar / actualizar / borrar) cualquier torneo y sus tablas
-- asociadas. Necesario para acciones admin tipo "Eliminar torneo" y
-- "Avanzar resultados" desde el detalle.
--
-- Correr una sola vez en el SQL editor de Supabase prod. Idempotente: se
-- puede correr de nuevo sin error.

-- 1. Helper is_admin() (SECURITY DEFINER para evitar recursion en RLS).
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
$$;

-- 2. Policies de admin sobre las tablas que tocan las acciones admin.
DROP POLICY IF EXISTS "Admin gestiona torneos" ON tournaments;
CREATE POLICY "Admin gestiona torneos"
  ON tournaments FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin gestiona partidos" ON matches;
CREATE POLICY "Admin gestiona partidos"
  ON matches FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin gestiona match_events" ON match_events;
CREATE POLICY "Admin gestiona match_events"
  ON match_events FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin gestiona sets" ON volleyball_sets;
CREATE POLICY "Admin gestiona sets"
  ON volleyball_sets FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin gestiona tournament_teams" ON tournament_teams;
CREATE POLICY "Admin gestiona tournament_teams"
  ON tournament_teams FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin gestiona tournament_groups" ON tournament_groups;
CREATE POLICY "Admin gestiona tournament_groups"
  ON tournament_groups FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin gestiona tournament_group_teams" ON tournament_group_teams;
CREATE POLICY "Admin gestiona tournament_group_teams"
  ON tournament_group_teams FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin gestiona playoff_configs" ON playoff_configs;
CREATE POLICY "Admin gestiona playoff_configs"
  ON playoff_configs FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
