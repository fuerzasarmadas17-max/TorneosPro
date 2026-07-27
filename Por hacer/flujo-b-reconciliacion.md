# Flujo B — Reconciliación de jugadores por similitud (PENDIENTE)

Última actualización: 2026-07-25

## Contexto

Parte del trabajo grande de "identidad de jugador por `player_id`". Las estadísticas
(`match_events`) históricamente se guardaban solo por `player_name` (texto), sin vínculo
al jugador de la plantilla. Se hizo una migración por etapas para atarlas a un jugador
estable. **Ya está hecho todo menos el Flujo B.**

### Ya hecho y en prod
- **Paso 0 — IDs de jugador estables.** `updateTeamPlayers` guarda granular conservando
  `players.id` (antes lo regeneraba en cada guardado). El diálogo de plantilla conserva/
  mintea ids (`crypto.randomUUID`). Commit `c225ae7`.
- **Paso 1 — Flujo A.** Al guardar un resultado (SOLO organizador), los nombres que no
  están en la plantilla se ofrecen en un modal → se inscriben en el equipo. Los que
  coinciden (normalizado) se **canonizan** a la ortografía oficial. Verificación contra
  la plantilla FRESCA de la base (`fetchTeamsByIds`) para no depender del estado en
  memoria. Commit `d0f0d0d`.
- **Backfill histórico.** Por torneo (y luego global) se crearon jugadores para todos los
  goleadores históricos y se enlazaron todos los `match_events.player_id`. Verificado:
  0 eventos sin enlazar, 0 mal asociados, 0 nombres apuntando a >1 jugador.
- **Paso 2 — `player_id` en eventos + agregación por id.** Columna `player_id UUID
  REFERENCES players(id) ON DELETE SET NULL` (nullable). Se estampa al guardar
  (organizador y anotador; el anotador NO inscribe, solo enlaza si el nombre matchea).
  `use-tournament-stats.ts` agrupa por `player_id ?? nombre-normalizado::teamId`.
  Commit `878e186`.

### Descartado
- **Paso 4 (`player_id` non-nullable).** NO se hace. Un evento puede legítimamente no
  tener id porque el anotador público no inscribe: si escribe un nombre fuera de la
  plantilla, queda sin id y agrega por nombre (fallback). Nullable + fallback es el
  estado final correcto.

## Decisiones de diseño (respetar en el Flujo B)
- **Jugadores por equipo/torneo, NO persona global.** Un club en 3 torneos = 3 filas de
  `teams` con UUID distinto, cada una con su plantilla. La misma persona en 3 torneos = 3
  jugadores. La reconciliación es SIEMPRE dentro de un mismo `team_id`.
- **Anotar por nombre siempre libre** (con o sin plantilla). No romper eso.
- **El anotador público NO inscribe ni fusiona** (evita que cualquiera modifique la
  plantilla). Flujo B corre SOLO en el organizador.
- Normalización de nombres: `normalizePlayerName` en `src/lib/name-utils.ts`
  (trim + colapsar espacios + minúsculas).

## Qué falta: el Flujo B

Une **nombres parecidos pero NO idénticos** que quedaron como jugadores distintos (los
idénticos ya los une la canonización / el backfill).

### Dispara
1. Al **importar una planilla** a un equipo.
2. Al **guardar un resultado** (solo organizador).

### Detecta coincidencia cuando
- **Contención:** un nombre contiene al otro (`Julian Perez` ⊂ `Julian Perez Ruiz`).
- **Similitud ~90%:** difusa, tipo Levenshtein/Jaro-Winkler (`Yoshua`/`Joshua`/`Jhosua`).
  Umbral a afinar y probar (falsos positivos/negativos).

### Modal (por cada nombre que coincide) — con la aclaración del usuario
Ej: existe `Julian Perez` (A) y llega `Julian Perez Ruiz` (B). *"¿Es el mismo jugador?"*
con **3 opciones**:
1. **Es el mismo → dejar A** (`Julian Perez`).
2. **Es el mismo → dejar B** (`Julian Perez Ruiz`).
3. **Es otro jugador** → inscribir aparte como nuevo.

- En las dos primeras: es UN solo jugador (mismo `id`), las stats de A y B **se combinan**;
  solo se elige qué nombre queda como oficial. En caso de planilla, los datos (documento,
  EPS, fecha) se cargan desde la planilla, gane A o B.
- Como las stats ya agrupan por `player_id`, "actualizar" = editar la fila del jugador
  (`players.name`) y/o reasignar `match_events.player_id`; las estadísticas siguen solas.
- **UX cola de modales:** si una planilla trae varios nombres que coinciden, mostrarlos de
  a uno ("1 de N"), no todos juntos.

### Sirve además para limpiar el backfill
El backfill dejó como jugadores SEPARADOS los que difieren en algo más que
mayúsculas/espacios. Ejemplos reales detectados:
- `NICOL OCAMPO` / `NICOLL OCAMPO`
- `Julián Gonzales` / `Julián Gonzalez` (s/z)
- `EMILY` / `EMILY ROSA`, `VALERI` / `VALERY`, `YULI OVIEDO` / `YULIETH OVIEDO`
- `DANIELA P.` / `DANIELA PACHECO`
- `ALBERTO JARABA` / `ALBERTOJARABA` (con/sin espacio)
- `DT ELIECER BALLESTA` / `DT ELIECER BALLESTAS`
- Cuerpo técnico (`DT ...`, `AT ...`) quedó inscrito como "jugador" (el usuario lo aceptó
  así). Si más adelante molesta, se puede filtrar o marcar.

## Archivos clave para el Flujo B
- Import de planilla: `src/components/tournaments/team-roster-dialog.tsx`
  (`handleImportExcel`, `updateTeamPlayers`).
- Guardado de resultado (organizador): `src/components/forms/match-result-form.tsx`
  (`saveWithInscription` / `confirmInscribe` — ahí vive la lógica de canonización/inscripción).
- Persistencia de plantilla: `src/lib/db/teams.ts` (`updateTeamPlayers`, granular).
- Agregación de stats: `src/hooks/use-tournament-stats.ts` (agrupa por `player_id`).
- Normalización: `src/lib/name-utils.ts`.
