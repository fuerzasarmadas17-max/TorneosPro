-- ============================================================================
-- Modal de bienvenida: guardar a qué vino cada usuario nuevo
-- ----------------------------------------------------------------------------
-- QUÉ RESUELVE
-- En agosto de 2026 se registraron 22 personas y **20 no hicieron nada**: ni
-- un torneo, ni un intento de pago. En julio, de 8 altas, 4 crearon torneo.
-- La pregunta que no se podía responder era si esas 22 altas son organizadores
-- que se trabaron, o espectadores que llegaron por el link de WhatsApp de un
-- torneo y se registraron por curiosidad.
--
-- Son dos problemas opuestos: uno se arregla mejorando el arranque, el otro se
-- arregla dejando de contar esas altas como crecimiento. Sin este dato no se
-- sabe cuál de los dos se tiene.
--
-- El modal de bienvenida hace una sola pregunta y guarda la respuesta acá.
--
-- ⚠️ NO CAMBIA NADA DE LO QUE YA FUNCIONA. Agrega dos columnas nuevas
-- (opcionales) y una función. Para revertir: DROP FUNCTION + DROP COLUMN.
--
-- ----------------------------------------------------------------------------
-- POR QUÉ UNA FUNCIÓN Y NO UN UPDATE DIRECTO
-- ----------------------------------------------------------------------------
-- Hoy `users` NO tiene ninguna policy que deje a alguien modificar su propia
-- fila: sólo puede leerla. Y así debe seguir. Si se abriera un UPDATE sobre la
-- propia fila, cualquiera podría hacer `update users set role = 'admin'` desde
-- la consola del navegador y quedar de administrador.
--
-- Por eso la escritura pasa por una función SECURITY DEFINER que toca
-- exactamente una columna, sólo de quien la llama, y valida el valor.
-- ============================================================================

-- ============================================================
-- 1. Las columnas
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_intent    TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_intent_at TIMESTAMPTZ;

-- Sólo dos respuestas posibles. Si mañana se agrega una tercera opción al
-- modal, hay que tocar también este CHECK — es a propósito: obliga a decidir
-- qué significa la opción nueva antes de que empiece a llegar data sucia.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_signup_intent_check;
ALTER TABLE users ADD CONSTRAINT users_signup_intent_check
  CHECK (signup_intent IS NULL OR signup_intent IN ('organizar', 'ver'));

COMMENT ON COLUMN users.signup_intent IS
  'A qué dijo que venía en el modal de bienvenida: organizar (quiere armar un torneo) o ver (vino a mirar resultados). NULL = todavía no respondió.';

-- ============================================================
-- 2. La función que guarda la respuesta
-- ============================================================
-- Escribe una sola columna, sólo de quien la llama, y sólo la primera vez: la
-- respuesta es "a qué viniste", no "qué estás haciendo hoy". Si alguien vuelve
-- a llamarla, se ignora en silencio en vez de pisar el dato original.
CREATE OR REPLACE FUNCTION set_signup_intent(p_intent TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Hay que estar autenticado';
  END IF;

  IF p_intent NOT IN ('organizar', 'ver') THEN
    RAISE EXCEPTION 'Respuesta invalida: %', p_intent;
  END IF;

  UPDATE users
     SET signup_intent    = p_intent,
         signup_intent_at = now()
   WHERE id = auth.uid()
     AND signup_intent IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION set_signup_intent(TEXT) TO authenticated;

-- ============================================================
-- 3. Comprobación
-- ============================================================
-- Con la sesión de un usuario cualquiera:
--
--   select set_signup_intent('organizar');
--   select signup_intent, signup_intent_at from users where id = auth.uid();
--
-- Y el que importa de verdad, dentro de una semana:
--
--   select coalesce(signup_intent, 'sin responder') as vino_a, count(*)
--     from users
--    where created_at >= '2026-08-28'
--    group by 1 order by 2 desc;
