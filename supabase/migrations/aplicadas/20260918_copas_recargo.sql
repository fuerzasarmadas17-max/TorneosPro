-- Torneo con varias copas: el recargo del 15%, pagado una sola vez.
--
-- QUÉ RESUELVE
-- Jugar con copas (Oro, Plata, Bronce) tiene un recargo del 15% sobre el precio
-- de lista del torneo. Hace falta saber si un torneo ya lo pagó, para no
-- cobrarlo dos veces si el organizador vuelve a una sola llave y después otra
-- vez a copas.
--
-- LO QUE HACE
-- Le agrega a `tournaments` la columna `cups_surcharge_paid`: falso hasta que el
-- recargo se paga (o se da por pagado porque el torneo tiene bono del 100%).
--
-- A LOS TORNEOS QUE YA EXISTEN NO LES PASA NADA
-- Todos quedan en falso. Ninguno tiene copas todavía.
--
-- ORDEN: correr ANTES de desplegar. La app nueva lee esta columna.

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS cups_surcharge_paid boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN tournaments.cups_surcharge_paid IS
  'Ya se pagó (o se dio por pagado con bono del 100%) el recargo por jugar con varias copas. Se cobra una sola vez por torneo.';

-- ========================
-- PARA CONFIRMAR QUE QUEDÓ BIEN
-- ========================
-- Tiene que devolver una línea: la columna existe y ningún torneo la tiene
-- prendida todavía.

SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'cups_surcharge_paid') AS columna_creada,
  (SELECT count(*) FROM tournaments WHERE cups_surcharge_paid) AS torneos_con_recargo;
