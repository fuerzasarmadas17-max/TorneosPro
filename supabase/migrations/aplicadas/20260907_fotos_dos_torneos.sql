-- ============================================================================
-- Foto de tarjeta para "2do torneo vacacional" y "XII campeonato categoría libre"
-- ----------------------------------------------------------------------------
-- El dueño pidió que cada uno lleve la misma foto que ya tiene otro torneo:
--   · 2do torneo vacacional          ←  la de "Copa JETSETV"
--   · XII campeonato categoría libre ←  la de "Copa Torneos Pro"
--
-- No se escribe una clave a mano: se COPIA la que tenga el torneo de origen en
-- el momento de correr esto. Así, si la del origen no era la que yo suponía,
-- igual queda la correcta.
--
-- ⚠️ LA FOTO TIENE QUE SER DEL MISMO DEPORTE.
-- `card_image` guarda una clave (ej. 'volleyball-masc-1'), no una URL, y
-- `resolveSportImage` (src/data/sport-images.ts) devuelve null cuando la clave
-- no está en el set de ESE deporte. O sea: copiarle a un torneo de fútbol la
-- foto de uno de vóley no rompe nada, pero la tarjeta queda en degradado y
-- parece que no se hizo. Por eso el bloque 2 exige que los deportes coincidan:
-- si no coinciden, no escribe nada y el bloque 1 te dice por qué.
--
-- Va por SQL y no desde la interfaz porque el selector de foto solo ofrece las
-- del deporte del torneo, y porque la policy "Creador edita torneo" únicamente
-- deja tocar los propios.

-- ---------------------------------------------------------------------------
-- 1) MIRAR ANTES DE TOCAR. Tienen que salir CUATRO filas, una por torneo.
--    Fijate en dos cosas:
--      · que cada patrón traiga un solo torneo (si trae dos, hay que afinarlo)
--      · que el deporte del origen y el de su destino sean el MISMO
-- ---------------------------------------------------------------------------
SELECT CASE
         WHEN name ILIKE '%vacacional%'            THEN '1 · DESTINO'
         WHEN name ILIKE '%jetsetv%'               THEN '1 · origen'
         WHEN name ILIKE '%campeonato%libre%'      THEN '2 · DESTINO'
         ELSE                                           '2 · origen'
       END                       AS papel,
       name                      AS torneo,
       sport                     AS deporte,
       card_image                AS foto_actual,
       status                    AS estado,
       id
FROM   tournaments
WHERE  name ILIKE '%vacacional%'
   OR  name ILIKE '%jetsetv%'
   OR  name ILIKE '%campeonato%libre%'
   OR  name ILIKE '%torneos pro%'
ORDER  BY papel;

-- ---------------------------------------------------------------------------
-- 2) COPIAR LAS FOTOS. Corré los dos UPDATE juntos.
--    Cada uno tiene que devolver UNA fila con la foto ya puesta.
--    Si devuelve CERO filas: o el nombre no coincide, o los deportes son
--    distintos (mirá el bloque 1).
-- ---------------------------------------------------------------------------

-- 2a) 2do torneo vacacional  ←  Copa JETSETV
UPDATE tournaments AS destino
SET    card_image = origen.card_image
FROM   tournaments AS origen
WHERE  destino.name ILIKE '%vacacional%'
  AND  origen.name  ILIKE '%jetsetv%'
  AND  origen.sport = destino.sport      -- la foto solo resuelve dentro del deporte
  AND  origen.card_image IS NOT NULL     -- si el origen no tiene foto, no hay nada que copiar
RETURNING destino.name AS torneo, destino.sport AS deporte, destino.card_image AS foto_nueva;

-- 2b) XII campeonato categoría libre  ←  Copa Torneos Pro
UPDATE tournaments AS destino
SET    card_image = origen.card_image
FROM   tournaments AS origen
WHERE  destino.name ILIKE '%campeonato%libre%'
  AND  origen.name  ILIKE '%torneos pro%'
  AND  origen.sport = destino.sport
  AND  origen.card_image IS NOT NULL
RETURNING destino.name AS torneo, destino.sport AS deporte, destino.card_image AS foto_nueva;

-- ---------------------------------------------------------------------------
-- 3) VERIFICAR. Los cuatro torneos, y cada pareja con la MISMA foto.
-- ---------------------------------------------------------------------------
SELECT name AS torneo, sport AS deporte, card_image AS foto
FROM   tournaments
WHERE  name ILIKE '%vacacional%'
   OR  name ILIKE '%jetsetv%'
   OR  name ILIKE '%campeonato%libre%'
   OR  name ILIKE '%torneos pro%'
ORDER  BY card_image, name;

-- Cuántos torneos quedan sin foto en TODA la plataforma:
SELECT count(*) AS torneos_sin_foto FROM tournaments WHERE card_image IS NULL;

