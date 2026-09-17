-- Arreglo de dato (no es cambio de estructura).
--
-- "2do Torneo Vacacional" tiene un pago aprobado de $100.000 en efectivo
-- (referencia EFECTIVO-2026-001), que es el plan Pro: hasta 24 equipos.
-- Pero la ficha del torneo quedó guardada como Medio / $70.000, así que al
-- querer pasar de 16 a 17 equipos el sistema le pedía los $30.000 de un cupo
-- que ya estaba pagado.
--
-- La causa del daño era el diálogo de "Agregar Equipos": reescribía el plan
-- con el que correspondiera al número de equipos DEL MOMENTO, así que borrar
-- equipos degradaba el plan comprado. Eso ya quedó corregido en el código
-- (add-teams-dialog.tsx: el plan solo sube, nunca baja) y la cotización ahora
-- toma como base el plan pagado, no el conteo actual (payments/upgrade.ts).
-- Esta consulta solo repara el torneo que ya se dañó.

UPDATE tournaments
SET    tier  = 'pro',
       price = 100000
WHERE  id = 'b460c9e8-230b-441b-90df-e31aba91b895';

-- Verificación: debe devolver una fila con tier = 'pro' y price = 100000.
SELECT id, name, plan, tier, price
FROM   tournaments
WHERE  id = 'b460c9e8-230b-441b-90df-e31aba91b895';
