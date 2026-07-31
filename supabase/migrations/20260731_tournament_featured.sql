-- ============================================================================
-- Torneo destacado en la portada
-- ----------------------------------------------------------------------------
-- La landing nueva tiene una sección "TORNEO DESTACADO" arriba de la grilla.
-- Decisión del organizador (2026-07-30): lo marca el admin a mano, no se
-- calcula solo (ni por audiencia ni por fecha) — es una decisión editorial.
--
-- Si no hay ninguno marcado, la sección no se renderiza. La portada no puede
-- depender de que alguien se acuerde de marcar uno.
--
-- ⚠️ POR QUÉ HAY UN TRIGGER Y NO ALCANZA CON LA COLUMNA
-- `schema.sql` tiene esta policy:
--
--     CREATE POLICY "Creador edita torneo"
--       ON tournaments FOR ALL USING (created_by = auth.uid());
--
-- O sea que cada organizador puede hacer UPDATE de su propio torneo desde el
-- navegador. Sin candado, cualquiera se pone en la portada con un update
-- desde la consola del browser — que es exactamente lo que la decisión de
-- arriba quiere evitar. La columna sola no protege nada: el permiso de
-- escritura ya está dado.

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN tournaments.featured IS
  'Destacado en la portada. Solo lo cambia un admin (ver trigger trg_guard_tournament_featured). Varios marcados = carrusel.';

-- Índice parcial: la portada pregunta "¿cuáles están destacados?" y espera
-- uno o dos de cientos. Indexar solo las filas en true mantiene el índice
-- diminuto.
CREATE INDEX IF NOT EXISTS idx_tournaments_featured
  ON tournaments(featured) WHERE featured;

-- ============================================================
-- El candado
-- ============================================================
-- Solo un admin (o el service_role, que es como llama nuestra propia ruta
-- /api/admin/tournaments/[id]/featured) puede tocar `featured`. El resto de
-- las columnas sigue igual: el organizador edita su torneo como siempre.

CREATE OR REPLACE FUNCTION guard_tournament_featured()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- En UPDATE solo importa si el valor cambia: si el organizador guarda el
  -- torneo sin tocar `featured`, no hay nada que bloquear.
  IF TG_OP = 'UPDATE' AND NEW.featured IS NOT DISTINCT FROM OLD.featured THEN
    RETURN NEW;
  END IF;

  -- En INSERT solo importa si viene en true: crear un torneo normal (false,
  -- el default) no requiere ser admin.
  IF TG_OP = 'INSERT' AND NEW.featured IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- El service_role ya pasó por `requireAdmin` en la ruta de la API.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION
      'Solo un admin puede destacar un torneo en la portada';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_tournament_featured ON tournaments;
CREATE TRIGGER trg_guard_tournament_featured
  BEFORE INSERT OR UPDATE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION guard_tournament_featured();

-- ============================================================
-- Comprobación
-- ============================================================
-- Después de correrla, con la sesión de un organizador que NO sea admin:
--
--     UPDATE tournaments SET featured = true WHERE id = '<un torneo suyo>';
--     -- debe fallar con "Solo un admin puede destacar un torneo en la portada"
--
-- Y que su UPDATE de siempre siga funcionando:
--
--     UPDATE tournaments SET name = name WHERE id = '<un torneo suyo>';
--     -- debe pasar sin error
