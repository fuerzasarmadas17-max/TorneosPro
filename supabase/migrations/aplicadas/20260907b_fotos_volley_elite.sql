-- ============================================================================
-- Foto de tarjeta: "Santo Coffee" y "Master Class" — volley masculino élite
-- ----------------------------------------------------------------------------
-- Los dos son de vóley y de hombres élite, así que van las dos únicas fotos del
-- catálogo que retratan hombres adultos jugando en serio:
--
--   volleyball-masc-1     → bloqueo en la net, tribuna llena, cancha de torneo.
--                           Es la más "élite" de las diez.
--   volleyball-jov-masc-1 → armado de jugada, cancha azul, público en la
--                           gradería. La etiqueta interna dice "Jóvenes", pero
--                           lo que se ve son hombres adultos en un partido
--                           formal — sirve igual y no repite la de arriba.
--
-- POR QUÉ UNA DISTINTA A CADA UNO Y NO LA MISMA
-- Dos tarjetas vecinas con la misma foto se leen como un error de carga, no
-- como un diseño (es el motivo por el que el catálogo tiene diez fotos de vóley
-- y no una). Con solo dos fotos de hombres adultos, esta es la única
-- combinación que no repite.
--
-- ⚠️ OJO CON SANTO COFFEE. El 2026-08-21 se le puso `volleyball-padres-1` (la
-- de "Padres": hombres con canas y rodilleras) porque el torneo se llamaba
-- SENIOR y era de mayores de 35 — ver 20260821_foto_santo_coffee.sql. Si es el
-- mismo torneo, el bloque 2 le CAMBIA esa foto por la de élite. Si no es el
-- mismo, el bloque 1 te va a mostrar dos Santo Coffee y hay que afinar el
-- nombre antes de correr nada.

-- ---------------------------------------------------------------------------
-- 1) MIRAR ANTES DE TOCAR. Tienen que salir DOS filas, las dos con
--    deporte = volleyball. Fijate qué foto tienen hoy.
-- ---------------------------------------------------------------------------
SELECT name AS torneo, sport AS deporte, card_image AS foto_actual,
       status AS estado, created_at::date AS creado, id
FROM   tournaments
WHERE  name ILIKE '%santo%coff%'
   OR  name ILIKE '%master%class%'
ORDER  BY name;

-- ---------------------------------------------------------------------------
-- 2) PONER LAS FOTOS. Cada UPDATE tiene que devolver UNA fila.
--    Cero filas = el nombre no coincide, o el torneo no es de vóley.
-- ---------------------------------------------------------------------------

-- 2a) Santo Coffee → la del bloqueo con la tribuna llena
UPDATE tournaments
SET    card_image = 'volleyball-masc-1'
WHERE  name ILIKE '%santo%coff%'
  AND  sport = 'volleyball'
RETURNING name AS torneo, card_image AS foto_nueva;

-- 2b) Master Class → la del armado en cancha azul
UPDATE tournaments
SET    card_image = 'volleyball-jov-masc-1'
WHERE  name ILIKE '%master%class%'
  AND  sport = 'volleyball'
RETURNING name AS torneo, card_image AS foto_nueva;

-- ---------------------------------------------------------------------------
-- 3) VERIFICAR. Las dos con su foto nueva.
-- ---------------------------------------------------------------------------
SELECT name AS torneo, sport AS deporte, card_image AS foto
FROM   tournaments
WHERE  name ILIKE '%santo%coff%'
   OR  name ILIKE '%master%class%'
ORDER  BY name;
