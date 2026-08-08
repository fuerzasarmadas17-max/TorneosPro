-- ============================================================================
-- Aceptación de los términos del programa de monetización
-- ----------------------------------------------------------------------------
-- El plan lo dejaba abierto: "hace falta guardar cuándo aceptó y qué versión —
-- eso es una tabla o un par de columnas todavía por definir".
--
-- Van como columnas de `organizer_payout_info` y no en una tabla aparte porque
-- son el mismo hecho: el organizador entra por primera vez a "Monetizar", llena
-- a dónde transferirle y acepta las condiciones, todo en la misma pantalla y en
-- el mismo guardado. Separarlo en dos tablas permitiría estados que la pantalla
-- no puede producir (aceptó pero no dejó cuenta, dejó cuenta pero no aceptó) y
-- que después habría que decidir cómo tratar.
--
-- ⚠️ DE QUÉ DEPENDE QUE ESTO SIRVA DE VERDAD
-- Como el formulario guarda las dos cosas a la vez, "tiene datos de pago"
-- implica "aceptó los términos". Por eso el requisito de elegibilidad sigue
-- siendo `require_payout_info` y no se agregó uno nuevo a
-- `get_monetization_status`: sería una segunda cuenta de lo mismo.
--
-- Esa implicación se rompe si algún día se insertan datos de pago por otra vía
-- —una carga a mano, un panel de admin, un backfill—. Si eso pasa, hay que
-- agregar el requisito de términos como uno propio. Queda escrito acá porque no
-- se va a notar solo: el organizador simplemente cobraría sin haber aceptado
-- nada, y no hay ningún error que lo delate.

ALTER TABLE organizer_payout_info
  ADD COLUMN IF NOT EXISTS terms_version     TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN organizer_payout_info.terms_version IS
  'Versión de los términos del programa que aceptó (ver MONETIZAR_TERMS_VERSION en src/lib/monetizar-terms.ts). Si los términos cambian, la app vuelve a pedirle que acepte porque la versión guardada deja de coincidir.';
COMMENT ON COLUMN organizer_payout_info.terms_accepted_at IS
  'Cuándo aceptó. Se sella con now() del servidor, no con la hora del navegador: es la prueba de que aceptó y no puede depender del reloj de quien acepta.';

-- ============================================================
-- El sello lo pone la base, no el cliente
-- ============================================================
-- Sin esto, `terms_accepted_at` viajaría en el body del upsert y sería un dato
-- que el navegador elige. Para un campo que existe justamente como constancia,
-- eso lo deja sin valor.
--
-- El trigger lo estampa cada vez que la versión aceptada cambia (y en el alta).
-- Si el organizador edita su cuenta bancaria sin que los términos hayan
-- cambiado, la fecha original se conserva: es la fecha en que aceptó, no la de
-- la última edición.

CREATE OR REPLACE FUNCTION stamp_terms_acceptance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.terms_version IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.terms_version IS DISTINCT FROM OLD.terms_version)
  THEN
    NEW.terms_accepted_at := now();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.terms_accepted_at := OLD.terms_accepted_at;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_terms_acceptance ON organizer_payout_info;
CREATE TRIGGER trg_stamp_terms_acceptance
  BEFORE INSERT OR UPDATE ON organizer_payout_info
  FOR EACH ROW EXECUTE FUNCTION stamp_terms_acceptance();

-- ============================================================
-- Comprobación
-- ============================================================
-- Con la sesión de un organizador:
--
--   insert into organizer_payout_info
--     (user_id, full_name, document_number, bank, account_type,
--      account_number, terms_version, terms_accepted_at)
--   values (auth.uid(), 'Prueba Prueba', '1234567', 'Bancolombia', 'ahorros',
--           '123456789', 'v1', '2001-01-01');
--
--   select terms_version, terms_accepted_at from organizer_payout_info;
--   -- terms_accepted_at debe ser HOY, no 2001: el trigger ignora lo que mandó
--   -- el cliente.
