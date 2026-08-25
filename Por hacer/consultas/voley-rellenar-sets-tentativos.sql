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
-- LOS 13 CASOS REALES — diagnóstico del 2026-08-25
-- ###########################################################################
--
-- ✅ RESUELTOS (7) — el SQL está más abajo, listo para correr
--
-- | # | Partido | Qué pasó |
-- |---|---|---|
-- | 1 | COBRAS vs MERAKY (Fem 2.0) | Sets 25-23 / 15-25 / **15-10**. El tercero a 15 es de desempate: solo existe si el partido fue 2-1, y lo ganó COBRAS. El marcador quedó invertido. |
-- | 2 | COBRAS vs PITBULL (Fem 2.0) | Igual: tercer set 15-13 ganado por COBRAS. Marcador invertido. |
-- | 3 | NOVA vs MASTER (Mamás) | SIN SETS, marcador 2-0. |
-- | 4 | THE FORD vs NOVA (Masc 2.0) | SIN SETS, marcador 2-0. |
-- | 5 | NOVA vs BALLESTAS (Papás) | SIN SETS, marcador 2-1. |
-- | 6 | Equipo 14 vs prueba (Mujeres 3) | Torneo de prueba. Marcador en 0-0 y sets cargados. |
-- | 7 | Salchipapa vs prueba (Mujeres 3) | Igual. |
--
-- ❓ NECESITAN DECISIÓN (6) — ver las preguntas al final del bloque
--
-- | # | Partido | El problema |
-- |---|---|---|
-- | 8 | FALCONS vs AURA (Fem Aprendiz) | Sets 25-18 / 5-25 = 1-1, marcador 0-2. O falta un tercer set, o el primero se tipeó al revés. |
-- | 9 | BALLESTA vs CARIBE (Mamás) | Un solo set con puntaje **2-0**. Nadie gana un set 2-0: alguien escribió el marcador del partido en la casilla de los puntos. |
-- | 10 | NOVA vs 360 (Masc 2.0) | Sets 25-23 / 27-25 / 15-14, los tres a NOVA. Imposible: con 2-0 el partido se acaba. El tercero a 15 confirma que fue 2-1, así que 360 ganó uno de los dos primeros. ¿Cuál? |
-- | 11 | CENTRAL vs THE BOY JAMES (Masc 2.0) | Sets 25-20 / 25-18 (2-0 al local) y marcador 0-2. Inversión limpia: o está mal el marcador, o los parciales se cargaron con las columnas cambiadas. |
-- | 12 | A 3 TOQUES vs 360 (Masc 2.0) | Sets 27-25 / 23-25 = 1-1, marcador 0-2. Mismo caso que el 8. |
-- | 13 | PIRATAS vs 360 (Papás) | Dos sets de **25-0** y marcador 2-1. El 25-0 es el parcial reglamentario de un W, pero el partido no está marcado como W. |


-- ###########################################################################
-- SQL DE LOS 7 RESUELTOS — se puede correr todo junto
-- ###########################################################################

-- ---- 1 y 2: el marcador quedó invertido; los sets mandan -------------------
UPDATE matches m
SET home_score = c.gl, away_score = c.gv,
    winner_id  = CASE WHEN c.gl > c.gv THEN m.home_team_id
                      WHEN c.gv > c.gl THEN m.away_team_id END,
    updated_at = now()
FROM (SELECT COUNT(*) FILTER (WHERE home_points > away_points) AS gl,
             COUNT(*) FILTER (WHERE away_points > home_points) AS gv
      FROM volleyball_sets WHERE match_id = '10e5bcc5-8818-489c-92a8-79ac048c30fc') c
WHERE m.id = '10e5bcc5-8818-489c-92a8-79ac048c30fc';

UPDATE matches m
SET home_score = c.gl, away_score = c.gv,
    winner_id  = CASE WHEN c.gl > c.gv THEN m.home_team_id
                      WHEN c.gv > c.gl THEN m.away_team_id END,
    updated_at = now()
FROM (SELECT COUNT(*) FILTER (WHERE home_points > away_points) AS gl,
             COUNT(*) FILTER (WHERE away_points > home_points) AS gv
      FROM volleyball_sets WHERE match_id = '6bb24c07-8dcc-4126-a347-1e5a2465e345') c
WHERE m.id = '6bb24c07-8dcc-4126-a347-1e5a2465e345';

-- ---- 6 y 7: torneo de prueba, marcador en 0-0 ------------------------------
UPDATE matches m
SET home_score = c.gl, away_score = c.gv,
    winner_id  = CASE WHEN c.gl > c.gv THEN m.home_team_id
                      WHEN c.gv > c.gl THEN m.away_team_id END,
    updated_at = now()
FROM (SELECT COUNT(*) FILTER (WHERE home_points > away_points) AS gl,
             COUNT(*) FILTER (WHERE away_points > home_points) AS gv
      FROM volleyball_sets WHERE match_id = '10cae8fa-0a4a-4977-a0c1-008edc44584c') c
WHERE m.id = '10cae8fa-0a4a-4977-a0c1-008edc44584c';

UPDATE matches m
SET home_score = c.gl, away_score = c.gv,
    winner_id  = CASE WHEN c.gl > c.gv THEN m.home_team_id
                      WHEN c.gv > c.gl THEN m.away_team_id END,
    updated_at = now()
FROM (SELECT COUNT(*) FILTER (WHERE home_points > away_points) AS gl,
             COUNT(*) FILTER (WHERE away_points > home_points) AS gv
      FROM volleyball_sets WHERE match_id = '5b017b8a-745c-4f46-a31d-95242a6990e2') c
WHERE m.id = '5b017b8a-745c-4f46-a31d-95242a6990e2';

-- ---- 3, 4 y 5: no tenían ningún set ---------------------------------------
-- Parciales inventados y firmados. Los sets ganados sí son los reales: salen
-- del marcador.

-- NOVA vs MASTER — 2-0 al local
INSERT INTO volleyball_sets (match_id, set_number, home_points, away_points, entered_by_name)
VALUES ('d766d820-9be6-4d6a-b94f-67974895b788', 1, 25, 20, 'PARCIAL TENTATIVO'),
       ('d766d820-9be6-4d6a-b94f-67974895b788', 2, 25, 20, 'PARCIAL TENTATIVO');

-- THE FORD vs NOVA — 2-0 al local
INSERT INTO volleyball_sets (match_id, set_number, home_points, away_points, entered_by_name)
VALUES ('047feaca-e5a4-48ca-8f45-4e577744b140', 1, 25, 20, 'PARCIAL TENTATIVO'),
       ('047feaca-e5a4-48ca-8f45-4e577744b140', 2, 25, 20, 'PARCIAL TENTATIVO');

-- NOVA vs BALLESTAS — 2-1 al local: pierde el primero y gana los dos siguientes
INSERT INTO volleyball_sets (match_id, set_number, home_points, away_points, entered_by_name)
VALUES ('904db137-1740-40b2-9241-fe0443c7d403', 1, 20, 25, 'PARCIAL TENTATIVO'),
       ('904db137-1740-40b2-9241-fe0443c7d403', 2, 25, 20, 'PARCIAL TENTATIVO'),
       ('904db137-1740-40b2-9241-fe0443c7d403', 3, 15, 10, 'PARCIAL TENTATIVO');

-- ###########################################################################
-- SQL DE LOS 6 QUE FALTABAN — decididos con el organizador el 2026-08-25
-- ###########################################################################
--
-- Cuatro de los seis resultaron ser la MISMA equivocación: los puntos del set
-- se cargaron con las columnas al revés. Ahí no hay nada que inventar — se dan
-- vuelta los números que ya estaban y listo. Por eso esos cuatro NO van
-- firmados como tentativos: los puntos son los reales, solo estaban del lado
-- equivocado. Solo el 9 y el 13 llevan valores nuevos.
--
-- En todos los casos el MARCADOR del partido se queda como está: era el dato
-- correcto, y son los sets los que no lo acompañaban.

-- ---- 8. FALCONS vs AURA — 0-2, gana AURA -----------------------------------
-- El set 1 estaba 25-18 a favor del local, que no pudo ser: ganó AURA.
-- Se da vuelta. Queda 18-25 , 5-25 = 0-2. ✓
UPDATE volleyball_sets SET home_points = 18, away_points = 25
WHERE match_id = '4b642d76-662c-4809-869c-995588c74aff' AND set_number = 1;

-- ---- 9. BALLESTA vs CARIBE — 2-0, gana BALLESTA ----------------------------
-- Tenía un único set con puntaje "2-0": alguien escribió el marcador del
-- partido en la casilla de los puntos. Se borra y se cargan los dos reales.
DELETE FROM volleyball_sets
WHERE match_id = '00a44900-949d-4d63-8319-cfc84a708947';

INSERT INTO volleyball_sets (match_id, set_number, home_points, away_points, entered_by_name)
VALUES ('00a44900-949d-4d63-8319-cfc84a708947', 1, 25, 20, 'PARCIAL TENTATIVO'),
       ('00a44900-949d-4d63-8319-cfc84a708947', 2, 25, 22, 'PARCIAL TENTATIVO');

-- ---- 10. NOVA vs 360 — 2-1, gana NOVA perdiendo el SEGUNDO set -------------
-- Los tres sets figuraban ganados por NOVA, imposible en un 2-1.
-- Se da vuelta el segundo. Queda 25-23 , 25-27 , 15-14 = 2-1. ✓
UPDATE volleyball_sets SET home_points = 25, away_points = 27
WHERE match_id = '5e2e8a95-4f3c-4e73-9a69-28ffd44100c5' AND set_number = 2;

-- ---- 11. CENTRAL vs THE BOY JAMES — 0-2, gana THE BOY JAMES ----------------
-- Los dos sets estaban al revés. Se dan vuelta conservando los puntos que ya
-- había (20 y 18) en lugar de escribir números nuevos: son datos reales, solo
-- estaban en la columna equivocada. Queda 20-25 , 18-25 = 0-2. ✓
UPDATE volleyball_sets SET home_points = 20, away_points = 25
WHERE match_id = '814c4d40-f0d7-40eb-8c96-6943fb2e73af' AND set_number = 1;

UPDATE volleyball_sets SET home_points = 18, away_points = 25
WHERE match_id = '814c4d40-f0d7-40eb-8c96-6943fb2e73af' AND set_number = 2;

-- ---- 12. A 3 TOQUES vs 360 — 0-2, gana 360 ---------------------------------
-- El set 1 estaba 27-25 al local. Se da vuelta. Queda 25-27 , 23-25 = 0-2. ✓
UPDATE volleyball_sets SET home_points = 25, away_points = 27
WHERE match_id = 'f9d3d8bd-69cd-44c6-bcf8-9eac687b26fb' AND set_number = 1;

-- ---- 13. PIRATAS vs 360 — 2-1, gana PIRATAS. NO fue W ----------------------
-- Tenía dos sets de 25-0, que es el parcial reglamentario de un W, pero el
-- partido no fue W. Se borran y se cargan tres con valores creíbles, con el
-- tercero a 15 porque es el set de desempate.
DELETE FROM volleyball_sets
WHERE match_id = '8dd05ed4-7ee5-42e6-8bcf-56a4b32774c2';

INSERT INTO volleyball_sets (match_id, set_number, home_points, away_points, entered_by_name)
VALUES ('8dd05ed4-7ee5-42e6-8bcf-56a4b32774c2', 1, 25, 20, 'PARCIAL TENTATIVO'),
       ('8dd05ed4-7ee5-42e6-8bcf-56a4b32774c2', 2, 22, 25, 'PARCIAL TENTATIVO'),
       ('8dd05ed4-7ee5-42e6-8bcf-56a4b32774c2', 3, 15, 12, 'PARCIAL TENTATIVO');


-- ###########################################################################
-- IDS DE LOS 6, POR SI HAY QUE VOLVER
-- ###########################################################################
--  8  FALCONS vs AURA          4b642d76-662c-4809-869c-995588c74aff
--  9  BALLESTA vs CARIBE       00a44900-949d-4d63-8319-cfc84a708947
-- 10  NOVA vs 360              5e2e8a95-4f3c-4e73-9a69-28ffd44100c5
-- 11  CENTRAL vs THE BOY JAMES 814c4d40-f0d7-40eb-8c96-6943fb2e73af
-- 12  A 3 TOQUES vs 360        f9d3d8bd-69cd-44c6-bcf8-9eac687b26fb
-- 13  PIRATAS vs 360           8dd05ed4-7ee5-42e6-8bcf-56a4b32774c2


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
