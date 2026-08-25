-- ============================================================================
-- Vóley: rellenar con parciales TENTATIVOS los partidos que no tienen sets
-- ----------------------------------------------------------------------------
-- Correr en el editor SQL de Supabase, **de a un paso por vez**.
-- Encontrados con `voley-resultados-sin-sets.sql` (13 partidos al 2026-08-25).
--
-- ⚠️⚠️ LEER ESTO ANTES DE CORRERLO
--
-- Los parciales que esto escribe SON INVENTADOS. Nadie sabe si aquel set fue
-- 25-20 o 25-23. Y los puntos de cada set son **desempate en la tabla** (ratio
-- de puntos), así que esto puede cambiar quién clasifica en un torneo.
--
-- El problema de fondo: un partido sin sets se ve roto y alguien lo arregla; un
-- partido con parciales inventados se ve correcto para siempre.
--
-- Por eso esto NO trata de adivinar resultados creíbles. Escribe el mismo
-- parcial para todos —25-20, y 15-10 si es set definitorio— y lo firma como
-- `PARCIAL TENTATIVO`. Dos consecuencias buscadas:
--
--   1. Los sets ganados y el ratio de sets quedan CORRECTOS (eso sí se sabe:
--      sale del marcador). Solo el ratio de puntos queda inventado, y queda
--      igual para todos los equipos, así que no favorece a ninguno.
--   2. Se pueden encontrar después, uno por uno, con el PASO E.
--
-- **Lo correcto sigue siendo cargarlos a mano con la planilla de papel.** Esto
-- es un parche para que la tabla deje de estar mal mientras tanto.

-- ---------------------------------------------------------------------------
-- PASO A — Separar los dos tipos de problema
-- ---------------------------------------------------------------------------
-- Solo el primer grupo se puede rellenar solo. El segundo NO: ahí ya hay sets
-- cargados y no se sabe si lo que está mal es el marcador o los sets, así que
-- pisarlos borraría datos reales.

SELECT
  CASE WHEN x.sets_cargados = 0
       THEN 'A — sin ningún set: lo rellena el PASO B'
       ELSE 'B — tiene sets pero no cuadran: A MANO, ver PASO C' END AS grupo,
  COUNT(*) AS partidos
FROM (
  SELECT m.id,
         COUNT(vs.match_id) AS sets_cargados,
         COALESCE(m.home_score,0) + COALESCE(m.away_score,0) AS esperados,
         COUNT(vs.match_id) FILTER (WHERE vs.home_points > vs.away_points) AS gl,
         COUNT(vs.match_id) FILTER (WHERE vs.away_points > vs.home_points) AS gv,
         COUNT(vs.match_id) FILTER (WHERE vs.home_points = vs.away_points) AS emp,
         m.home_score, m.away_score
  FROM matches m
  JOIN tournaments t           ON t.id = m.tournament_id
  LEFT JOIN volleyball_sets vs ON vs.match_id = m.id
  WHERE t.sport = 'volleyball' AND m.status = 'completed'
  GROUP BY m.id
) x
WHERE x.sets_cargados <> x.esperados
   OR x.gl <> COALESCE(x.home_score,0)
   OR x.gv <> COALESCE(x.away_score,0)
   OR x.emp > 0
GROUP BY 1;

-- ---------------------------------------------------------------------------
-- PASO B — Rellenar los que no tienen NINGÚN set
-- ---------------------------------------------------------------------------
-- Reglas del relleno:
--   · Tantos sets como diga el marcador (un 2-1 son tres).
--   · Primero los sets del perdedor y al final los del ganador, para que el
--     partido termine justo cuando el ganador llega a su último set.
--   · 25-20 siempre; 15-10 si es el set definitorio (cuando el partido llegó
--     hasta el último set posible del `best_of`).
--
-- Es idempotente: si lo corrés dos veces, la segunda no toca nada, porque el
-- partido ya deja de tener cero sets.

WITH sin_sets AS (
  SELECT
    m.id,
    m.home_score,
    m.away_score,
    COALESCE(t.best_of, 3) AS best_of
  FROM matches m
  JOIN tournaments t           ON t.id = m.tournament_id
  LEFT JOIN volleyball_sets vs ON vs.match_id = m.id
  WHERE t.sport = 'volleyball'
    AND m.status = 'completed'
    AND m.home_score IS NOT NULL
    AND m.away_score IS NOT NULL
    AND m.home_score + m.away_score > 0
  GROUP BY m.id, m.home_score, m.away_score, t.best_of
  HAVING COUNT(vs.match_id) = 0
),
filas AS (
  SELECT
    s.id AS match_id,
    n    AS set_number,
    ((n > LEAST(s.home_score, s.away_score)) = (s.home_score > s.away_score))
      AS lo_gana_local,
    (n = s.best_of AND s.home_score + s.away_score = s.best_of)
      AS es_definitorio
  FROM sin_sets s
  CROSS JOIN generate_series(1, s.home_score + s.away_score) AS n
)
INSERT INTO volleyball_sets
  (match_id, set_number, home_points, away_points, entered_by_name)
SELECT
  match_id,
  set_number,
  CASE WHEN lo_gana_local
       THEN CASE WHEN es_definitorio THEN 15 ELSE 25 END
       ELSE CASE WHEN es_definitorio THEN 10 ELSE 20 END END,
  CASE WHEN lo_gana_local
       THEN CASE WHEN es_definitorio THEN 10 ELSE 20 END
       ELSE CASE WHEN es_definitorio THEN 15 ELSE 25 END END,
  'PARCIAL TENTATIVO'
FROM filas;

-- ---------------------------------------------------------------------------
-- PASO C — Los que hay que mirar a mano
-- ---------------------------------------------------------------------------
-- Tienen sets cargados que no cuadran con el marcador. Acá el SQL no puede
-- decidir: no se sabe si se equivocaron al escribir el marcador o al cargar un
-- set. Hay que abrir cada partido en el panel y arreglarlo con la planilla.

SELECT
  t.name                                 AS torneo,
  ht.name || ' vs ' || at.name           AS partido,
  m.home_score || ' - ' || m.away_score  AS marcador_dice,
  COUNT(vs.match_id) FILTER (WHERE vs.home_points > vs.away_points) || ' - ' ||
  COUNT(vs.match_id) FILTER (WHERE vs.away_points > vs.home_points) AS sets_dicen,
  string_agg(vs.home_points || '-' || vs.away_points, ' , '
             ORDER BY vs.set_number)     AS parciales,
  m.updated_at::date                     AS cargado_el
FROM matches m
JOIN tournaments t           ON t.id = m.tournament_id
LEFT JOIN teams ht           ON ht.id = m.home_team_id
LEFT JOIN teams at           ON at.id = m.away_team_id
JOIN volleyball_sets vs      ON vs.match_id = m.id
WHERE t.sport = 'volleyball' AND m.status = 'completed'
GROUP BY m.id, t.name, ht.name, at.name
HAVING COUNT(vs.match_id) <> COALESCE(m.home_score,0) + COALESCE(m.away_score,0)
    OR COUNT(vs.match_id) FILTER (WHERE vs.home_points > vs.away_points) <> COALESCE(m.home_score,0)
    OR COUNT(vs.match_id) FILTER (WHERE vs.away_points > vs.home_points) <> COALESCE(m.away_score,0)
    OR COUNT(vs.match_id) FILTER (WHERE vs.home_points = vs.away_points) > 0
ORDER BY m.updated_at DESC;

-- ---------------------------------------------------------------------------
-- PASO D — Verificación
-- ---------------------------------------------------------------------------
-- Volvé a correr `voley-resultados-sin-sets.sql`. Solo deberían quedar los del
-- grupo B (los del PASO C).

SELECT COUNT(*) AS sets_tentativos_escritos
FROM volleyball_sets
WHERE entered_by_name = 'PARCIAL TENTATIVO';

-- ---------------------------------------------------------------------------
-- PASO E — Encontrarlos después, para corregirlos de verdad
-- ---------------------------------------------------------------------------
-- Esta es la razón de firmarlos. Cuando aparezca la planilla de papel, o el
-- organizador se acuerde, se corrigen desde el panel y esta lista se vacía.

SELECT
  t.name                        AS torneo,
  ht.name || ' vs ' || at.name  AS partido,
  m.home_score || ' - ' || m.away_score AS marcador,
  string_agg(vs.home_points || '-' || vs.away_points, ' , '
             ORDER BY vs.set_number) AS parciales_inventados,
  m.date                        AS fecha_del_partido
FROM volleyball_sets vs
JOIN matches m      ON m.id = vs.match_id
JOIN tournaments t  ON t.id = m.tournament_id
LEFT JOIN teams ht  ON ht.id = m.home_team_id
LEFT JOIN teams at  ON at.id = m.away_team_id
WHERE vs.entered_by_name = 'PARCIAL TENTATIVO'
GROUP BY m.id, t.name, ht.name, at.name
ORDER BY t.name, m.date;

-- ---------------------------------------------------------------------------
-- DESHACER
-- ---------------------------------------------------------------------------
-- Si te arrepentís, vuelve todo a como estaba:
--
--   DELETE FROM volleyball_sets WHERE entered_by_name = 'PARCIAL TENTATIVO';
