# Separar las estadísticas en temporada regular y postemporada

**Estado:** **implementado** (falta desplegar y avisarle al organizador).
**Fecha:** 2026-08-17. Aprobado, re-verificado e implementado el 2026-08-28.
**Origen:** lo piden los organizadores de softbol. En un torneo con fase de
grupos + fase de grupos 2 + playoffs, las estadísticas deberían partirse en
dos y la segunda arrancar **desde cero** — promedios, hits, dobles, todo.

⚠️ **A quién preguntarle.** Al 2026-08-28, **6 de los 8 torneos de softbol y
béisbol en producción son del mismo organizador**, incluido el único que llegó
a fase 2 (*El Primer Home Run III*). "Los organizadores de softbol" es, en la
práctica, una persona. Cualquier duda de este documento se resuelve con una
llamada, no con una encuesta.

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

**Re-verificado el 2026-08-28, antes de escribir código.** Las cuatro cosas
que podían romper el plan, medidas contra producción:

| Qué se comprobó | Resultado |
|---|---|
| Grupos con `phase` en blanco | **0** de 53 (39 son fase 1, 14 son fase 2) |
| Torneos con fase 2 | 6 — coincide con el conteo de agosto |
| Partidos de grupo sin `group_id` | **0** — todos pueden resolver su fase |
| El front recibe los grupos con su fase | Sí: `Tournament.groups[].phase`, que llena `mapTournamentGroup` |

Conclusión: **no hay migración, ni backfill, ni SQL que correr.** El dato para
separar los tramos existe desde siempre; la pantalla de estadísticas nunca lo
miró. Si algo sale mal, se revierte el código y todo queda como hoy.

**Wiffleball entra gratis.** El hook no ramifica por deporte sino por familia
(`getSportCategory(tournament.sport) === "baseball"`), que ya agrupa béisbol,
softbol y wiffleball. Los tres se arreglan de una.

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

**Ojo con los DOS umbrales.** Hay dos, no uno, y los dos se alimentan del
conteo de partidos — así que los dos hay que recortarlos al tramo:

- **`teamGames` (línea ~280)** → umbral de bateo, estilo MLB: `QUALIFY_RATE`
  = 2,7 apariciones al plato por partido del equipo. Su comentario dice
  explícitamente que cuenta "todo el torneo, incluye grupos + playoffs".
- **`playerGames` (línea ~277)** → umbral defensivo: `DEFENSE_QUALIFY_PCT`
  = 0,6, o sea participar en el 60% de los partidos del equipo.

Si cualquiera de los dos sigue contando el torneo entero, en postemporada la
tabla sale **vacía**: con 3 juegos de playoffs, exigir apariciones de
temporada completa no lo cumple nadie.

**Decisión del dueño (2026-08-28): se mantiene el mismo criterio, contado
sobre los partidos del tramo.** No se elimina el umbral en postemporada.

Se evaluó la alternativa —postemporada sin umbral, que salgan todos— y se
descartó: **el campeón de bateo podía terminar siendo alguien que fue 1 de 1**,
y estos rankings se premian. Con el criterio proporcional el mínimo baja solo
(3 juegos × 2,7 ≈ 8 apariciones): un titular califica, el suplente con dos
turnos no.

Efecto secundario aceptado: **al arrancar la postemporada los números bailan.**
Con 1 juego jugado el mínimo son ~3 turnos, así que un 2 de 3 puede liderar en
.667. Es lo mismo que pasa en las Grandes Ligas la primera semana de playoffs y
se acomoda solo. Para que no se discuta, **mostrar la columna de turnos al bate
al lado del promedio** mientras el tramo esté en curso.

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
- El PDF de estadísticas — hereda el filtro solo, porque lee del mismo hook.
  Lo único que se le agregó es `segmentLabel` en el subtítulo: las cifras ya
  venían bien, pero el papel salía titulado igual que el del torneo completo.

---

## Decisiones tomadas

| Pregunta | Decisión | Por qué |
|---|---|---|
| ¿Hay pestaña "Total"? | **No** | Mezclar los dos tramos es justo lo que el organizador no quiere. Si alguien la pide después, agregarla es trivial. |
| ¿Qué se ve al abrir? | El tramo **en curso** | |
| ¿Y los torneos sin fase 2? | Grupos = regular, playoffs = post | Funciona igual y le sirve a muchos más torneos |
| ¿Y los de pura eliminación? | Sin selector | No hay nada que separar |
| ¿Umbral en postemporada? | **El mismo, sobre los partidos del tramo** | Sin umbral, el campeón de bateo puede ser un 1 de 1 — y esto se premia |
| ¿Hay que tocar la base? | **No** | Los 53 grupos ya tienen su fase; ningún partido de grupo está huérfano |
| ¿Y wiffleball? | Entra solo | El hook ramifica por familia, no por deporte |
| ¿El selector sale en TODOS los deportes? | **No: sólo béisbol/softbol/wiffleball** | "La fase 2 arranca en cero" es convención de béisbol. Al 2026-08-28 hay 2 torneos de volley y 1 de fútbol con fase 2 en curso que habrían visto sus stats partidas sin pedirlo. Se saca una condición el día que alguien lo pida. |
| ¿Cómo se elige la pestaña inicial? | El tramo en curso, salvo que el usuario elija | No se puede fijar en el `useState` inicial: los partidos llegan en una segunda carga y la pestaña quedaría clavada en "regular" |
| ¿Y si la postemporada no tiene datos? | **No se muestra el selector**; la pantalla queda como hoy | Un botón que lleva a una tabla vacía es peor que no tener botón |

---

## Lo que falta preguntarles a los organizadores

**Sigue abierta al 2026-08-28** — se resuelve en la llamada pendiente con el
organizador, y si la respuesta es sí se suma en la misma pasada en vez de
volver a abrir el hook.

**¿Quieren premiar aparte al mejor bateador de cada tramo?**

Si la respuesta es sí, probablemente también necesiten que **la tabla de
posiciones** respete la misma división, no sólo las estadísticas de jugador.
Vale la pena confirmarlo antes de construir, para no hacer el trabajo dos
veces.

---

## Antes de publicar: avisarle al organizador

Los **6 torneos con fase 2 están en curso**. El día que esto salga, sus
estadísticas aparecen partidas en dos sin previo aviso, y lo de la fase regular
se mueve a la otra pestaña. No se pierde nada, pero **si el organizador abre la
app sin saberlo va a pensar que se le borraron los números**. Un mensaje corto
antes del despliegue evita el susto y el ticket.

---

## Esfuerzo

**Medio día.** No es un cambio de arquitectura: es un filtro que hoy no
existe, más un selector. Lo mecánico es el hook; lo delicado son los dos
`ojo` de arriba (la fase que vive en el grupo, y el umbral de calificación).

---

## Lo que quedó implementado (2026-08-28)

| Archivo | Qué cambió |
|---|---|
| `src/hooks/use-tournament-stats.ts` | Tipo `StatsSegment`, helpers `hasPostseason` / `currentSegment`, recorte del tramo una sola vez arriba y los cuatro bucles trabajando sobre `matches` (nunca más `tournament.matches`). `tournament.groups` y `segment` agregados a las dependencias. |
| `src/components/standings/tournament-stats.tsx` | Selector de dos pestañas, visible sólo en la familia del béisbol y sólo si hay postemporada real. Cambiar de tramo resetea los "Ver más". El estado vacío **conserva las pestañas** — si no, el organizador quedaba encerrado en un tramo vacío sin forma de volver. El selector se calcula con una segunda llamada al hook sobre el tramo de postemporada. |
| `src/lib/stats-pdf.ts` | Opción `segmentLabel` en el subtítulo del PDF. |

Sin cambios en la base de datos y sin SQL para correr.

**Verificado contra producción:** el corte parte *El Primer Home Run III* en
**76 partidos de temporada regular y 26 de postemporada**. Es el único torneo
que hoy llegó a la fase 2; los otros cinco con fase 2 configurada todavía no
jugaron nada de postemporada, así que abren en "Temporada regular" como
corresponde.

### El selector sólo aparece si la postemporada tiene algo que mostrar

**Decisión del dueño (2026-08-28), tomada al ver el primer caso real.**

No alcanza con "el torneo tiene postemporada". El botón se muestra únicamente
cuando ese tramo tiene datos visibles. Si no hay partidos jugados, o el
organizador jugó la postemporada sin cargarle estadísticas, **la pantalla queda
exactamente como está hoy**: sin pestañas, con todo junto. Nadie ve un botón
que lleva a una tabla vacía.

Lo que cuenta como "hay algo que mostrar":

- un leaderboard de los que la pantalla dibuja, con al menos una fila, **o**
- una sanción visible, **o**
- la tabla de bateo, **o** la de defensa.

⚠️ **Trampa que costó un segundo intento.** El `hasStats` que devuelve el hook
incluye el leaderboard de **expulsiones**, que la pantalla no dibuja: las
expulsiones van a la tabla de Sanciones, y al público le esconde las que ya
están pagadas. Usar `hasStats` a secas abría la pestaña en una postemporada
cuya única expulsión estaba pagada — el organizador la veía con datos y el
visitante la veía vacía. Por eso el chequeo excluye los tipos de tarjeta
(`CARD_STAT_KEYS`) y cuenta las sanciones aparte, ya filtradas por
visibilidad.

**Caso real que lo motivó (producción, 2026-08-28):** la postemporada de *El
Primer Home Run III* tiene **26 partidos jugados y un solo evento cargado: una
expulsión**, sin pagar. Cero bateo, cero defensa. Con esta regla el selector sí
aparece —hay una sanción visible—, la pestaña muestra Sanciones con esa
expulsión y las tablas de bateo y defensa simplemente no se dibujan.

**Consecuencia buena:** la pantalla vacía de postemporada dejó de ser
alcanzable, así que no hizo falta inventarle mensajes distintos. El estado
vacío volvió a su texto de siempre; lo único que conserva es el selector, para
poder volver al otro tramo.

**Detalle que evitó un falso positivo:** `hasPostseason` no puede limitarse a
"existe un partido de playoff". La app crea la llave vacía (semifinales +
final, sin equipos) apenas se arma el torneo — al 2026-08-28 los 7 torneos de
béisbol/softbol tienen 3 partidos de llave y **ninguno con equipos asignados**.
Ese chequeo habría dado verdadero en todos y dejado una pestaña siempre vacía.
