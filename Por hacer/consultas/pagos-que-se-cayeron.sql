-- ============================================================================
-- Los que dijeron que sí y se cayeron en el pago
-- ----------------------------------------------------------------------------
-- La lista de gente que llenó todo, le dio a pagar y no completó. Es la plata
-- más barata que hay: ya decidieron comprar.
--
-- Entre julio y agosto de 2026 fueron 7 intentos de 6 personas, $770.000 sólo
-- en agosto. Los dos más grandes eran el paquete de 5 torneos, de Abel y de
-- Daniel, con cuatro días de diferencia.
--
-- POR QUÉ SE QUEDAN EN 'pending'
-- El registro se crea con su referencia y su firma cuando le dan al botón, y
-- pasa a 'approved' cuando Wompi confirma. Si Wompi nunca confirma —porque
-- abandonaron la pantalla, o no tenían tarjeta, o prefieren Nequi— el registro
-- queda en 'pending' para siempre y nadie se entera.
--
-- OJO: 4 de los 9 pagos cobrados NO tienen transacción de Wompi. Son los que
-- escribieron por privado y pagaron por Nequi, y se marcaron a mano. O sea que
-- 'pending' no siempre significa "no pagó": puede significar "pagó por fuera y
-- quedó este registro colgado". Por eso la consulta 2 muestra si esa persona
-- pagó algo después.
-- ============================================================================


-- ============================================================
-- 1. LA LISTA PARA LLAMAR  ← la de todos los días
-- ============================================================
SELECT p.created_at::date                        AS intento,
       now()::date - p.created_at::date          AS dias,
       u.name,
       u.email,
       p.amount_cop                              AS monto,
       CASE
         WHEN p.tournament_data->>'type' = 'upgrade'
           THEN 'Upgrade a ' || COALESCE(p.tournament_data->>'newTier','?')
                || ' (+' || COALESCE(p.tournament_data->>'teamsToAdd','?') || ' equipos)'
         WHEN p.tournament_data->>'name' IS NOT NULL
           THEN 'Torneo nuevo: "' || (p.tournament_data->>'name') || '" · '
                || COALESCE(p.tournament_data->>'sport','?') || ' · '
                || COALESCE(p.tournament_data->>'teamCount','?') || ' equipos'
         ELSE 'Paquete de torneos'
       END                                       AS que_queria,
       -- Si pagó algo DESPUÉS de este intento, probablemente ya se resolvió
       -- (reintentó, o pagó por Nequi). Conviene mirarlo antes de escribir.
       EXISTS (
         SELECT 1 FROM payments p2
          WHERE p2.user_id = p.user_id
            AND p2.status  = 'approved'
            AND p2.created_at > p.created_at
       )                                          AS pago_algo_despues
  FROM payments p
  JOIN users    u ON u.id = p.user_id
 WHERE p.status = 'pending'
   -- Fuera las cuentas de prueba propias: son 12 de los 20 colgados y
   -- ensucian cualquier conclusión.
   AND u.email NOT LIKE 'fuerzasarmadas17%'
   AND u.role IS DISTINCT FROM 'admin'
   -- Un rato de gracia: alguien puede estar pagando en este momento.
   AND p.created_at < now() - interval '2 hours'
 ORDER BY p.created_at DESC;


-- ============================================================
-- 2. CUÁNTA PLATA ES, POR MES
-- ============================================================
SELECT to_char(p.created_at, 'YYYY-MM')                       AS mes,
       COUNT(*)                                                AS intentos_caidos,
       COUNT(DISTINCT p.user_id)                               AS personas,
       SUM(p.amount_cop)                                       AS plata_en_el_aire
  FROM payments p
  JOIN users    u ON u.id = p.user_id
 WHERE p.status = 'pending'
   AND u.email NOT LIKE 'fuerzasarmadas17%'
   AND u.role IS DISTINCT FROM 'admin'
 GROUP BY 1
 ORDER BY 1 DESC;


-- ============================================================
-- 3. QUÉ TAN BIEN CIERRA EL CHECKOUT
-- ============================================================
-- La foto de salud: de cada 10 que llegan a pagar, cuántos terminan.
SELECT to_char(p.created_at, 'YYYY-MM')                        AS mes,
       COUNT(*)                                                 AS intentos,
       COUNT(*) FILTER (WHERE p.status = 'approved')            AS cerrados,
       COUNT(*) FILTER (WHERE p.wompi_transaction_id IS NOT NULL) AS por_wompi,
       COUNT(*) FILTER (WHERE p.status = 'approved'
                          AND p.wompi_transaction_id IS NULL)   AS cobrados_por_fuera,
       ROUND(100.0 * COUNT(*) FILTER (WHERE p.status = 'approved') / COUNT(*), 0)
                                                                AS pct_cierre
  FROM payments p
  JOIN users    u ON u.id = p.user_id
 WHERE u.email NOT LIKE 'fuerzasarmadas17%'
   AND u.role IS DISTINCT FROM 'admin'
 GROUP BY 1
 ORDER BY 1 DESC;

-- Si `cobrados_por_fuera` sigue siendo alto, la pasarela no es el canal real
-- de cobro y la salida por WhatsApp deja de ser un parche: es el camino
-- principal, y habría que tratarlo como tal.
