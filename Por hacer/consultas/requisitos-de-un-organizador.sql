-- ============================================================================
-- ¿Qué le falta a UN organizador para cobrar este mes?
-- ----------------------------------------------------------------------------
-- Para el editor SQL de Supabase. Solo lee, no toca nada.
--
-- Devuelve una fila por requisito, con lo que tiene, lo que necesita y cuánto
-- le falta. Sirve para cualquier organizador: se cambia el texto de búsqueda en
-- el bloque `params` de abajo y listo.
--
-- POR QUÉ NO SE LLAMA A `get_monetization_status`
-- Esa función es la fuente de verdad, pero arranca con `auth.uid()` y desde el
-- editor SQL no hay sesión, así que devolvería NULL. Acá se repite su cuenta.
--
-- ⚠️ Es una COPIA de la lógica de `get_monetization_status`
-- (`20260808e_dia_colombiano.sql`, al final). Si esa función cambia, esto queda
-- viejo y hay que actualizarlo. Lo que más importa mantener igual es
-- `co_day()`: agrupa por día COLOMBIANO y no por día UTC, que corta a las 7 de
-- la noche y contaría doble a quien entra a las 6 y vuelve a las 8.

-- ###########################################################################
-- PASO 1 — El detalle: qué le falta, requisito por requisito
-- ###########################################################################

WITH params AS (
  SELECT
    -- 👇 CAMBIAR ACÁ. Sirve parte del correo o parte del nombre.
    'MARCELIANO'::text                        AS buscar,
    date_trunc('month', co_day(now()))::date  AS mes
),
quien AS (
  SELECT u.id, u.name, u.email, u.created_at,
         COALESCE(u.revenue_share_excluded, false) AS excluido
  FROM users u, params p
  WHERE u.email ILIKE '%' || p.buscar || '%'
     OR u.name  ILIKE '%' || p.buscar || '%'
  ORDER BY u.name
  LIMIT 1
),
rango AS (
  SELECT co_start(p.mes) AS desde,
         co_start((p.mes + interval '1 month')::date) AS hasta
  FROM params p
),
cfg AS (SELECT * FROM monetization_config WHERE id),

-- Nivel 1: que tenga un torneo andando y con equipos suficientes.
en_curso AS (
  SELECT
    COUNT(*)                     AS torneos_en_curso,
    COALESCE(MAX(tt.equipos), 0) AS equipos_max
  FROM tournaments t
  JOIN quien q ON q.id = t.created_by
  LEFT JOIN (
    SELECT tournament_id, COUNT(*) AS equipos
    FROM tournament_teams GROUP BY tournament_id
  ) tt ON tt.tournament_id = t.id
  WHERE t.status = 'in-progress'
),

-- Nivel 2a: partidos con resultado CARGADO en el mes. Se mira `updated_at`
-- (cuándo se cargó) y no `date` (cuándo se jugó): mide que el torneo se esté
-- operando, no que exista.
partidos AS (
  SELECT COUNT(*) AS partidos_con_resultado
  FROM matches m
  JOIN tournaments t ON t.id = m.tournament_id
  JOIN quien q       ON q.id = t.created_by
  CROSS JOIN rango r
  WHERE m.status = 'completed'
    AND (m.home_score IS NOT NULL OR m.away_score IS NOT NULL OR m.walkover IS TRUE)
    AND m.updated_at >= r.desde
    AND m.updated_at <  r.hasta
),

-- Nivel 2b: audiencia. Sale de las VISITAS a los torneos, no de impresiones de
-- publicidad: la puerta no puede depender de que se le haya asignado campaña.
audiencia AS (
  SELECT
    COUNT(DISTINCT (pv.visitor_id, co_day(pv.created_at))) AS personas_dia,
    COUNT(DISTINCT co_day(pv.created_at))                  AS dias_con_audiencia
  FROM page_views pv
  JOIN tournaments t ON t.id = pv.entity_id
  JOIN quien q       ON q.id = t.created_by
  CROSS JOIN rango r
  WHERE pv.entity_type = 'tournament'
    AND pv.visitor_id IS NOT NULL
    -- Excluye al propio organizador mirando su torneo.
    AND pv.is_authenticated IS NOT TRUE
    AND pv.created_at >= r.desde
    AND pv.created_at <  r.hasta
),

perfil AS (
  SELECT
    (op.organization_name IS NOT NULL AND op.logo_url IS NOT NULL) AS perfil_ok,
    (pi.user_id IS NOT NULL)                                       AS datos_pago_ok,
    (pi.approval_status = 'approved')                              AS aprobado,
    COALESCE(pi.approval_status, 'no se inscribió')                AS estado_aprobacion
  FROM quien q
  LEFT JOIN organization_profiles op ON op.user_id = q.id
  LEFT JOIN organizer_payout_info pi ON pi.user_id = q.id
),

filas AS (
  SELECT 1 AS orden, 'Nivel 1' AS nivel, 'Torneos en curso' AS requisito,
         ec.torneos_en_curso::numeric AS tiene, c.min_tournaments_in_progress::numeric AS necesita
  FROM en_curso ec, cfg c
  UNION ALL
  SELECT 2, 'Nivel 1', 'Equipos en su torneo más grande',
         ec.equipos_max, c.min_teams FROM en_curso ec, cfg c
  UNION ALL
  SELECT 3, 'Nivel 2', 'Personas que entraron a sus torneos',
         au.personas_dia, c.min_person_days FROM audiencia au, cfg c
  UNION ALL
  SELECT 4, 'Nivel 2', 'Días con audiencia',
         au.dias_con_audiencia, c.min_active_days FROM audiencia au, cfg c
  UNION ALL
  SELECT 5, 'Nivel 2', 'Partidos con resultado cargado este mes',
         pa.partidos_con_resultado, c.min_matches_with_result FROM partidos pa, cfg c
  UNION ALL
  SELECT 6, 'Nivel 2', 'Días desde que creó la cuenta',
         EXTRACT(day FROM (now() - q.created_at))::numeric, c.min_account_age_days
  FROM quien q, cfg c
  UNION ALL
  SELECT 7, 'Nivel 2', 'Perfil con nombre y logo',
         CASE WHEN pf.perfil_ok THEN 1 ELSE 0 END,
         CASE WHEN c.require_profile THEN 1 ELSE 0 END FROM perfil pf, cfg c
  UNION ALL
  SELECT 8, 'Nivel 2', 'Datos de pago cargados',
         CASE WHEN pf.datos_pago_ok THEN 1 ELSE 0 END, 1 FROM perfil pf
  UNION ALL
  SELECT 9, 'Nivel 2', 'Datos de pago APROBADOS por vos',
         CASE WHEN pf.aprobado THEN 1 ELSE 0 END, 1 FROM perfil pf
)

SELECT
  (SELECT name  FROM quien)  AS organizador,
  (SELECT email FROM quien)  AS email,
  f.nivel,
  f.requisito,
  f.tiene,
  f.necesita,
  CASE WHEN f.tiene >= f.necesita THEN '✅ cumple'
       ELSE '❌ le faltan ' || (f.necesita - f.tiene)::text END AS estado
FROM filas f
ORDER BY f.orden;

-- CÓMO LEERLA
--   Nivel 1 = si no lo cumple, ni siquiera ve la sección con su progreso.
--   Nivel 2 = tiene que cumplirlos TODOS para que el mes se le liquide.
--   En "Perfil", "Datos de pago" y "Aprobados", 1 = sí y 0 = no.
--
-- ⚠️ Si el organizador está EXCLUIDO por política, nada de esto aplica: no
-- cobra aunque cumpla todo. Lo dice el PASO 2.


-- ###########################################################################
-- PASO 2 — El resumen, en una sola fila
-- ###########################################################################

WITH params AS (
  SELECT 'MARCELIANO'::text AS buscar   -- 👈 el mismo de arriba
),
quien AS (
  SELECT u.id, u.name, u.email, COALESCE(u.revenue_share_excluded, false) AS excluido
  FROM users u, params p
  WHERE u.email ILIKE '%' || p.buscar || '%' OR u.name ILIKE '%' || p.buscar || '%'
  ORDER BY u.name LIMIT 1
)
SELECT
  q.name                                    AS organizador,
  q.email,
  CASE WHEN q.excluido THEN '🚫 EXCLUIDO por política — no cobra nunca'
       ELSE 'participa del reparto' END     AS participacion,
  COALESCE(pi.approval_status, 'no se inscribió a Monetizar') AS datos_de_pago,
  pi.rejection_reason                       AS motivo_del_rechazo,
  (SELECT COUNT(*) FROM tournaments t WHERE t.created_by = q.id) AS torneos_totales
FROM quien q
LEFT JOIN organizer_payout_info pi ON pi.user_id = q.id;


-- ###########################################################################
-- PASO 3 — Los mínimos que están puestos hoy
-- ###########################################################################
-- Se mueven con un UPDATE sobre esta misma tabla, sin desplegar nada. Están
-- pendientes de calibrar con agosto completo.

SELECT
  min_tournaments_in_progress AS torneos_en_curso,
  min_teams                   AS equipos,
  min_person_days             AS personas_dia,
  min_active_days             AS dias_con_audiencia,
  min_matches_with_result     AS partidos_con_resultado,
  min_account_age_days        AS dias_de_antiguedad,
  require_profile             AS exige_perfil,
  require_payout_info         AS exige_datos_pago
FROM monetization_config;
