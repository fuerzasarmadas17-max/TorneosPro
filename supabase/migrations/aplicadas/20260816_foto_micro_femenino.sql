-- ============================================================================
-- Foto de tarjeta para "IIITORNEO FEMENINO ELLAS JUEGAN - LIGA 3"
-- ----------------------------------------------------------------------------
-- Microfútbol femenino, de Jhanpier Rocha, creado el 2026-08-16.
-- Va por SQL y no desde la interfaz porque el torneo no es del admin: la
-- policy "Creador edita torneo" sólo deja al dueño tocar el suyo.
--
-- Se usa `microfutbol-fem-2` y no `-fem-1` porque la primera quedó con un
-- plano demasiado abierto: a tamaño tarjeta (~245px de ancho) las jugadoras
-- se ven como puntos y no se entiende la jugada. La segunda tiene a las dos
-- jugadoras disputando el balón, que sí se lee en miniatura.
--
-- El otro torneo de micro usa `microfutbol-masc-2`, así que las dos tarjetas
-- se distinguen entre sí.

UPDATE tournaments
SET    card_image = 'microfutbol-fem-2'
WHERE  id = '06eef7fa-57fe-4d73-bdd4-94ea9b69afad';

-- Verificación: debe devolver una fila con microfutbol-fem-2.
SELECT name, sport, card_image
FROM   tournaments
WHERE  id = '06eef7fa-57fe-4d73-bdd4-94ea9b69afad';
