-- ============================================================================
-- Prestarle un escudo al campeón y al equipo del MVP, para ver el modal
-- ----------------------------------------------------------------------------
-- Para el editor SQL de Supabase. Correr los bloques de a uno.
--
-- POR QUÉ
-- La cabecera del modal de cierre cambia de forma según haya escudo: sin
-- escudo va todo centrado (como siempre), con escudo el texto se corre a la
-- izquierda y el logo ocupa la derecha. En `Sincelejo Cup`, el campeón
-- (Alianza) y el equipo del MVP (Juventudes) no tienen escudo cargado, así que
-- el diseño nuevo no se puede ver. Esto les presta uno de la biblioteca.
--
-- QUÉ HACE EXACTAMENTE
-- Copia la imagen de un logo de la biblioteca a `teams.logo_url`, que es de
-- donde la app dibuja el escudo. NO toca `club_logo_id` a propósito: esa
-- columna ata el equipo a la biblioteca de UNA organización, y acá estamos
-- prestando una imagen de otra. Copiar la URL es lo mismo que hace el sistema
-- cuando el organizador elige un logo, y se deshace con un UPDATE.
--
-- ⚠️ `Sincelejo Cup` es de un cliente y está publicado. Estos escudos se van a
-- ver también en el calendario, las tablas y la página pública del torneo,
-- para cualquiera. Es reversible: el bloque 4 los saca.

-- ---------------------------------------------------------------------------
-- 1) Ver qué hay en la biblioteca. Copiá el NOMBRE del que quieras usar.
--    (Hay nombres repetidos entre organizaciones — ej. "AURA VOLEY" — por eso
--    los bloques de abajo llevan LIMIT 1: agarran el primero que encuentren.)
-- ---------------------------------------------------------------------------
SELECT name, image_url
FROM   club_logos
ORDER  BY name;

-- ---------------------------------------------------------------------------
-- 2) Escudo para el CAMPEÓN — Alianza.
--    Cambiá 'Leones de Since' por el nombre que hayas elegido en el bloque 1.
-- ---------------------------------------------------------------------------
UPDATE teams
SET    logo_url = (SELECT image_url FROM club_logos WHERE name = 'Leones de Since' LIMIT 1)
WHERE  id = 'cddd1f4c-fe76-46b2-8be5-fb9a9f86ad66'
RETURNING name, logo_url;

-- ---------------------------------------------------------------------------
-- 3) Escudo para el equipo del MVP — Juventudes.
-- ---------------------------------------------------------------------------
UPDATE teams
SET    logo_url = (SELECT image_url FROM club_logos WHERE name = 'Los Caballeros' LIMIT 1)
WHERE  id = 'f32939f7-e766-4b51-9a33-08f35528684b'
RETURNING name, logo_url;

-- ---------------------------------------------------------------------------
-- 4) Devolverlos como estaban (los dos venían SIN escudo).
-- ---------------------------------------------------------------------------
UPDATE teams
SET    logo_url = NULL
WHERE  id IN (
         'cddd1f4c-fe76-46b2-8be5-fb9a9f86ad66',  -- Alianza (campeón)
         'f32939f7-e766-4b51-9a33-08f35528684b'   -- Juventudes (equipo del MVP)
       )
RETURNING name, logo_url;
