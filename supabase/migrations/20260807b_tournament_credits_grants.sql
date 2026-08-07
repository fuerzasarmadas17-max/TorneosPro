-- ============================================================================
-- Créditos de torneo: cerrarle las funciones al visitante anónimo
-- ----------------------------------------------------------------------------
-- Arregla un agujero de `20260807_tournament_credits.sql`, detectado al
-- verificar la migración contra la base.
--
-- QUÉ PASABA
-- Un llamado ANÓNIMO a `available_tournament_credits` respondía 200. Como la
-- función es SECURITY DEFINER (pasa por encima de RLS) y recibe el `user_id`
-- por parámetro, cualquiera podía preguntar cuántos créditos tiene una cuenta
-- ajena con solo conocer su id.
--
-- POR QUÉ NO ALCANZÓ EL REVOKE ORIGINAL
-- La migración hacía `REVOKE ALL ... FROM PUBLIC`, que quita el permiso que
-- Postgres le da a todo el mundo al crear una función. Pero Supabase tiene
-- configurado `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS
-- TO anon, authenticated, service_role`, así que `anon` recibe un permiso
-- PROPIO, no heredado de PUBLIC. Revocarle a PUBLIC no le quita el suyo.
--
-- Hay que nombrarlo explícitamente.

REVOKE ALL ON FUNCTION available_tournament_credits(UUID, INT) FROM anon;
REVOKE ALL ON FUNCTION consume_tournament_credit(UUID, UUID, INT) FROM anon;

-- ============================================================
-- Y que la función se defienda sola
-- ============================================================
-- Los permisos son la primera línea, no la única. `consume_tournament_credit`
-- ya verificaba adentro que el llamador fuera el dueño —por eso el intento
-- anónimo falló con "No podés consumir créditos de otra cuenta"— pero
-- `available_tournament_credits` no verificaba nada y devolvía el conteo de
-- cualquiera.
--
-- Con este cambio, aunque mañana alguien vuelva a otorgar permisos de más, la
-- función sigue sin entregar datos ajenos.

CREATE OR REPLACE FUNCTION available_tournament_credits(
  p_user_id    UUID,
  p_team_count INT DEFAULT 1
)
RETURNS TABLE (total INT, next_expiry TIMESTAMPTZ, max_teams INT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Cada quien consulta lo suyo. El service_role pasa porque las rutas del
  -- servidor ya verificaron de quién es la sesión.
  IF auth.uid() IS DISTINCT FROM p_user_id AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'No podés consultar los créditos de otra cuenta';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::INT                      AS total,
    MIN(c.expires_at)                  AS next_expiry,
    COALESCE(MAX(c.max_teams), 0)::INT AS max_teams
  FROM tournament_credits c
  WHERE c.user_id     = p_user_id
    AND c.consumed_at IS NULL
    AND c.expires_at  > now()
    AND c.max_teams  >= p_team_count;
END;
$$;

REVOKE ALL ON FUNCTION available_tournament_credits(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION available_tournament_credits(UUID, INT)
  TO authenticated, service_role;

-- ============================================================
-- Comprobación
-- ============================================================
-- Con la llave ANÓNIMA, las dos deben fallar (ya no responder 200):
--
--   select * from available_tournament_credits('<cualquier_user_id>', 12);
--   -- ERROR de permiso, o "No podés consultar los créditos de otra cuenta"
--
-- Con la sesión de un organizador, la suya debe funcionar:
--
--   select * from available_tournament_credits(auth.uid(), 12);
--   -- total = 0, next_expiry = null
