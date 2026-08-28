-- ============================================================================
-- Bienvenida: no preguntarle a quien ya demostró a qué vino
-- ----------------------------------------------------------------------------
-- El modal le pregunta al usuario nuevo si viene a organizar o a mirar. A quien
-- ya creó un torneo con nosotros, preguntárselo es ruido: la respuesta ya está
-- en los hechos.
--
-- Se marcan como 'organizar' tres grupos, y en los tres el dato es CIERTO, no
-- un truco para apagar el modal:
--
--   1. Los que ya crearon un torneo.
--   2. Los que llegaron a la pantalla de pago aunque no hayan terminado. Es el
--      caso de William Barrera: llenó el formulario entero del torneo "WB GAMMA
--      KINGS", 16 equipos, y se cayó en Wompi. El torneo no existe porque sólo
--      se crea al aprobarse el pago, pero organizador es.
--   3. Los admin, que somos nosotros.
--
-- Al 2026-08-28 esto cubre 12 personas y deja 32 que siguen viendo el modal:
-- justamente las que nunca hicieron nada, que son las que hay que entender.
--
-- ⚠️ Sólo toca filas con `signup_intent` en NULL: a nadie que ya haya
-- contestado se le pisa la respuesta.
--
-- ----------------------------------------------------------------------------
-- OJO AL MEDIR DESPUÉS
-- ----------------------------------------------------------------------------
-- Estas 12 filas dicen 'organizar' sin que nadie haya tocado el modal. Para
-- medir qué contesta la gente de verdad hay que filtrar por fecha de alta, que
-- es lo que hace la consulta del final: los 12 son todos anteriores al 28 de
-- agosto y quedan fuera solos.
-- ============================================================================

-- ------------------------------------------------------------------
-- 1. Ver a quién afecta ANTES de tocar nada (opcional, pero conviene)
-- ------------------------------------------------------------------
-- SELECT u.name, u.email, u.role,
--        EXISTS (SELECT 1 FROM tournaments t WHERE t.created_by = u.id) AS creo_torneo,
--        EXISTS (SELECT 1 FROM payments  p WHERE p.user_id    = u.id) AS intento_pagar
--   FROM users u
--  WHERE u.signup_intent IS NULL
--    AND (u.role = 'admin'
--         OR EXISTS (SELECT 1 FROM tournaments t WHERE t.created_by = u.id)
--         OR EXISTS (SELECT 1 FROM payments  p WHERE p.user_id    = u.id));

-- ------------------------------------------------------------------
-- 2. Apagarles el modal
-- ------------------------------------------------------------------
UPDATE users u
   SET signup_intent    = 'organizar',
       signup_intent_at = now()
 WHERE u.signup_intent IS NULL
   AND (
        u.role = 'admin'
     OR EXISTS (SELECT 1 FROM tournaments t WHERE t.created_by = u.id)
     OR EXISTS (SELECT 1 FROM payments    p WHERE p.user_id    = u.id)
   );

-- ------------------------------------------------------------------
-- 3. Comprobar
-- ------------------------------------------------------------------
-- Cuántos quedan viendo el modal (deberían ser los que nunca hicieron nada):
--
--   select count(*) from users where signup_intent is null;
--
-- Y la que importa de verdad, dentro de una semana — sólo altas nuevas, así
-- que las 12 marcadas acá no la ensucian:
--
--   select coalesce(signup_intent, 'sin responder') as vino_a, count(*)
--     from users
--    where created_at >= '2026-08-28'
--    group by 1 order by 2 desc;
