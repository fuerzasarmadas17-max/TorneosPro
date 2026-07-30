-- ============================================================================
-- Arreglar el tiempo promedio por visita (mostraba 0s desde siempre)
-- ----------------------------------------------------------------------------
-- DIAGNÓSTICO (2026-07-29)
-- La tarjeta "Tiempo promedio" mostraba 0s. No era "poco tiempo": la consulta
-- usa AVG(NULLIF(duration_ms, 0)), que ignora los ceros, así que un 0 significa
-- que NINGUNA fila tenía duración.
--
-- `use-page-view.ts` inserta la fila y después manda un PATCH con la duración
-- cuando la pestaña se oculta o se cierra. Probado contra la base:
--
--   INSERT de una fila           -> 201
--   PATCH a ESA fila             -> 204, content-range: */0   (cero afectadas)
--   PATCH a un id inexistente    -> 204, content-range: */0   (idéntico)
--
-- O sea el UPDATE se filtraba en silencio: RLS está activo en `page_views` y la
-- policy de UPDATE que figura en `schema.sql` ("Anyone can update duration on
-- their own views") no estaba aplicada en la base real. Un UPDATE que no pasa
-- RLS no da error, simplemente afecta 0 filas — por eso nunca se notó.
--
-- POR QUÉ UNA RPC Y NO LA POLICY QUE FALTABA
-- Crear la policy con USING (true) arreglaría la duración pero abriría un
-- agujero peor: con el privilegio de UPDATE sobre la tabla, cualquier anónimo
-- podría cambiar `visitor_id` o `entity_id` de cualquier fila — y esos SÍ
-- alimentan el reparto de plata. Falsear analítica es molesto; falsear
-- personas-día es robar.
--
-- Con esta RPC el anónimo no recibe UPDATE sobre la tabla: solo puede llamar
-- una función que toca UNA columna, con las cotas de abajo.

CREATE OR REPLACE FUNCTION record_view_duration(
  p_view_id     uuid,
  p_duration_ms integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_view_id IS NULL OR p_duration_ms IS NULL OR p_duration_ms <= 0 THEN
    RETURN;
  END IF;

  UPDATE page_views
  SET duration_ms = GREATEST(
        COALESCE(duration_ms, 0),
        -- Tope de 4 horas: una pestaña abierta toda la noche no es tiempo de
        -- lectura, y sin tope un solo valor absurdo arrastra el promedio.
        LEAST(p_duration_ms, 4 * 60 * 60 * 1000)
      )
  WHERE id = p_view_id
    -- GREATEST y no asignación directa: el cliente manda la duración varias
    -- veces (al ocultar la pestaña, al cerrar, al desmontar) y cada envío es
    -- mayor que el anterior. Quedarse con el máximo evita que el último envío
    -- —o alguien malintencionado— baje un valor ya registrado.
    --
    -- Y solo filas del último día, para que esto no sea una puerta para
    -- reescribir la duración de todo el histórico.
    AND created_at > now() - interval '1 day';
END;
$$;

COMMENT ON FUNCTION record_view_duration(uuid, integer) IS
  'Registra cuánto duró una visita. Existe porque `page_views` no tiene policy de UPDATE y darle ese privilegio al anónimo le permitiría falsear visitor_id/entity_id, que alimentan el reparto de publicidad. Solo sube la duración, tope 4h, solo filas del último día.';

-- La función es el único camino para escribir la duración; el rol anónimo no
-- necesita UPDATE sobre la tabla.
GRANT EXECUTE ON FUNCTION record_view_duration(uuid, integer) TO anon, authenticated;

-- Fila que se insertó el 2026-07-29 probando por qué el PATCH no funcionaba.
DELETE FROM page_views WHERE page_path = '/__test-duracion';
