-- ============================================================================
-- ¿Quién vino a organizar y quién vino a mirar?
-- ----------------------------------------------------------------------------
-- Responde la pregunta de agosto de 2026: de 22 altas, 20 no hicieron nada.
-- ¿Eran organizadores que se trabaron, o espectadores que llegaron por el link
-- de WhatsApp de un torneo? Son dos problemas opuestos y se arreglan al revés.
--
-- ⚠️ Filtrar SIEMPRE por fecha de alta. El 2026-08-28 se marcaron 12 usuarios
-- viejos como 'organizar' sin que tocaran el modal (los que ya habían creado un
-- torneo o llegado a pagar). Si no se filtra, esos 12 inflan el resultado.
-- ============================================================================


-- ============================================================
-- 1. EL RESUMEN — sólo altas nuevas
-- ============================================================
SELECT COALESCE(signup_intent, 'sin responder') AS vino_a,
       COUNT(*)                                  AS personas,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS porcentaje
  FROM users
 WHERE created_at >= '2026-08-28'
 GROUP BY 1
 ORDER BY personas DESC;

-- Cómo leerlo:
--   Mayoría 'ver'        -> las altas son espectadores. Son ruido, no
--                           crecimiento: dejar de contarlas como clientes.
--   Mayoría 'organizar'  -> son clientes y se están trabando. Ahí sí hay que
--                           arreglar el arranque, y la consulta 3 dice a quién
--                           llamar.
--   Mayoría sin responder-> cierran el modal sin contestar. Habría que
--                           replantear la pregunta.


-- ============================================================
-- 2. UNO POR UNO, con lo que hizo después
-- ============================================================
-- Lo que dijo contra lo que hizo. La respuesta del modal es una intención;
-- esta consulta la contrasta con los hechos.
SELECT u.created_at::date                    AS se_registro,
       u.name,
       u.email,
       COALESCE(u.signup_intent,'sin responder') AS dijo_que_venia_a,
       (SELECT COUNT(*) FROM tournaments t WHERE t.created_by = u.id) AS torneos_creados,
       (SELECT COUNT(*) FROM payments    p WHERE p.user_id    = u.id) AS intentos_de_pago
  FROM users u
 WHERE u.created_at >= '2026-08-28'
 ORDER BY u.created_at DESC;


-- ============================================================
-- 3. LA LISTA PARA LLAMAR  ← la que de verdad sirve
-- ============================================================
-- Dijo que venía a organizar, pasaron más de 2 días y no creó nada ni intentó
-- pagar. Se trabó en algún lado y todavía está a tiempo de rescatarlo.
SELECT u.created_at::date AS se_registro,
       u.name,
       u.email,
       now()::date - u.created_at::date AS dias_desde_que_se_registro
  FROM users u
 WHERE u.signup_intent = 'organizar'
   AND u.created_at >= '2026-08-28'
   AND u.created_at < now() - interval '2 days'
   AND NOT EXISTS (SELECT 1 FROM tournaments t WHERE t.created_by = u.id)
   AND NOT EXISTS (SELECT 1 FROM payments    p WHERE p.user_id    = u.id)
 ORDER BY u.created_at;
