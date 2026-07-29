-- ============================================================================
-- ¿Quién calificaría para "Monetizar"? Diagnóstico de los umbrales
-- ----------------------------------------------------------------------------
-- Consulta de UNA SOLA VEZ, para correr a mano en el editor SQL de Supabase.
-- No crea nada, no modifica nada, solo lee.
--
-- Para qué: los umbrales del Paso 3 (300 personas-día, 10 partidos, etc.) son
-- un punto de partida puesto sin mirar datos. Una barra a ciegas o deja pasar
-- a todos o no deja pasar a nadie. Esto muestra cada organizador contra cada
-- requisito, para elegir los números sabiendo a quién califican.
--
-- CÓMO LEERLA
-- La columna `nivel` dice hasta dónde llega hoy cada uno:
--   0 = ni ve la sección
--   1 = ve la sección y su progreso, pero no liquida
--   2 = liquidable este mes
-- Las columnas `f_*` dicen qué requisito de nivel 2 le falta, para ver si hay
-- uno solo que esté frenando a todos (señal de que ese umbral está mal puesto).
--
-- OJO con personas-día: sale de `page_views`, no de impresiones de publicidad,
-- porque la puerta no puede depender de que le hayas asignado una campaña.
-- Incluye las visitas del propio organizador — `page_views` no guarda si el
-- visitante estaba logueado, así que no se pueden descontar. Con umbral 300 eso
-- es ~10% de ruido. La migración que agrega esa marca está pendiente de
-- decisión; hasta entonces, leer estos números sabiendo que vienen infladitos.

WITH params AS (
  -- Mes en curso. Para probar contra un mes cerrado, cambiar por ejemplo a
  -- date_trunc('month', now()) - interval '1 month'.
  SELECT
    date_trunc('month', now())                        AS mes_desde,
    date_trunc('month', now()) + interval '1 month'   AS mes_hasta
),

-- Organizadores = quien tiene al menos un torneo. No se filtra por perfil:
-- justamente queremos ver a los que NO lo tienen completo.
orgs AS (
  SELECT DISTINCT t.created_by AS user_id
  FROM tournaments t
  WHERE t.created_by IS NOT NULL
),

-- NIVEL 1: torneo en curso, y el torneo en curso más grande que tenga.
en_curso AS (
  SELECT
    t.created_by AS user_id,
    COUNT(*)                                     AS torneos_en_curso,
    COALESCE(MAX(tt.equipos), 0)                 AS equipos_max
  FROM tournaments t
  LEFT JOIN (
    SELECT tournament_id, COUNT(*) AS equipos
    FROM tournament_teams
    GROUP BY tournament_id
  ) tt ON tt.tournament_id = t.id
  WHERE t.status = 'in-progress'
  GROUP BY t.created_by
),

-- NIVEL 2a: partidos con resultado CARGADO EN EL MES. Mide que el torneo se
-- esté operando, no que exista: el estado 'in-progress' lo pone el organizador
-- a mano y puede llevar meses abandonado.
--
-- Se usa `updated_at` porque es cuando se cargó el resultado; `date` es cuando
-- se jugó el partido, que puede ser de otro mes.
partidos AS (
  SELECT
    t.created_by AS user_id,
    COUNT(*)     AS partidos_con_resultado
  FROM matches m
  JOIN tournaments t ON t.id = m.tournament_id
  CROSS JOIN params p
  WHERE m.status = 'completed'
    AND (m.home_score IS NOT NULL OR m.away_score IS NOT NULL OR m.walkover IS TRUE)
    AND m.updated_at >= p.mes_desde
    AND m.updated_at <  p.mes_hasta
  GROUP BY t.created_by
),

-- NIVEL 2b: audiencia. Personas-día = pares (persona, día) distintos.
--
-- Se agrupa por ORGANIZADOR antes de contar, no por torneo: quien el mismo día
-- ve dos torneos del mismo organizador aporta 1. Es el mismo criterio que usa
-- el reparto (`by_organizer` en get_ad_analytics) — si acá se contara por
-- torneo y se sumara, la puerta sería más laxa que el pago.
audiencia AS (
  SELECT
    t.created_by AS user_id,
    COUNT(DISTINCT (pv.visitor_id, pv.created_at::date)) AS personas_dia,
    COUNT(DISTINCT pv.created_at::date)                  AS dias_con_audiencia,
    COUNT(DISTINCT pv.visitor_id)                        AS personas_distintas
  FROM page_views pv
  JOIN tournaments t ON t.id = pv.entity_id
  CROSS JOIN params p
  WHERE pv.entity_type = 'tournament'
    AND pv.visitor_id IS NOT NULL
    AND pv.created_at >= p.mes_desde
    AND pv.created_at <  p.mes_hasta
  GROUP BY t.created_by
),

base AS (
  SELECT
    o.user_id,
    COALESCE(op.organization_name, u.name, '(sin nombre)') AS organizador,
    u.created_at::date                            AS cuenta_creada,
    (now() - u.created_at) >= interval '30 days'   AS antiguedad_ok,
    (op.organization_name IS NOT NULL
      AND op.logo_url IS NOT NULL)                AS perfil_ok,
    COALESCE(ec.torneos_en_curso, 0)              AS torneos_en_curso,
    COALESCE(ec.equipos_max, 0)                   AS equipos_max,
    COALESCE(pa.partidos_con_resultado, 0)        AS partidos,
    COALESCE(au.personas_dia, 0)                  AS personas_dia,
    COALESCE(au.dias_con_audiencia, 0)            AS dias,
    COALESCE(au.personas_distintas, 0)            AS personas
  FROM orgs o
  JOIN users u                        ON u.id = o.user_id
  LEFT JOIN organization_profiles op  ON op.user_id = o.user_id
  LEFT JOIN en_curso ec               ON ec.user_id = o.user_id
  LEFT JOIN partidos pa               ON pa.user_id = o.user_id
  LEFT JOIN audiencia au              ON au.user_id = o.user_id
),

evaluado AS (
  SELECT
    b.*,
    -- Umbrales propuestos. Cambiar acá para probar otras barras.
    (b.torneos_en_curso >= 1 AND b.equipos_max >= 6) AS nivel1_ok,
    b.partidos     >= 10  AS n2_partidos,
    b.personas_dia >= 300 AS n2_personas_dia,
    b.dias         >= 8   AS n2_dias
  FROM base b
)

SELECT
  organizador,
  CASE
    WHEN nivel1_ok AND n2_partidos AND n2_personas_dia AND n2_dias
         AND antiguedad_ok AND perfil_ok THEN 2
    WHEN nivel1_ok THEN 1
    ELSE 0
  END                                     AS nivel,
  torneos_en_curso                        AS "torneos",
  equipos_max                             AS "equipos",
  partidos,
  personas_dia                            AS "pers_dia",
  dias,
  personas,
  cuenta_creada,
  -- Qué le falta para el nivel 2. Si una sola columna sale 'X' para casi
  -- todos, ese umbral es el que está mal puesto.
  CASE WHEN nivel1_ok        THEN '' ELSE 'X' END AS "f_nivel1",
  CASE WHEN n2_partidos      THEN '' ELSE 'X' END AS "f_partidos",
  CASE WHEN n2_personas_dia  THEN '' ELSE 'X' END AS "f_pers_dia",
  CASE WHEN n2_dias          THEN '' ELSE 'X' END AS "f_dias",
  CASE WHEN antiguedad_ok    THEN '' ELSE 'X' END AS "f_antig",
  CASE WHEN perfil_ok        THEN '' ELSE 'X' END AS "f_perfil"
FROM evaluado
ORDER BY nivel DESC, personas_dia DESC, partidos DESC;
