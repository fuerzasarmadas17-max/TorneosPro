-- ============================================================================
-- Foto de tarjeta para "SANTO COFFEE MASCULINO 🏐🏆🔥 SENIOR"
-- ----------------------------------------------------------------------------
-- Volleyball masculino de mayores de 35, creado el 2026-08-19. Era el único
-- torneo de volley sin foto en toda la plataforma.
--
-- Se usa `volleyball-padres-1` y no `volleyball-masc-1` porque la categoría es
-- +35: la foto de "Padres" retrata a un equipo de hombres adultos celebrando
-- el punto (canas, rodilleras), mientras que `masc-1` es un bloqueo de
-- jugadores jóvenes al aire libre. Con la edad de la categoría a la vista, la
-- tarjeta le habla al público que se va a inscribir.
--
-- `volleyball-padres-1` ya la usa "Papás aprendiz y cero", pero ese torneo es
-- de otro organizador y no comparte listado con este, así que la repetición no
-- se lee como error de carga.
--
-- Va por SQL y no desde la interfaz porque el torneo no es del admin: la
-- policy "Creador edita torneo" sólo deja al dueño tocar el suyo.

UPDATE tournaments
SET    card_image = 'volleyball-padres-1'
WHERE  id = '84959593-88cc-45c1-9b21-084d5db065f6';

-- Verificación: debe devolver una fila con volleyball-padres-1.
SELECT name, sport, card_image
FROM   tournaments
WHERE  id = '84959593-88cc-45c1-9b21-084d5db065f6';

-- Cuántos torneos quedan sin foto en TODA la plataforma:
SELECT count(*) AS torneos_sin_foto FROM tournaments WHERE card_image IS NULL;
