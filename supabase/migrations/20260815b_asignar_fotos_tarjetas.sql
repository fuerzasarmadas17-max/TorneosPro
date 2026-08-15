-- ============================================================================
-- Asignar la foto de tarjeta a los torneos que ya existen
-- ----------------------------------------------------------------------------
-- Se hace por SQL y no desde el admin porque la policy de la base
-- ("Creador edita torneo": created_by = auth.uid()) sólo deja al DUEÑO tocar
-- su torneo. Ni siquiera el superadmin puede cambiarle la foto a un torneo
-- ajeno desde la interfaz.
--
-- CÓMO USARLO
--   1. Recorré la lista. Cada torneo trae una clave SUGERIDA por su nombre.
--   2. Si la sugerencia no le pega, cambiá la clave por otra de las que
--      aparecen listadas arriba de su deporte.
--   3. Si un torneo no lo querés tocar, borrá o comentá su línea.
--   4. Corré todo de una.
--
-- La clave tiene que existir Y ser del mismo deporte del torneo. Si te
-- equivocás de deporte no se rompe nada: la tarjeta simplemente cae al
-- degradado, como si no hubiera elegido.
--
-- Generado el 2026-08-15 contra la base de producción.


-- ==========================================================================
-- VOLLEYBALL — 10 torneo(s)
-- ==========================================================================
--
-- Claves disponibles para este deporte:
--   volleyball-playa-1 (playa hombres)
--   volleyball-playa-2 (playa mujeres)
--   volleyball-mixto-1 (mixto)
--   volleyball-masc-1 (masculino)
--   volleyball-jov-masc-1 (jóvenes h)
--   volleyball-padres-1 (padres)
--   volleyball-mamas-1 (mamás)
--   volleyball-jov-fem-1 (jóvenes m)
--   volleyball-inf-1 (niños)
--   volleyball-inf-2 (niñas)
--

-- Femenino Aprendiz   (in-progress)
UPDATE tournaments SET card_image = 'volleyball-jov-fem-1' WHERE id = '5ffd3eef-3909-4ba6-b9e1-996c24eb634c';

-- Femenino 2.0   (in-progress)
UPDATE tournaments SET card_image = 'volleyball-jov-fem-1' WHERE id = 'e988ea01-d428-4206-9d66-6cf4e6aaeb21';

-- Mamás aprendiz y cero   (in-progress)
UPDATE tournaments SET card_image = 'volleyball-mamas-1' WHERE id = '6e459eff-cc7c-49d4-bbf3-16888d370d76';

-- Papás aprendiz y cero   (in-progress)
UPDATE tournaments SET card_image = 'volleyball-padres-1' WHERE id = 'bbb1eea7-bb21-4f41-b055-24edd3254631';

-- Masculino Aprendiz 2.0   (in-progress)
UPDATE tournaments SET card_image = 'volleyball-jov-masc-1' WHERE id = '5d2a8437-bb6d-464a-a806-ccc3358aec36';

-- Volleyball Mujeres 3   (in-progress)
UPDATE tournaments SET card_image = 'volleyball-jov-fem-1' WHERE id = '954a4de4-c4f1-4040-91ff-ba69541c4b51';

-- MASCULINO AMATEUR LOS PIONEROS   (in-progress)
UPDATE tournaments SET card_image = 'volleyball-masc-1' WHERE id = 'b3136d02-eee3-410d-8def-22fbea2cdba8';

-- MIXTO AMATEUR   (in-progress)
UPDATE tournaments SET card_image = 'volleyball-mixto-1' WHERE id = '60862cb2-f55e-4679-9cb1-13ca67e867b1';

-- FEMENINO REGULAR   (in-progress)
UPDATE tournaments SET card_image = 'volleyball-jov-fem-1' WHERE id = 'f8cd23c9-5df4-4019-b2b8-f5016f123cab';

-- Femenino Amateur   (in-progress)
UPDATE tournaments SET card_image = 'volleyball-jov-fem-1' WHERE id = 'ef361cd9-fc5e-4113-a098-2ea9c6f4b13f';

-- ==========================================================================
-- FÚTBOL — 6 torneo(s)
-- ==========================================================================
--
-- Claves disponibles para este deporte:
--   futbol-masc-1 (adultos, celebración)
--   futbol-masc-2 (adultos, plano general)
--   futbol-jov-masc-1 (jóvenes)
--

-- XXI Copa JETSETV - Clausura   (in-progress)
UPDATE tournaments SET card_image = 'futbol-masc-1' WHERE id = '58efcc8d-bdff-40ae-87bd-a9e1a3929602';

-- Copa Torneos Pro   (in-progress)
UPDATE tournaments SET card_image = 'futbol-masc-2' WHERE id = 'b6892beb-9305-46a0-9fd8-ded3400c54ab';

-- Copa Elite El Cortijo   (in-progress)
UPDATE tournaments SET card_image = 'futbol-jov-masc-1' WHERE id = '404a3164-e3b7-42ef-9e2d-8f835dde2e40';

-- T. Semiempresarial f6   (upcoming)
UPDATE tournaments SET card_image = 'futbol-masc-1' WHERE id = '2536e3f7-c348-44c9-afeb-a2753953472c';

-- 2do Torneo Vacacional   (upcoming)
UPDATE tournaments SET card_image = 'futbol-jov-masc-1' WHERE id = 'b460c9e8-230b-441b-90df-e31aba91b895';

-- Sincelejo Cup   (completed)
UPDATE tournaments SET card_image = 'futbol-masc-2' WHERE id = 'b179aafb-04b2-4993-9cd6-d803abb46e3e';

-- ==========================================================================
-- SOFTBALL — 4 torneo(s)
-- ==========================================================================
--
-- Claves disponibles para este deporte:
--   softball-masc-1 / -2 (hombres)
--   softball-jov-masc-1 / -2 (jóvenes h)
--   softball-fem-1 / -2 (mujeres)
--   softball-jov-fem-1 / -2 (jóvenes m)
--

-- Imder Barrios   (in-progress)
UPDATE tournaments SET card_image = 'softball-masc-1' WHERE id = '32a2adfd-29d9-495d-81de-865e58e35a21';

-- Plus 50   (in-progress)
UPDATE tournaments SET card_image = 'softball-masc-2' WHERE id = 'fcf1223e-60d5-4cd5-a2f9-29bb07e73747';

-- II Torneo de Softbol "Fuerza Femenina"   (in-progress)
UPDATE tournaments SET card_image = 'softball-fem-1' WHERE id = '3192e60f-a2e9-4fd9-87d8-b170aa63c3aa';

-- El Primer Home Run III   (in-progress)
UPDATE tournaments SET card_image = 'softball-jov-masc-1' WHERE id = '9084f42c-88f5-4be0-9be0-4d85f42aa930';

-- ==========================================================================
-- MICROFÚTBOL — 1 torneo(s)
-- ==========================================================================
--
-- Claves disponibles para este deporte:
--   microfutbol-masc-1 / -2 (hombres)
--   microfutbol-fem-1 / -2 (mujeres)
--

-- TORNEO EL GOLEADOR   (in-progress)
UPDATE tournaments SET card_image = 'microfutbol-masc-1' WHERE id = '266d8775-21ae-403d-a6c8-b2c540be3416';

-- ==========================================================================
-- BÉISBOL — 4 torneo(s)
-- ==========================================================================
--
-- ⛔ NO HAY FOTOS DE BÉISBOL TODAVÍA. Estos 4 torneos se quedan en
-- degradado hasta que se generen. Los dejo listados y comentados para que
-- cuando existan las fotos sólo haya que descomentar y poner la clave.
--
-- UPDATE tournaments SET card_image = 'beisbol-inf-?' WHERE id = '2fae91e0-a36b-44ee-a071-aef855e4b44b';  -- Torneo regional de beisbol interclubes ( Pre-Junior )
-- UPDATE tournaments SET card_image = 'beisbol-inf-?' WHERE id = '1a07f062-00ef-4b03-9e01-304ae67b3ffc';  -- Torneo regional de beisbol interclubes ( Infantil )
-- UPDATE tournaments SET card_image = 'beisbol-inf-?' WHERE id = '0f16db8a-3450-4b5c-a12a-6557855d3c7c';  -- Torneo regional de beisbol interclubes ( Pre-Infantil )
-- UPDATE tournaments SET card_image = 'beisbol-inf-?' WHERE id = 'ea5b6990-b299-4bff-8b5c-a9384bad33d8';  -- Torneo regional de beisbol interclubes ( Pony )


-- ---------------------------------------------------------------------------
-- Verificación: cómo quedó cada torneo
-- ---------------------------------------------------------------------------
SELECT sport, name, COALESCE(card_image, '— sin foto —') AS foto
FROM   tournaments
ORDER  BY sport, name;

-- Cuántos quedaron sin foto (deberían ser sólo los de béisbol):
SELECT sport, count(*) AS sin_foto
FROM   tournaments
WHERE  card_image IS NULL
GROUP  BY sport;
