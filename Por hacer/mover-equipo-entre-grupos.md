# No se puede mover un equipo de grupo sin perder el fixture

**Estado:** identificado, no implementado. **Verificado el 2026-08-06: sigue
sin implementarse** — no existe ninguna acción de "mover equipo de grupo",
tampoco el guardarraíl del diálogo de eliminar, y `bulkUpsertMatches`
(`src/lib/db/matches.ts:60`) **sigue sin llamadores**: la mina enterrada
continúa ahí. El procedimiento manual por SQL sigue siendo el camino.
**Fecha:** 2026-07-14.
**Origen:** caso real en producción — "Torneo regional de beisbol interclubes (Pre-Infantil)"
(`0f16db8a-3450-4b5c-a12a-6557855d3c7c`). Se resolvió a mano con SQL.

## Síntoma

Un organizador arma los grupos, la app genera el calendario, se empiezan a jugar
partidos… y recién ahí se da cuenta de que **un equipo quedó en el grupo
equivocado**. Hoy no hay ninguna forma segura de corregirlo desde la interfaz.

Es un caso que se va a repetir: equipo mal asignado, equipo que se baja, equipo
que se inscribe tarde, equipo que se cambia de categoría.

## Caso concreto reportado

"Bravos de Los Palmitos" quedó en el Grupo A cuando debía ir al Grupo B. Para ese
momento el torneo ya tenía 3 partidos jugados con resultados y estadísticas
cargadas (Futuras 21-0 Carpinteros, Atletics 1-18 Futuras, Caballeros 6-9 Percy)
y una tabla de posiciones publicada.

Lo que hacía falta:

1. Mover el equipo de `tournament_group_teams` (Grupo A → Grupo B).
2. Borrar sus partidos **no jugados** contra los rivales del grupo viejo.
3. Crear sus partidos contra los rivales del grupo nuevo.
4. **Sin tocar** los partidos ya jugados de los demás equipos.

Ninguno de los caminos que ofrece la app hoy hace esto.

## Por qué no se puede hoy

### 1. Las dos acciones que existen hoy no sirven para esto

En el menú del equipo (`tournament-detail.tsx:231`) hay dos opciones, **ambas con
diálogo de confirmación explícito** — ninguna es silenciosa:

- **Descalificar** (`disqualifyTeam`, `tournament-context.tsx:445`): no borra nada.
  Agrega el equipo a `disqualified_team_ids` y sus partidos quedan anulados a efectos
  de la tabla. En playoffs el rival avanza 3-0. **No sirve**: el equipo queda fuera
  del torneo, no cambiado de grupo.
- **Eliminar del torneo** (`removeTeamFromTournament`, `tournaments.ts:261`): borra
  **todos** sus partidos, jugados y por jugar. El diálogo lo advierte con claridad.
  **No sirve**: el equipo se va del torneo y hay que reinscribirlo y rearmarle todo.

El delete de `removeTeamFromTournament` no filtra por `status` ni por marcador:

```ts
// 2. Delete all matches involving this team
await supabase
  .from("matches")
  .delete()
  .eq("tournament_id", tournamentId)
  .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);
```

Es coherente con lo que promete el diálogo, así que **no es un bug** — es la
semántica buscada. Lo que falta es una tercera acción, no destructiva, que **mueva**
el equipo en lugar de sacarlo.

### 2. Cambiar el grupo no regenera el calendario

`assignTeamsToPhaseGroups` (`src/lib/db/tournaments.ts:412`) reescribe
`tournament_group_teams` para los grupos editados, pero **no toca `matches`**. El
equipo aparece en el grupo nuevo en la tabla de posiciones, mientras el calendario
sigue mostrando los cruces del grupo viejo. Estado inconsistente.

### 3. `bulkUpsertMatches` es tierra arrasada

`src/lib/db/matches.ts:60`:

```ts
await supabase.from("matches").delete().eq("tournament_id", tournamentId);
```

Borra **todos** los partidos del torneo antes de reinsertar. Hoy no tiene llamadores
en `src/` — es una mina enterrada, no un camino activo. Conviene revisarla o
eliminarla antes de que alguien la use para "regenerar el fixture".

## Qué hay que construir

Una operación **"mover equipo de grupo"** que preserve lo jugado:

1. Validar: el equipo **no puede tener partidos `completed`** en su grupo actual.
   Si los tiene, bloquear y explicar por qué (mover un equipo que ya jugó
   invalidaría los resultados de sus rivales).
2. `tournament_group_teams`: borrar la fila del grupo origen, insertar la del destino.
3. `matches`: borrar los del equipo en el grupo origen, filtrando siempre por
   `status <> 'completed' and home_score is null and away_score is null`.
4. `matches`: crear uno contra cada rival del grupo destino (y dos si
   `double_round_robin`), respetando las jornadas existentes: en cada jornada hay
   un equipo libre, y ese es el rival que le toca. Así no se generan jornadas
   nuevas ni un equipo juega dos veces la misma fecha.
5. Los partidos nuevos quedan `unscheduled`, sin fecha ni sede, para que el
   organizador los programe.

Todo dentro de una transacción, o con verificación posterior.

### Detalle importante

**Las posiciones no se persisten** — JJ, JG, JP, PCT, GB, CA, CE y DIF se calculan
en el front desde `tournament.matches` (`use-baseball-standings.ts` y hermanos).
Así que corregidos los partidos, la tabla se arregla sola. No hay que recalcular nada.

## Guardarraíl mínimo (quick win)

Aun sin construir la funcionalidad completa: en el diálogo de **"Eliminar del
torneo"**, mostrar **cuántos partidos jugados** se van a borrar concretamente
("se borrarán 3 partidos, 2 de ellos ya jugados") en vez del texto genérico actual.
El aviso ya existe, pero no dimensiona el daño.

## Procedimiento manual mientras tanto (SQL)

Verificado en producción el 14/07/2026. Reemplazar los UUID:

```sql
-- 0) Comprobar que el equipo NO tiene partidos jugados. Debe dar 0 filas.
select id, status, home_score, away_score from matches
where tournament_id = ':tid'
  and (home_team_id = ':equipo' or away_team_id = ':equipo')
  and (status = 'completed' or home_score is not null or away_score is not null);

-- 1) Borrar sus partidos no jugados del grupo viejo (los 3 filtros son la red de seguridad)
delete from matches
where tournament_id = ':tid' and group_id = ':grupo_viejo'
  and (home_team_id = ':equipo' or away_team_id = ':equipo')
  and status <> 'completed' and home_score is null and away_score is null
returning id, round, match_number;

-- 2) Mover la pertenencia al grupo
delete from tournament_group_teams where group_id = ':grupo_viejo' and team_id = ':equipo';
insert into tournament_group_teams (group_id, team_id) values (':grupo_nuevo', ':equipo')
on conflict do nothing;

-- 3) Crear un partido contra cada rival del grupo nuevo, en las jornadas existentes.
--    Verificar antes con un select cuál es el equipo libre en cada jornada.
--    status = 'unscheduled', phase = 'group', match_number = max + 1.
```

**Ojo con el editor SQL de Supabase**: si envolvés esto en `begin;` sin `commit;`,
la transacción se revierte entera al cerrar la sesión y parece que "salió exitosa"
sin haber hecho nada. Y como no muestra el conteo de filas afectadas, conviene usar
`returning` y verificar con un `select` después de cada paso. Correr el `insert` dos
veces por creer que "no hizo nada" genera partidos duplicados (pasó).

Los jugadores nunca corren riesgo: cuelgan de `players.team_id → teams.id`, y la
fila del equipo en `teams` no se toca en ninguno de estos pasos.

## Cuándo retomarlo

Cuando vuelva a aparecer el caso — que va a aparecer. No es urgente: mientras tanto
se resuelve por SQL en 10 minutos, y las acciones destructivas que ya existen avisan
correctamente antes de borrar.
