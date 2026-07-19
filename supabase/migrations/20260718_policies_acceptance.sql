-- Constancia de aceptación de políticas (privacidad + tratamiento de datos,
-- Ley 1581/2012) al momento del registro.
--
-- Cómo funciona:
--   1. El cliente, al registrarse, envía `policies_version` en los metadatos de
--      auth.users (options.data del signUp).
--   2. El trigger de abajo espeja esa aceptación a public.users, estampando la
--      fecha/hora del servidor. NO reemplaza el trigger existente que crea la
--      fila en public.users: corre después (nombre `zzz_`) y solo la actualiza.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS policies_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS policies_version text;

CREATE OR REPLACE FUNCTION public.sync_user_policies_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo si el usuario aceptó políticas al registrarse (viene la versión).
  IF NEW.raw_user_meta_data ? 'policies_version' THEN
    UPDATE public.users
       SET policies_version     = NEW.raw_user_meta_data ->> 'policies_version',
           policies_accepted_at = now()
     WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- El nombre `zzz_` garantiza que corra DESPUÉS del trigger que crea la fila en
-- public.users (los triggers se disparan en orden alfabético por nombre).
DROP TRIGGER IF EXISTS zzz_sync_user_policies ON auth.users;
CREATE TRIGGER zzz_sync_user_policies
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_policies_acceptance();
