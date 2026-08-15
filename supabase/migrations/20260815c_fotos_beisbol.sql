-- ============================================================================
-- Foto de tarjeta para los 4 torneos de béisbol
-- ----------------------------------------------------------------------------
-- Ya existen las 4 fotos de béisbol, así que cada torneo puede llevar una
-- distinta: no se repite ninguna.
--
-- Las fotos se repartieron por edad aparente, siguiendo el orden de las
-- categorías: Pre-Infantil (9-10) → Infantil (11-12) → Pony (13-14) →
-- Pre-Junior (15-16). Si conocés a los equipos y alguna no pega, cambiá la
-- clave: las cuatro válidas son beisbol-inf-1, -2, -3 y -4.
--
-- Generado el 2026-08-15 contra la base de producción.


-- Torneo regional de beisbol interclubes ( Pre-Infantil )
--   → Con el entrenador — los niños más pequeños del set
UPDATE tournaments SET card_image = 'beisbol-inf-2' WHERE id = '0f16db8a-3450-4b5c-a12a-6557855d3c7c';

-- Torneo regional de beisbol interclubes ( Infantil )
--   → Lanzando
UPDATE tournaments SET card_image = 'beisbol-inf-1' WHERE id = '1a07f062-00ef-4b03-9e01-304ae67b3ffc';

-- Torneo regional de beisbol interclubes ( Pony )
--   → Bateando
UPDATE tournaments SET card_image = 'beisbol-inf-4' WHERE id = 'ea5b6990-b299-4bff-8b5c-a9384bad33d8';

-- Torneo regional de beisbol interclubes ( Pre-Junior )
--   → Robando base — los muchachos más grandes
UPDATE tournaments SET card_image = 'beisbol-inf-3' WHERE id = '2fae91e0-a36b-44ee-a071-aef855e4b44b';


-- ---------------------------------------------------------------------------
-- Verificación: los 4 con foto y ninguna repetida
-- ---------------------------------------------------------------------------
SELECT name, card_image
FROM   tournaments
WHERE  sport = 'beisbol'
ORDER  BY name;

-- Cuántos torneos quedan sin foto en TODA la plataforma (debería dar 0):
SELECT count(*) AS torneos_sin_foto FROM tournaments WHERE card_image IS NULL;
