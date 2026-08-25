-- ============================================================================
-- Vóley: partidos cargados con marcador pero con los sets mal o sin cargar
-- ----------------------------------------------------------------------------
-- Para correr a mano en el editor SQL de Supabase. Solo lee, no toca nada.
--
-- POR QUÉ EXISTE
-- Desde el 2026-08-25 el sistema no deja guardar un resultado de vóley cuyos
-- sets no cuadren con el marcador (`lib/volleyball-sets.ts`). Pero **eso vale
-- de ahí en adelante**: los partidos que ya se cargaron mal siguen ahí, y como
-- la tabla de posiciones desempata por ratio de sets y de puntos, cada uno le
-- está corriendo el orden a su torneo sin que nadie sepa por qué.
--
-- Esta consulta los encuentra.
--
-- QUÉ CUENTA COMO MAL CARGADO
-- En vóley el marcador ES la cuenta de sets: un 2-1 son tres sets, un 2-0 son
-- dos. Así que algo está mal si:
--   · no hay ningún set cargado
--   · la cantidad de sets no es home_score + away_score
--   · los sets ganados por cada lado no coinciden con el marcador
--   · algún set quedó empatado

WITH voley AS (
  SELECT
    m.id,
    m.tournament_id,
    m.home_team_id,
    m.away_team_id,
    m.home_score,
    m.away_score,
    m.walkover,
    m.updated_at,
    m.result_entered_by_name,
    m.result_entered_via_token,
    COUNT(vs.match_id)                                              AS sets_cargados,
    COUNT(vs.match_id) FILTER (WHERE vs.home_points > vs.away_points) AS gano_local,
    COUNT(vs.match_id) FILTER (WHERE vs.away_points > vs.home_points) AS gano_visitante,
    COUNT(vs.match_id) FILTER (WHERE vs.home_points = vs.away_points) AS sets_empatados
  FROM matches m
  JOIN tournaments t              ON t.id = m.tournament_id
  LEFT JOIN volleyball_sets vs    ON vs.match_id = m.id
  WHERE t.sport = 'volleyball'
    AND m.status = 'completed'
  GROUP BY m.id
)
SELECT
  t.name                                   AS torneo,
  COALESCE(op.organization_name, u.name)   AS organizador,
  ht.name || ' vs ' || at.name             AS partido,
  v.home_score || ' - ' || v.away_score    AS marcador,
  v.sets_cargados,
  COALESCE(v.home_score, 0) + COALESCE(v.away_score, 0) AS sets_que_deberia_tener,
  v.gano_local || ' - ' || v.gano_visitante AS sets_dicen,
  v.updated_at::date                       AS cargado_el,
  (CURRENT_DATE - v.updated_at::date)      AS hace_dias,
  COALESCE(v.result_entered_by_name, '—')  AS lo_cargo,
  CASE
    WHEN v.result_entered_via_token IS NOT NULL THEN 'link externo'
    ELSE 'organizador'
  END                                      AS por_donde,
  v.walkover                               AS fue_w,

  CASE
    WHEN v.sets_empatados > 0            THEN '🔴 hay un set empatado'
    WHEN v.sets_cargados = 0             THEN '🔴 sin ningún set cargado'
    WHEN v.sets_cargados <> COALESCE(v.home_score,0) + COALESCE(v.away_score,0)
      THEN '🔴 cantidad de sets no cuadra'
    ELSE '🔴 los sets no dan el marcador'
  END                                      AS problema

FROM voley v
JOIN tournaments t                 ON t.id = v.tournament_id
JOIN users u                       ON u.id = t.created_by
LEFT JOIN organization_profiles op ON op.user_id = t.created_by
LEFT JOIN teams ht                 ON ht.id = v.home_team_id
LEFT JOIN teams at                 ON at.id = v.away_team_id
WHERE v.sets_cargados <> COALESCE(v.home_score, 0) + COALESCE(v.away_score, 0)
   OR v.gano_local     <> COALESCE(v.home_score, 0)
   OR v.gano_visitante <> COALESCE(v.away_score, 0)
   OR v.sets_empatados > 0
ORDER BY v.updated_at DESC;

-- ============================================================
-- CONSULTA 2 — el resumen, para saber a qué organizador escribirle
-- ============================================================
SELECT
  t.name                                 AS torneo,
  COALESCE(op.organization_name, u.name) AS organizador,
  u.email,
  COUNT(*) FILTER (WHERE ok.malo)        AS partidos_mal,
  COUNT(*)                               AS partidos_cargados,
  MAX(ok.updated_at)::date               AS ultimo_cargado
FROM (
  SELECT
    m.id, m.tournament_id, m.updated_at,
    (
      COUNT(vs.match_id) <> COALESCE(m.home_score, 0) + COALESCE(m.away_score, 0)
      OR COUNT(vs.match_id) FILTER (WHERE vs.home_points > vs.away_points) <> COALESCE(m.home_score, 0)
      OR COUNT(vs.match_id) FILTER (WHERE vs.away_points > vs.home_points) <> COALESCE(m.away_score, 0)
      OR COUNT(vs.match_id) FILTER (WHERE vs.home_points = vs.away_points) > 0
    ) AS malo
  FROM matches m
  JOIN tournaments t2          ON t2.id = m.tournament_id
  LEFT JOIN volleyball_sets vs ON vs.match_id = m.id
  WHERE t2.sport = 'volleyball' AND m.status = 'completed'
  GROUP BY m.id
) ok
JOIN tournaments t                 ON t.id = ok.tournament_id
JOIN users u                       ON u.id = t.created_by
LEFT JOIN organization_profiles op ON op.user_id = t.created_by
GROUP BY t.name, organizador, u.email
HAVING COUNT(*) FILTER (WHERE ok.malo) > 0
ORDER BY partidos_mal DESC;

-- ============================================================
-- CÓMO ARREGLARLOS
-- ============================================================
-- ⚠️ NO se pueden arreglar por SQL. Un partido sin sets no se puede reconstruir:
-- nadie sabe cuáles fueron los parciales, y ponerlos inventados es peor que
-- dejarlos vacíos — quedarían viéndose correctos.
--
-- La forma es entrar al partido desde el panel del torneo y cargar los sets a
-- mano, con la planilla del papel o preguntándole al que estuvo ahí. El
-- formulario ya no deja guardar si no cuadran.
--
-- ⚠️ Y avisarle al organizador: al corregirlos **la tabla de posiciones va a
-- cambiar**, porque el ratio de sets y el de puntos son desempates. Si ve que
-- se le movió el orden sin explicación, la próxima vez no confía en la tabla.
