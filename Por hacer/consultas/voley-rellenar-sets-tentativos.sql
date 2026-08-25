-- ============================================================================
-- Vóley: arreglar los partidos con los sets mal cargados, UNO POR UNO
-- ----------------------------------------------------------------------------
-- Para el editor SQL de Supabase. **Correr un bloque por vez**, seleccionándolo.
-- Los encontró `voley-resultados-sin-sets.sql`: 13 partidos al 2026-08-25,
-- repartidos en 6 torneos (5 de Daniel Rodríguez, 1 de la cuenta de la
-- plataforma), sobre 277 partidos cargados.
--
-- ⚠️ LO QUE HAY QUE TENER EN LA CABEZA MIENTRAS SE HACE ESTO
--
-- En vóley el marcador ES la cuenta de sets: un 2-1 son tres sets, un 2-0 son
-- dos. Cuando no coinciden, uno de los dos está mal, y el SQL no puede saber
-- cuál. Por eso esto se hace mirando, no con un UPDATE masivo.
--
-- Y los puntos de cada set son **desempate en la tabla** (ratio de puntos).
-- Un parcial inventado puede cambiar quién clasifica, y a diferencia de un
-- partido sin sets —que se ve roto y alguien lo arregla— un parcial inventado
-- se ve correcto para siempre. Por eso todo lo que se invente acá va firmado
-- como `PARCIAL TENTATIVO` y se puede volver a encontrar (PASO 5).
--
-- ⚠️ **Avisarle al organizador antes de tocar nada**: al corregir estos
-- partidos su tabla de posiciones se va a mover. Si ve que cambió el orden sin
-- explicación, la próxima vez no le cree a la tabla.


-- ###########################################################################
-- PASO 1 — Ver los 13, agrupados por torneo
-- ###########################################################################
-- El `match_id` de la última columna es lo que se pega en los bloques de abajo.

SELECT
  t.name                                    AS torneo,
  COALESCE(t.best_of, 3)                    AS best_of,
  m.date                                    AS fecha,
  ht.name || '  vs  ' || at.name            AS partido,
  m.home_score || ' - ' || m.away_score     AS marcador,
  COALESCE(
    string_agg(vs.home_points || '-' || vs.away_points, ' , '
               ORDER BY vs.set_number),
    'SIN SETS'
  )                                         AS parciales_hoy,
  m.walkover                                AS fue_w,
  m.id                                      AS match_id
FROM matches m
JOIN tournaments t           ON t.id = m.tournament_id
LEFT JOIN teams ht           ON ht.id = m.home_team_id
LEFT JOIN teams at           ON at.id = m.away_team_id
LEFT JOIN volleyball_sets vs ON vs.match_id = m.id
WHERE t.sport = 'volleyball'
  AND m.status = 'completed'
GROUP BY m.id, t.name, t.best_of, ht.name, at.name
HAVING COUNT(vs.match_id) <> COALESCE(m.home_score,0) + COALESCE(m.away_score,0)
    OR COUNT(vs.match_id) FILTER (WHERE vs.home_points > vs.away_points) <> COALESCE(m.home_score,0)
    OR COUNT(vs.match_id) FILTER (WHERE vs.away_points > vs.home_points) <> COALESCE(m.away_score,0)
    OR COUNT(vs.match_id) FILTER (WHERE vs.home_points = vs.away_points) > 0
ORDER BY t.name, m.date;


-- ###########################################################################
-- PASO 2 — Cómo decidir, según lo que muestre `parciales_hoy`
-- ###########################################################################
--
-- | Lo que ves | Qué pasó | Qué hacer |
-- |---|---|---|
-- | `SIN SETS` | Se cargó el marcador y no los parciales. | **Bloque A.** Los sets y quién ganó cada uno ya los dice el marcador; solo se inventan los puntos. |
-- | Los parciales se ven razonables pero el marcador no coincide | Casi siempre el error está en el **marcador**: los parciales alguien los copió de la planilla, el marcador lo escribió de memoria. | **Bloque B.** Se corrige el marcador para que diga lo que dicen los sets. Es el que no inventa nada. |
-- | Falta o sobra un set suelto | Se saltearon uno al cargar, o cargaron uno de más. | **Bloque C** (agregar el que falta) o **Bloque D** (borrar el que sobra). |
-- | Un set empatado, tipo `25-25` | Error de tipeo. | **Bloque C**, corrigiendo ese set. |
-- | `fue_w = true` | Es un W. Los parciales son reglamentarios (25-0), no reales. | Dejarlo como está salvo que el marcador esté mal. |
--
-- 👉 **Regla de oro: preferir siempre el bloque que NO inventa.** Si los
--    parciales existen, corregir el marcador (B) antes que tocar los parciales.


-- ###########################################################################
-- BLOQUE A — Partido SIN sets: escribir los parciales
-- ###########################################################################
-- Copiar el bloque, cambiar el id y los números, y correrlo. UNA VEZ POR
-- PARTIDO.
--
-- Reglas al escribirlo, si no la app lo va a rechazar después:
--   · Tiene que haber tantas filas como (home_score + away_score).
--   · La cantidad de sets que gana cada lado tiene que dar el marcador exacto.
--   · Ningún set empatado.
--   · Si no sabés los puntos: 25-20 para los sets normales, y 15-10 si fue el
--     set definitorio (el último, cuando el partido llegó al límite).
--
-- Ejemplo para un 2-1 donde ganó el LOCAL (perdió el primero y ganó los dos
-- siguientes, que es la secuencia más común):

INSERT INTO volleyball_sets
  (match_id, set_number, home_points, away_points, entered_by_name)
VALUES
  ('PEGAR-AQUI-EL-match_id', 1, 20, 25, 'PARCIAL TENTATIVO'),
  ('PEGAR-AQUI-EL-match_id', 2, 25, 20, 'PARCIAL TENTATIVO'),
  ('PEGAR-AQUI-EL-match_id', 3, 15, 10, 'PARCIAL TENTATIVO');

-- Para un 2-0 al local, solo dos filas:
--   ('...', 1, 25, 20, 'PARCIAL TENTATIVO'),
--   ('...', 2, 25, 20, 'PARCIAL TENTATIVO');
--
-- Para un 0-2 (ganó el visitante), los mismos dos pero al revés: 20-25.


-- ###########################################################################
-- BLOQUE B — El marcador está mal: corregirlo con lo que dicen los sets
-- ###########################################################################
-- ⭐ **Este es el mejor de todos: no inventa nada.** Lee los sets que ya están
-- cargados y reescribe el marcador del partido para que coincida. También
-- recalcula el ganador, que si no queda apuntando al equipo equivocado.
--
-- Cambiar el id en los DOS lugares.

UPDATE matches m
SET home_score = c.gana_local,
    away_score = c.gana_visitante,
    winner_id  = CASE WHEN c.gana_local > c.gana_visitante THEN m.home_team_id
                      WHEN c.gana_visitante > c.gana_local THEN m.away_team_id
                      END,
    updated_at = now()
FROM (
  SELECT
    COUNT(*) FILTER (WHERE home_points > away_points) AS gana_local,
    COUNT(*) FILTER (WHERE away_points > home_points) AS gana_visitante
  FROM volleyball_sets
  WHERE match_id = 'PEGAR-AQUI-EL-match_id'
) c
WHERE m.id = 'PEGAR-AQUI-EL-match_id';


-- ###########################################################################
-- BLOQUE C — Corregir o agregar un set suelto
-- ###########################################################################
-- Corregir uno que existe (un 25-25, o unos puntos mal tipeados):

UPDATE volleyball_sets
SET home_points = 25,
    away_points = 22
WHERE match_id = 'PEGAR-AQUI-EL-match_id'
  AND set_number = 3;

-- Agregar el que faltaba:

INSERT INTO volleyball_sets
  (match_id, set_number, home_points, away_points, entered_by_name)
VALUES
  ('PEGAR-AQUI-EL-match_id', 3, 25, 20, 'PARCIAL TENTATIVO');


-- ###########################################################################
-- BLOQUE D — Borrar un set que sobra
-- ###########################################################################
-- Ojo: si borrás uno del medio, los `set_number` quedan con un hueco (1, 2, 4).
-- No rompe nada, pero es más prolijo renumerar con el bloque de abajo.

DELETE FROM volleyball_sets
WHERE match_id = 'PEGAR-AQUI-EL-match_id'
  AND set_number = 3;

-- Renumerar 1,2,3… respetando el orden actual:

WITH orden AS (
  SELECT match_id, set_number,
         ROW_NUMBER() OVER (ORDER BY set_number) AS nuevo
  FROM volleyball_sets
  WHERE match_id = 'PEGAR-AQUI-EL-match_id'
)
UPDATE volleyball_sets vs
SET set_number = o.nuevo
FROM orden o
WHERE vs.match_id = o.match_id
  AND vs.set_number = o.set_number;


-- ###########################################################################
-- PASO 3 — Revisar UN partido después de tocarlo
-- ###########################################################################
-- Tiene que dar `coincide = true`.

SELECT
  m.home_score || ' - ' || m.away_score AS marcador,
  COUNT(vs.match_id) FILTER (WHERE vs.home_points > vs.away_points) || ' - ' ||
  COUNT(vs.match_id) FILTER (WHERE vs.away_points > vs.home_points) AS sets_dicen,
  string_agg(vs.home_points || '-' || vs.away_points, ' , '
             ORDER BY vs.set_number) AS parciales,
  (COUNT(vs.match_id) = COALESCE(m.home_score,0) + COALESCE(m.away_score,0)
   AND COUNT(vs.match_id) FILTER (WHERE vs.home_points > vs.away_points) = COALESCE(m.home_score,0)
   AND COUNT(vs.match_id) FILTER (WHERE vs.away_points > vs.home_points) = COALESCE(m.away_score,0)
   AND COUNT(vs.match_id) FILTER (WHERE vs.home_points = vs.away_points) = 0
  ) AS coincide
FROM matches m
LEFT JOIN volleyball_sets vs ON vs.match_id = m.id
WHERE m.id = 'PEGAR-AQUI-EL-match_id'
GROUP BY m.id;


-- ###########################################################################
-- PASO 4 — Revisar TODO al terminar
-- ###########################################################################
-- Volver a correr el PASO 1. Cuando no devuelva ninguna fila, está listo.


-- ###########################################################################
-- PASO 5 — Los parciales inventados, para corregirlos de verdad después
-- ###########################################################################
-- Esta es la razón de firmarlos. Cuando aparezca la planilla de papel, o el
-- organizador se acuerde, se corrigen desde el panel y esta lista se vacía.

SELECT
  t.name                        AS torneo,
  ht.name || ' vs ' || at.name  AS partido,
  m.date                        AS fecha_del_partido,
  m.home_score || ' - ' || m.away_score AS marcador,
  string_agg(vs.home_points || '-' || vs.away_points, ' , '
             ORDER BY vs.set_number) AS parciales_inventados
FROM volleyball_sets vs
JOIN matches m      ON m.id = vs.match_id
JOIN tournaments t  ON t.id = m.tournament_id
LEFT JOIN teams ht  ON ht.id = m.home_team_id
LEFT JOIN teams at  ON at.id = m.away_team_id
WHERE vs.entered_by_name = 'PARCIAL TENTATIVO'
GROUP BY m.id, t.name, ht.name, at.name
ORDER BY t.name, m.date;


-- ###########################################################################
-- DESHACER
-- ###########################################################################
-- Borra únicamente lo inventado. Lo que estaba cargado de antes no se toca:
--
--   DELETE FROM volleyball_sets WHERE entered_by_name = 'PARCIAL TENTATIVO';
--
-- Los marcadores corregidos con el BLOQUE B no se deshacen con esto — ese
-- bloque no inventa, así que no hay nada que revertir.


-- ###########################################################################
-- APÉNDICE — Rellenar todos los "SIN SETS" de una
-- ###########################################################################
-- Solo si al final son muchos y no vale la pena uno por uno. Toca ÚNICAMENTE
-- los partidos que no tienen ningún set: los que tienen sets que no cuadran
-- no los mira, porque ahí pisar borraría datos reales.
--
-- Escribe el mismo parcial para todos —25-20, y 15-10 si es set definitorio—
-- a propósito: un parcial uniforme no le mueve el ratio de puntos a favor de
-- nadie, mientras que inventar 25-23 acá y 25-18 allá sí decide desempates al
-- azar.

WITH sin_sets AS (
  SELECT m.id, m.home_score, m.away_score, COALESCE(t.best_of, 3) AS best_of
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
