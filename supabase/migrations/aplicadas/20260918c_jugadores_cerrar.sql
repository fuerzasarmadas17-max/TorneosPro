-- Datos privados de los jugadores, PASO 2 de 2: cerrar la lectura directa.
--
-- QUÉ HACE
-- Desde la app (con o sin sesión) ya no se pueden leer la cédula, la fecha de
-- nacimiento ni la EPS de la tabla `players`. Se siguen pudiendo leer el id,
-- el equipo, el nombre y la edad cargada a mano. Escribir no cambia: el
-- organizador sigue cargando y editando su nómina igual.
--
-- ORDEN: SOLO DESPUÉS de correr `20260918b_jugadores_publico.sql` y de
-- desplegar el código nuevo. Si se corre antes, la página del torneo no carga
-- los equipos (el código viejo pide todas las columnas).
--
-- SI ALGO SALE MAL, se deshace con una línea:
--   GRANT SELECT ON public.players TO anon, authenticated;

REVOKE SELECT ON public.players FROM anon, authenticated;
GRANT SELECT (id, team_id, name, age, created_at)
  ON public.players TO anon, authenticated;

-- ========================
-- PARA CONFIRMAR QUE QUEDÓ BIEN
-- ========================
-- Tiene que devolver `false` en las tres columnas privadas y `true` en el
-- nombre: el público ya no puede leerlas, el nombre sí.
SELECT
  has_column_privilege('anon', 'public.players', 'document_number', 'SELECT') AS anon_lee_cedula,
  has_column_privilege('anon', 'public.players', 'birth_date', 'SELECT') AS anon_lee_fecha,
  has_column_privilege('authenticated', 'public.players', 'eps', 'SELECT') AS usuario_lee_eps,
  has_column_privilege('anon', 'public.players', 'name', 'SELECT') AS anon_lee_nombre;
