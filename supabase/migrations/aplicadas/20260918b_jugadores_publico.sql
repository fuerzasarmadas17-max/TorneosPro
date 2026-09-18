-- Datos privados de los jugadores, PASO 1 de 2: abrir el camino nuevo.
--
-- QUÉ RESUELVE
-- La tabla `players` deja leer a cualquiera (hasta sin sesión) la cédula, la
-- fecha de nacimiento y la EPS de todos los jugadores, menores incluidos. La
-- página del torneo no los muestra, pero los recibe, y cualquiera con la llave
-- pública (que está dentro de la página) puede pedir la tabla entera.
--
-- LO QUE HACE ESTE ARCHIVO (solo agrega; no cierra nada todavía)
-- 1. `players_publico`: los jugadores como los ve el público — nombre y edad
--    ya calculada, sin cédula, fecha ni EPS.
-- 2. `jugadores_privados(...)`: la cédula, la fecha y la EPS, solo de los
--    equipos de torneos del que pregunta (o de todos, si es admin). Es lo que
--    usa la ventana de nómina del organizador.
--
-- ORDEN
-- 1. Este archivo.
-- 2. Desplegar el código (lee de `players_publico` y de `jugadores_privados`).
--    Sin este archivo antes, la página de torneos no carga los equipos.
-- 3. `20260918c_jugadores_cerrar.sql`, que cierra la lectura directa.

-- ========================
-- 1. LA EDAD, POR AÑO
-- ========================
-- Año actual menos año de nacimiento, igual que `getAgeFromBirthDate` en la
-- app (así se manejan las categorías: "los del 2010"). La fecha está guardada
-- como texto; se toma el año del principio (2010-06-15) o del final
-- (15/06/2010). Si no se entiende, o da algo absurdo, no hay edad.
CREATE OR REPLACE FUNCTION public.edad_por_anio(fecha text)
RETURNS int
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN anio IS NULL THEN NULL
    WHEN extract(year FROM current_date)::int - anio BETWEEN 0 AND 120
      THEN extract(year FROM current_date)::int - anio
  END
  FROM (
    SELECT CASE
      WHEN fecha ~ '^\s*\d{4}' THEN substring(fecha FROM '^\s*(\d{4})')::int
      WHEN fecha ~ '\d{4}\s*$' THEN substring(fecha FROM '(\d{4})\s*$')::int
    END AS anio
  ) x
$$;

-- ========================
-- 2. LOS JUGADORES QUE VE EL PÚBLICO
-- ========================
-- Es una vista del dueño de la base: lee `players` aunque después se le cierre
-- la lectura al público, y solo deja salir estas columnas.
CREATE OR REPLACE VIEW public.players_publico AS
SELECT
  p.id,
  p.team_id,
  p.name,
  p.age,
  p.created_at,
  public.edad_por_anio(p.birth_date) AS edad
FROM public.players p;

COMMENT ON VIEW public.players_publico IS
  'Jugadores sin datos privados: nombre y edad (calculada). La cédula, la fecha de nacimiento y la EPS solo salen por jugadores_privados().';

GRANT SELECT ON public.players_publico TO anon, authenticated;

-- ========================
-- 3. LOS DATOS PRIVADOS, SOLO PARA EL DUEÑO
-- ========================
-- Devuelve cédula, fecha y EPS de los jugadores de los equipos pedidos, pero
-- solo los de equipos que están en un torneo creado por quien pregunta, o
-- todos si es admin. Los demás equipos se ignoran en silencio.
CREATE OR REPLACE FUNCTION public.jugadores_privados(p_team_ids uuid[])
RETURNS TABLE (id uuid, document_number text, birth_date text, eps text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.document_number, p.birth_date, p.eps
  FROM players p
  WHERE p.team_id = ANY (p_team_ids)
    AND (
      EXISTS (
        SELECT 1
        FROM tournament_teams tt
        JOIN tournaments t ON t.id = tt.tournament_id
        WHERE tt.team_id = p.team_id
          AND t.created_by = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
      )
    )
$$;

REVOKE ALL ON FUNCTION public.jugadores_privados(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.jugadores_privados(uuid[]) TO authenticated;

-- ========================
-- PARA CONFIRMAR QUE QUEDÓ BIEN
-- ========================
-- Tiene que devolver una línea: la vista con tantos jugadores como la tabla,
-- y la función creada.
SELECT
  (SELECT count(*) FROM public.players_publico) AS jugadores_en_vista,
  (SELECT count(*) FROM public.players) AS jugadores_en_tabla,
  (SELECT count(*) FROM pg_proc WHERE proname = 'jugadores_privados') AS funcion_creada;
