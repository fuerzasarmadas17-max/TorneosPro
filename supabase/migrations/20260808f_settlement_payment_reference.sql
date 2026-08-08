-- ============================================================================
-- Constancia de cada transferencia: referencia, cuándo y quién la marcó
-- ----------------------------------------------------------------------------
-- Hasta hoy "Pagada" era solo un estado. Con dos organizadores alcanza; con
-- veinte, la pregunta "¿a este ya le pagamos?" no se puede responder mirando la
-- pantalla, y la respuesta vive en el extracto del banco o en la memoria de
-- alguien.
--
-- Se guarda la REFERENCIA de la transferencia —el número que devuelve el banco—
-- y no un comprobante en imagen. Es lo que de verdad sirve: se puede buscar en
-- el extracto, se copia y pega en un correo, y no ocupa almacenamiento ni hay
-- que decidir quién puede verlo.

ALTER TABLE ad_settlements
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN ad_settlements.payment_reference IS
  'Número de la transferencia según el banco. Obligatorio para marcar el corte como pagado: sin él, "Pagada" es una afirmación que nadie puede verificar después.';
COMMENT ON COLUMN ad_settlements.paid_by IS
  'Qué admin marcó el pago. Se sella solo, en el trigger.';

-- ============================================================
-- No se puede marcar "Pagada" sin referencia
-- ============================================================
-- La regla vive en la base y no solo en el formulario. Un corte marcado como
-- pagado sin referencia es exactamente el registro que va a hacer falta el día
-- que un organizador diga que no le llegó — y para entonces ya no hay forma de
-- reconstruirlo.
--
-- Reemplaza a `ad_settlements_freeze` (20260729f) conservando lo que hacía:
-- bloquear cualquier cambio a las cifras congeladas. Las columnas nuevas no
-- entran en esa lista, así que sí se pueden escribir.

CREATE OR REPLACE FUNCTION ad_settlements_freeze()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.period_month  IS DISTINCT FROM OLD.period_month
     OR NEW.organizer_id IS DISTINCT FROM OLD.organizer_id
     OR NEW.person_days  IS DISTINCT FROM OLD.person_days
     OR NEW.amount_cop   IS DISTINCT FROM OLD.amount_cop
     OR NEW.breakdown    IS DISTINCT FROM OLD.breakdown
     OR NEW.closed_at    IS DISTINCT FROM OLD.closed_at
  THEN
    RAISE EXCEPTION
      'ad_settlements es inmutable en las cifras: solo se puede cambiar status, paid_at y notes. Para corregir un corte hay que anularlo (status = void) y cerrar el mes de nuevo.';
  END IF;

  -- Al pasar a pagado: exigir la referencia y sellar el resto acá, no desde el
  -- navegador. La fecha y el autor de un pago son constancia; si los mandara el
  -- cliente, serían un dato que el cliente elige.
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    IF NEW.payment_reference IS NULL
       OR length(btrim(NEW.payment_reference)) < 3
    THEN
      RAISE EXCEPTION
        'Para marcar un corte como pagado hay que registrar la referencia de la transferencia.';
    END IF;
    NEW.payment_reference := btrim(NEW.payment_reference);
    NEW.paid_at := now();
    NEW.paid_by := auth.uid();
  END IF;

  -- Volver atrás (se marcó por error) limpia la constancia: dejar la referencia
  -- de un pago que no está pagado es peor que no tener ninguna.
  IF NEW.status IS DISTINCT FROM 'paid' AND OLD.status = 'paid' THEN
    NEW.payment_reference := NULL;
    NEW.paid_at := NULL;
    NEW.paid_by := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- Comprobación
-- ============================================================
-- Intentar marcar pagado sin referencia debe fallar:
--
--   update ad_settlements set status = 'paid' where id = '<algún id>';
--   -- ERROR: Para marcar un corte como pagado hay que registrar la referencia
--
-- Con referencia debe pasar y sellar fecha y autor solo:
--
--   update ad_settlements
--   set status = 'paid', payment_reference = '  123456  ', paid_at = '2001-01-01'
--   where id = '<algún id>';
--
--   select payment_reference, paid_at, paid_by from ad_settlements;
--   -- referencia sin espacios, paid_at de HOY (ignora el 2001 que mandó el
--   -- cliente), paid_by con el admin de la sesión.
