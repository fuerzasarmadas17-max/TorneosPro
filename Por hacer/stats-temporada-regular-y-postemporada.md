# Separar las estadísticas en temporada regular y postemporada

**Estado:** diseñado y verificado contra el código, **no implementado**.
**Fecha:** 2026-08-17.
**Origen:** lo piden los organizadores de softbol. En un torneo con fase de
grupos + fase de grupos 2 + playoffs, las estadísticas deberían partirse en
dos y la segunda arrancar **desde cero** — promedios, hits, dobles, todo.

---

## Qué piden exactamente

> "La fase dos es desde cero todo: promedios, hits, dobles, etc."

- **Temporada regular** = fase 1 de grupos
- **Postemporada** = fase 2 de grupos + playoffs, contada desde cero hasta la
  final

Es la convención de béisbol y softbol: un jonrón de playoffs no cuenta para el
título de bateo de la temporada. No es una preferencia del organizador, es
cómo se lleva el deporte.

---

## La buena noticia: el dato ya está

**No hay que tocar la base.** La fase de cada partido se puede deducir con lo
que ya existe:

| Dónde vive | Qué dice |
|---|---|
| `matches.phase` | `"group"` o `"playoff"` |
| `tournament_groups.phase` | `1` o `2` |

Un partido de grupos apunta a su grupo por `groupId`, y el grupo sabe si es de
fase 1 o 2. De ahí sale la regla:

```
postemporada  =  match.phase === "playoff"
              O  el grupo de ese partido tiene phase === 2

regular       =  todo lo demás
```

⚠️ **El detalle que se pasa por alto:** `matches.phase` sólo distingue grupos
de playoffs. **No** dice si el partido es de fase 1 o fase 2 — eso hay que
buscarlo en el grupo. Quien implemente esto y filtre sólo por `match.phase` va
a meter la fase 2 dentro de la temporada regular sin darse cuenta.

### Cuántos torneos lo necesitan

Verificado en producción el 2026-08-17: de **26 torneos con grupos, 6 tienen
fase 2**. Y todos los que tienen playoffs (la gran mayoría) se benefician
igual, porque ahí la división natural es grupos = regular, playoffs = post.

---

## Por qué el corte va sobre los PARTIDOS y no sobre los totales

Es la decisión importante de todo el documento.

Un promedio de bateo no se puede partir después: no es sumar. Si un jugador
batea .400 en la regular y .200 en playoffs, su promedio de postemporada es
.200 — **no** el resultado de restarle algo al acumulado.

Como el cálculo actual parte de los eventos crudos de cada partido, **recortar
la lista de partidos antes de sumar da los promedios correctos gratis**. Es la
única forma que no obliga a reescribir la matemática de cada estadística.

---

## Qué hay que tocar

### 1. `src/hooks/use-tournament-stats.ts` (405 líneas) — el trabajo grueso

Hoy recorre `tournament.matches` en **cuatro** bucles distintos (líneas 137,
202, 284 y 291 al 2026-08-17).

El cambio es agregarle un parámetro de tramo y **recortar la lista una sola
vez arriba**, para que los cuatro bucles trabajen sobre la lista ya filtrada.
Filtrar dentro de cada bucle es la forma segura de que alguien se olvide de
uno.

```ts
export type StatsSegment = "regular" | "postemporada";

export function useTournamentStats(
  tournament: Tournament,
  segment?: StatsSegment   // undefined = todo junto, como hoy
)
```

Dejar `undefined` como "todo el torneo" mantiene el comportamiento actual para
los deportes que no separan temporadas, sin tocar a nadie más.

**Ojo con las dependencias del `useMemo`**: hoy son
`[tournament.matches, tournament.enabledStats, tournament.teamIds, tournament.sport]`.
Al agregar el tramo hay que incluirlo, y también los grupos — si no, cambiar
de pestaña no recalcula nada.

**Ojo con `teamGames` (línea ~280)**: es la base del umbral de calificación
al ranking de bateo, estilo MLB. Su comentario dice explícitamente que cuenta
"todo el torneo, incluye grupos + playoffs". Al separar tramos ese umbral
tiene que contar sólo los partidos del tramo, o en postemporada nadie va a
calificar (con 3 juegos de playoffs, exigir apariciones de temporada completa
deja la tabla vacía).

### 2. `src/components/standings/tournament-stats.tsx` (860 líneas) — el selector

Dos pestañas arriba: **Temporada regular / Postemporada**.

Tres helpers que conviene exportar desde el hook:

- `hasPostseason(tournament)` — si no hay playoffs ni fase 2, **el selector no
  se muestra**. Un selector con una pestaña siempre vacía confunde más de lo
  que ayuda.
- `currentSegment(tournament)` — con qué pestaña abrir: la que esté en juego.
  Si ya se jugó algo de postemporada, abre ahí; si no, en regular. Que el
  organizador no tenga que buscar dónde está parado.

### 3. Lo que NO hay que tocar

- La base de datos
- Las tablas de posiciones (cada grupo ya tiene la suya por separado)
- La forma de anotar los partidos
- El PDF de estadísticas — hereda el filtro solo, porque lee del mismo hook

---

## Decisiones tomadas

| Pregunta | Decisión | Por qué |
|---|---|---|
| ¿Hay pestaña "Total"? | **No** | Mezclar los dos tramos es justo lo que el organizador no quiere. Si alguien la pide después, agregarla es trivial. |
| ¿Qué se ve al abrir? | El tramo **en curso** | |
| ¿Y los torneos sin fase 2? | Grupos = regular, playoffs = post | Funciona igual y le sirve a muchos más torneos |
| ¿Y los de pura eliminación? | Sin selector | No hay nada que separar |

---

## Lo que falta preguntarles a los organizadores

**¿Quieren premiar aparte al mejor bateador de cada tramo?**

Si la respuesta es sí, probablemente también necesiten que **la tabla de
posiciones** respete la misma división, no sólo las estadísticas de jugador.
Vale la pena confirmarlo antes de construir, para no hacer el trabajo dos
veces.

---

## Esfuerzo

**Medio día.** No es un cambio de arquitectura: es un filtro que hoy no
existe, más un selector. Lo mecánico es el hook; lo delicado son los dos
`ojo` de arriba (la fase que vive en el grupo, y el umbral de calificación).
