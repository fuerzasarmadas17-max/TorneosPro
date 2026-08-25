-- ============================================================================
-- Vóley: el arreglo de los 13 partidos, listo para correr entero
-- ----------------------------------------------------------------------------
-- ✅ ESTE ARCHIVO SE CORRE COMPLETO. Seleccionar todo y Run.
--
-- No tiene plantillas ni bloques de ejemplo: son los 13 partidos reales, con
-- sus ids. El editor de Supabase lo corre todo en una transacción, así que o
-- entra el arreglo completo o no entra nada.
--
-- Al final hay un SELECT de verificación: si devuelve CERO filas, quedaron los
-- 13 arreglados.
--
-- El razonamiento de cada caso está en `voley-rellenar-sets-tentativos.sql`.
-- Acá está solo lo que se ejecuta.
--
-- ⚠️ Avisarle a Daniel: son 5 de sus torneos y las tablas de posiciones se le
-- van a mover, porque el ratio de sets y el de puntos son desempates.

-- ############################################################
-- PARTE 1 — El marcador estaba invertido; los sets mandan
-- ############################################################
-- No se inventa nada: se reescribe el marcador con lo que dicen los sets ya
-- cargados, y se recalcula el ganador.

-- COBRAS vs MERAKY (Femenino 2.0) — el tercer set a 15 confirma que fue 2-1
UPDATE matches m
SET home_score = c.gl, away_score = c.gv,
    winner_id  = CASE WHEN c.gl > c.gv THEN m.home_team_id
                      WHEN c.gv > c.gl THEN m.away_team_id END,
    updated_at = now()
FROM (SELECT COUNT(*) FILTER (WHERE home_points > away_points) AS gl,
             COUNT(*) FILTER (WHERE away_points > home_points) AS gv
      FROM volleyball_sets WHERE match_id = '10e5bcc5-8818-489c-92a8-79ac048c30fc') c
WHERE m.id = '10e5bcc5-8818-489c-92a8-79ac048c30fc';

-- COBRAS vs PITBULL (Femenino 2.0)
UPDATE matches m
SET home_score = c.gl, away_score = c.gv,
    winner_id  = CASE WHEN c.gl > c.gv THEN m.home_team_id
                      WHEN c.gv > c.gl THEN m.away_team_id END,
    updated_at = now()
FROM (SELECT COUNT(*) FILTER (WHERE home_points > away_points) AS gl,
             COUNT(*) FILTER (WHERE away_points > home_points) AS gv
      FROM volleyball_sets WHERE match_id = '6bb24c07-8dcc-4126-a347-1e5a2465e345') c
WHERE m.id = '6bb24c07-8dcc-4126-a347-1e5a2465e345';

-- Equipo 14 vs prueba (Volleyball Mujeres 3) — marcador quedó en 0-0
UPDATE matches m
SET home_score = c.gl, away_score = c.gv,
    winner_id  = CASE WHEN c.gl > c.gv THEN m.home_team_id
                      WHEN c.gv > c.gl THEN m.away_team_id END,
    updated_at = now()
FROM (SELECT COUNT(*) FILTER (WHERE home_points > away_points) AS gl,
             COUNT(*) FILTER (WHERE away_points > home_points) AS gv
      FROM volleyball_sets WHERE match_id = '10cae8fa-0a4a-4977-a0c1-008edc44584c') c
WHERE m.id = '10cae8fa-0a4a-4977-a0c1-008edc44584c';

-- Salchipapa vs prueba (Volleyball Mujeres 3)
UPDATE matches m
SET home_score = c.gl, away_score = c.gv,
    winner_id  = CASE WHEN c.gl > c.gv THEN m.home_team_id
                      WHEN c.gv > c.gl THEN m.away_team_id END,
    updated_at = now()
FROM (SELECT COUNT(*) FILTER (WHERE home_points > away_points) AS gl,
             COUNT(*) FILTER (WHERE away_points > home_points) AS gv
      FROM volleyball_sets WHERE match_id = '5b017b8a-745c-4f46-a31d-95242a6990e2') c
WHERE m.id = '5b017b8a-745c-4f46-a31d-95242a6990e2';


-- ############################################################
-- PARTE 2 — Los sets estaban cargados con las columnas al revés
-- ############################################################
-- Tampoco se inventa nada: son los mismos puntos, del lado correcto.
-- El marcador del partido se queda como está, que era el dato bueno.

-- FALCONS vs AURA (Fem. Aprendiz) — 0-2: el set 1 no podía ser del local
UPDATE volleyball_sets SET home_points = 18, away_points = 25
WHERE match_id = '4b642d76-662c-4809-869c-995588c74aff' AND set_number = 1;

-- NOVA vs 360 (Masc. 2.0) — 2-1: NOVA pierde el segundo set
UPDATE volleyball_sets SET home_points = 25, away_points = 27
WHERE match_id = '5e2e8a95-4f3c-4e73-9a69-28ffd44100c5' AND set_number = 2;

-- CENTRAL JUVENIL vs THE BOY JAMES (Masc. 2.0) — 0-2: los dos sets al revés
UPDATE volleyball_sets SET home_points = 20, away_points = 25
WHERE match_id = '814c4d40-f0d7-40eb-8c96-6943fb2e73af' AND set_number = 1;

UPDATE volleyball_sets SET home_points = 18, away_points = 25
WHERE match_id = '814c4d40-f0d7-40eb-8c96-6943fb2e73af' AND set_number = 2;

-- A 3 TOQUES vs 360 (Masc. 2.0) — 0-2: el set 1 al revés
UPDATE volleyball_sets SET home_points = 25, away_points = 27
WHERE match_id = 'f9d3d8bd-69cd-44c6-bcf8-9eac687b26fb' AND set_number = 1;


-- ############################################################
-- PARTE 3 — Partidos sin ningún set: parciales tentativos
-- ############################################################
-- Acá sí se inventan los PUNTOS. Cuántos sets hubo y quién ganó cada uno sale
-- del marcador, así que eso es real. Van firmados como PARCIAL TENTATIVO para
-- poder encontrarlos y corregirlos cuando aparezca la planilla.

-- NOVA vs MASTER (Mamás) — 2-0 al local
INSERT INTO volleyball_sets (match_id, set_number, home_points, away_points, entered_by_name)
VALUES ('d766d820-9be6-4d6a-b94f-67974895b788', 1, 25, 20, 'PARCIAL TENTATIVO'),
       ('d766d820-9be6-4d6a-b94f-67974895b788', 2, 25, 20, 'PARCIAL TENTATIVO');

-- THE FORD vs NOVA (Masc. 2.0) — 2-0 al local
INSERT INTO volleyball_sets (match_id, set_number, home_points, away_points, entered_by_name)
VALUES ('047feaca-e5a4-48ca-8f45-4e577744b140', 1, 25, 20, 'PARCIAL TENTATIVO'),
       ('047feaca-e5a4-48ca-8f45-4e577744b140', 2, 25, 20, 'PARCIAL TENTATIVO');

-- NOVA vs BALLESTAS (Papás) — 2-1 al local: pierde el primero, gana los dos siguientes
INSERT INTO volleyball_sets (match_id, set_number, home_points, away_points, entered_by_name)
VALUES ('904db137-1740-40b2-9241-fe0443c7d403', 1, 20, 25, 'PARCIAL TENTATIVO'),
       ('904db137-1740-40b2-9241-fe0443c7d403', 2, 25, 20, 'PARCIAL TENTATIVO'),
       ('904db137-1740-40b2-9241-fe0443c7d403', 3, 15, 10, 'PARCIAL TENTATIVO');


-- ############################################################
-- PARTE 4 — Los dos con datos basura: borrar y cargar de nuevo
-- ############################################################

-- BALLESTA vs CARIBE (Mamás) — 2-0 al local.
-- Tenía un solo set con puntaje "2-0": alguien escribió el marcador del
-- partido en la casilla de los puntos.
DELETE FROM volleyball_sets
WHERE match_id = '00a44900-949d-4d63-8319-cfc84a708947';

INSERT INTO volleyball_sets (match_id, set_number, home_points, away_points, entered_by_name)
VALUES ('00a44900-949d-4d63-8319-cfc84a708947', 1, 25, 20, 'PARCIAL TENTATIVO'),
       ('00a44900-949d-4d63-8319-cfc84a708947', 2, 25, 22, 'PARCIAL TENTATIVO');

-- PIRATAS vs 360 (Papás) — 2-1 al local, y NO fue W.
-- Tenía dos sets de 25-0, que es el parcial reglamentario de un W. El tercero
-- va a 15 porque es el set de desempate.
DELETE FROM volleyball_sets
WHERE match_id = '8dd05ed4-7ee5-42e6-8bcf-56a4b32774c2';

INSERT INTO volleyball_sets (match_id, set_number, home_points, away_points, entered_by_name)
VALUES ('8dd05ed4-7ee5-42e6-8bcf-56a4b32774c2', 1, 25, 20, 'PARCIAL TENTATIVO'),
       ('8dd05ed4-7ee5-42e6-8bcf-56a4b32774c2', 2, 22, 25, 'PARCIAL TENTATIVO'),
       ('8dd05ed4-7ee5-42e6-8bcf-56a4b32774c2', 3, 15, 12, 'PARCIAL TENTATIVO');


-- ############################################################
-- VERIFICACIÓN — tiene que devolver CERO filas
-- ############################################################

SELECT
  t.name                                AS torneo,
  ht.name || ' vs ' || at.name          AS partido,
  m.home_score || ' - ' || m.away_score AS marcador,
  string_agg(vs.home_points || '-' || vs.away_points, ' , '
             ORDER BY vs.set_number)    AS parciales
FROM matches m
JOIN tournaments t           ON t.id = m.tournament_id
LEFT JOIN teams ht           ON ht.id = m.home_team_id
LEFT JOIN teams at           ON at.id = m.away_team_id
LEFT JOIN volleyball_sets vs ON vs.match_id = m.id
WHERE t.sport = 'volleyball' AND m.status = 'completed'
GROUP BY m.id, t.name, ht.name, at.name
HAVING COUNT(vs.match_id) <> COALESCE(m.home_score,0) + COALESCE(m.away_score,0)
    OR COUNT(vs.match_id) FILTER (WHERE vs.home_points > vs.away_points) <> COALESCE(m.home_score,0)
    OR COUNT(vs.match_id) FILTER (WHERE vs.away_points > vs.home_points) <> COALESCE(m.away_score,0)
    OR COUNT(vs.match_id) FILTER (WHERE vs.home_points = vs.away_points) > 0;
