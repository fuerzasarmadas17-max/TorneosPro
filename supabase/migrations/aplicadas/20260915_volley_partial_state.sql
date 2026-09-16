-- ============================================================================
-- Vóley: por dónde iba un partido que se aplazó a mitad de camino
-- ----------------------------------------------------------------------------
-- ORDEN: esta migración va ANTES de desplegar el código. La columna nace en
-- NULL y hoy no la lee nadie, así que correrla antes no rompe nada; correrla
-- después sí, porque la planilla va a intentar escribir una columna que no
-- existe justo cuando alguien la necesita, que es cuando está lloviendo.
--
-- QUÉ ES
-- Hasta hoy un partido solo podía estar sin jugar o jugado. Si llueve en el
-- segundo set, la mesa no tiene dónde dejar el 15-10: o lo carga como si el
-- partido hubiera terminado —y le ensucia la tabla de posiciones al torneo— o
-- lo pierde.
--
-- Esta columna es la carpeta donde se guarda la hoja a medio llenar. Adentro va
-- cómo iba el partido cuando se aplazó: los sets ya cerrados, los puntos del set
-- en curso, quién estaba sacando y de qué lado estaba cada equipo.
--
-- POR QUÉ NO EN EL MARCADOR DEL PARTIDO
-- Porque un 1-0 en un partido a 3 sets no es un resultado de vóley, es un
-- partido a medias. `validateVolleyballSets` lo rechaza a propósito —es lo que
-- impide que un partido a medio cargar descuadre la tabla— y las tablas de
-- posiciones solo cuentan partidos en `completed`. Escribir el parcial en
-- `home_score`/`away_score` rompería las dos cosas. Acá lo ven solo la pestaña
-- de Aplazados y la planilla el día que el partido se reprograme.
--
-- POR QUÉ JSON Y NO SEIS COLUMNAS
-- Se escribe entero y se lee entero, y solo existe en el rato que va entre la
-- lluvia y la reprogramación. Seis columnas sueltas en `matches` —que es la
-- tabla de todos los deportes— quedarían en NULL para siempre en fútbol,
-- básquet y béisbol. Y el día que haga falta guardar un dato más, no hace falta
-- otra migración.
--
-- CUÁNDO SE BORRA
-- Cuando el partido por fin termina y el resultado queda guardado. A partir de
-- ahí el marcador oficial es el marcador y esto no tiene por qué seguir dando
-- vueltas. Un partido se puede aplazar las veces que haga falta: cada vez se
-- reescribe entera con cómo iba esa última vez.
--
-- LO QUE NO GUARDA
-- La rotación, la nómina, los cambios y los tiempos ya gastados. Decisión del
-- dueño (2026-09-15): el día que se retome probablemente no vayan los mismos
-- jugadores, así que esos datos no le sirven a nadie y se cargan de cero.
--
-- Ver `Por hacer/APLAZADO-PLANILLA-URGENTE.md`.
-- ============================================================================

BEGIN;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS volley_partial_state JSONB;

COMMENT ON COLUMN matches.volley_partial_state IS
  'Solo vóley: por dónde iba un partido aplazado a mitad de camino. {setsCerrados:[{n,home,away}], enCurso:{n,home,away,saca,izquierda,yaCambiaronDeCancha}, motivo, aplazadoEn, mesa}. NO es el resultado del partido: el marcador oficial sigue en home_score/away_score y en volleyball_sets, y esos quedan vacíos hasta que el partido termine de verdad. Se borra cuando el resultado se guarda. Ver Por hacer/APLAZADO-PLANILLA-URGENTE.md';

COMMIT;
