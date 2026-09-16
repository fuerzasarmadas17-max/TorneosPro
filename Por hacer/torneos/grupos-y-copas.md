# Torneo con varias copas — grupos y después Oro, Plata, Bronce…

**Estado:** diseño hablado con el dueño el **2026-09-16**. **Nada construido.**
**Origen:** pedido por el dueño el 2026-09-06. Hay ligas que corren un solo
torneo donde después de los grupos todos siguen jugando, repartidos en varias
eliminaciones directas por nivel. Hoy ese torneo no se puede armar en la
plataforma.

---

## 0. Si estás retomando esto: leé solo esta sección

**Dónde íbamos:** se habló el formato entero y **el dueño ya contestó casi todo**.
No se escribió una línea de código. Lo que falta antes de empezar está en la
sección 7, y son dos cosas chicas.

**Lo que hay que construir, en una frase:** un torneo donde, después de los
grupos, en vez de una sola llave se arman **hasta 6 llaves en paralelo**, y cada
una se alimenta de ciertos puestos de los grupos (1º y 2º a la Oro, 3º y 4º a la
Plata, etc.).

**La idea que lo hace barato:** una copa es **una llave con nombre**. El armador
de llaves, los byes, el avance automático del ganador y el reparto de cupos por
grupo **ya existen y funcionan**. No hay motor nuevo.

**Dónde está el trabajo de verdad:** en que todo el sistema hoy asume que hay
**un solo campeón**. Ver sección 5.

**Por dónde empezar:** la tabla de copas y la columna en los partidos (5.1). Es
de donde cuelga todo lo demás y no rompe nada de lo que ya anda.

---

## 1. Qué es el formato

Un torneo, una fase de grupos, y después varias eliminaciones directas en
paralelo alimentadas por **bloques de puestos**:

| Puestos en su grupo | Copa |
|---|---|
| 1º y 2º de cada grupo | Copa Oro |
| 3º y 4º | Copa Plata |
| 5º y 6º | Copa Bronce |
| 7º y 8º | Copa Estaño |

Con 4 grupos de 8 eso son 4 copas de 8 equipos, todas dentro del mismo torneo.

**La gracia:** nadie se va a su casa después de los grupos. El que salió último
de su grupo sigue jugando una copa que puede ganar.

**Pero no es obligatorio que todos sigan.** El dueño dio este otro caso: grupos
de 8 donde **solo clasifican los 6 primeros** a 3 copas, y el 7º y el 8º se van.
Los dos casos se resuelven con la misma regla, ver 4.2.

---

## 2. Lo que ya está construido y se reusa

| Pieza | Dónde | Qué hace |
|---|---|---|
| Grupos con varias fases | `tournament_groups.phase`, `PhaseConfig` | Un torneo puede tener fase 1, fase 2… |
| Cuántos pasan por grupo | `20260602_per_group_advancement.sql`, `PlayoffConfig.perGroup` | Cupos por grupo, incluso desparejos |
| Armador de llaves | `bracket-matchup-builder.tsx` | El organizador arma los cruces a mano, y **ya resuelve los byes** |
| Estado del bracket | `20260606_playoff_bracket_state.sql`, `use-bracket.ts` | Rondas encadenadas con `next_match_id` |
| Avance automático | `src/lib/admin/auto-advance.ts` | El ganador sube solo a la ronda siguiente |
| Stats por tramo | `use-tournament-stats.ts` | Ya separa temporada regular de postemporada |

**Verificado el 2026-09-16:** de copas no existe nada — ni tabla, ni columna, ni
pantalla. Y los 17 archivos que mencionan `"playoff"` siguen siendo 17.

---

## 3. Lo que decidió el dueño el 2026-09-16

| Pregunta | Respuesta |
|---|---|
| ¿Cuántas copas como máximo? | **6** |
| ¿Cuántos grupos como máximo? | **Sin máximo** |
| ¿Las copas son una fase nueva? | **No. Son playoffs**, nada más que varias llaves en paralelo |
| ¿Cuentan como postemporada en las stats? | **Sí**, por lo de arriba. No se hace nada especial |
| ¿Grupos parejos obligatorios? | **No** |
| ¿Tercer puesto? | **Por copa.** Que una lo tenga no obliga a las demás |
| ¿Filtrar por copa? | **Sí, en la vista de playoffs.** En el calendario no hace falta |
| ¿Quién les pone el nombre? | **El organizador**, igual que a los grupos |
| ¿El precio cambia? | **Sí**, ver sección 6 |

---

## 4. Cómo se arma

### 4.1 A qué copa pertenece cada partido

Tabla `tournament_cups` (torneo, nombre, orden, de qué puestos se alimenta) y una
columna `cup_id` en `matches`. **Es la parte fácil y de la que cuelga todo lo
demás.**

Un partido sigue siendo `grupo` o `playoff` como hoy: **no se inventa una fase
nueva.** Eso es lo que hace que todo lo que ya dice "postemporada" siga
funcionando sin tocarse.

### 4.2 El reparto por puestos — una sola regla

> **Cada copa dice de qué puestos se alimenta. El puesto que no reclama ninguna
> copa, se va a casa.**

Con esa sola regla salen los dos casos del dueño:

- **Todos siguen:** Oro ← 1-2, Plata ← 3-4, Bronce ← 5-6, Estaño ← 7-8.
- **Solo pasan 6:** Oro ← 1-2, Plata ← 3-4, Bronce ← 5-6. El 7º y el 8º no los
  reclama nadie, así que se van.

Los puestos ya se calculan —la tabla de posiciones existe y desempata—; lo que
falta es el mapa puesto → copa.

### 4.3 Grupos desparejos: se puede, pero hay que avisar

Si un grupo tiene 8 y otro 5, la Copa Bronce (5º y 6º) recibe dos equipos de uno
y uno del otro: queda coja y con byes. El armador de llaves **ya sabe manejar
byes**, así que no se rompe.

Pero hay que **mostrárselo al organizador ANTES de generar**, no después:

> *"La Copa Bronce va a quedar con 5 equipos y 3 descansos en la primera ronda.
> ¿Así está bien?"*

### 4.4 Generar N llaves en vez de una

Correr el generador que ya existe, una vez por copa. Cada copa arma sus cruces
con el armador actual.

### 4.5 Las pantallas

- **Playoffs:** pestañas por copa. Es la pantalla donde importa.
- **Calendario y resultados:** el dueño dijo que no hace falta filtrar, y para el
  organizador es cierto. **Pero sí conviene la etiqueta** con el nombre de la copa
  al lado del partido — sin filtros ni pestañas. Si no, el espectador ve que se
  jugó "la Final" y no sabe de cuál de las seis. Es media hora de trabajo.

---

## 5. El campeón y el MVP por copa

Fue la pregunta directa del dueño: *"¿o sea mostraríamos el MVP, el campeón de
cada copa? ¿cómo lo hacemos?"*

### 5.1 Lo que se descubrió mirando el código

**El MVP del torneo no se calcula.** Son cuatro casilleros pegados al torneo
—`mvp_photo_url`, `mvp_player_id`, `mvp_player_name`, `mvp_team_id`— que **el
organizador llena a mano** desde un modal cuando el torneo termina. La foto del
campeón (`champion_photo_url`) es otro casillero igual.

O sea que el "un solo campeón" no es solo una función: **es la forma de la
tabla.** Hay exactamente un juego de casilleros.

**Por eso son dos cosas muy distintas de construir, y conviene separarlas.**

### 5.2 El campeón por copa: casi gratis, va en la v1

El campeón **sí se calcula**: sale de la llave. `getFinalSeriesChampion`
(`src/data/helpers.ts:14`) agarra todos los partidos de playoff, busca la ronda
más alta y dice quién ganó.

Con copas es **la misma función con un filtro más**: "de esta copa". Chico de
verdad.

Y alcanza para mostrar el campeón de cada copa **en la llave, en la página del
torneo y en la tarjeta**, con su nombre y su escudo. **Ahí está casi todo el
sentimiento del formato** — que el campeón de la Plata también sea campeón de
algo.

### 5.3 La foto y el MVP por copa: para después

Para que la Copa Plata tenga su foto y su MVP, esos cuatro casilleros tienen que
**mudarse del torneo a la copa**. El modal que ya existe funcionaría igual, solo
guardando en otro lado.

**No es difícil, pero se deja para después por dos razones:**

1. Detrás de la foto hay más de lo que parece: subirla, recortarla en 3:4,
   guardarla, y el modal que se le muestra al público. Multiplicar eso por 6
   copas multiplica por 6 los lugares donde se puede romper.
2. En la práctica el organizador va a hacer **una sola sesión de fotos**. Pedirle
   seis es pedirle algo que no va a hacer.

**Y es reversible y barato:** como el MVP son cuatro casilleros y nada más,
extenderlo después es **agregarle cuatro columnas a la tabla de copas**. No hay
que rediseñar nada.

**Cuidado con la compatibilidad:** los torneos que ya existen tienen el MVP
pegado al torneo. Un torneo sin copas sigue usando el casillero del torneo; uno
con copas usa el de la copa. Dos caminos, pero **cero riesgo de migración**.

### 5.4 El resumen

| | v1 | Después, si lo piden |
|---|---|---|
| Campeón visible (nombre + escudo) | **Las 6 copas** | — |
| Modal de "¡Tenemos campeón!" | Solo la principal | Las demás |
| Foto del campeón | Solo la principal | Las demás |
| MVP | Solo la principal | Las demás |

### 5.5 🔴 El detalle que se va a olvidar

Hay un lugar donde `getFinalSeriesChampion` decide **si el torneo terminó**
(`src/lib/admin/server-advance.ts:180`).

Con copas, el torneo **no termina cuando se juega una final: termina cuando las
seis tienen campeón.** Es un cambio chico, pero si se olvida, el torneo se cierra
solo con tres copas a medio jugar. No es un detalle de pantalla: es el estado del
torneo.

---

## 6. El precio

El dueño pidió precio dinámico: *"no solo por número de equipos sino la
complejidad de llevar todo, no súper caro pero algo extra"*.

### 6.1 No cobrar por copa

Suena lógico —más copas, más caro— **pero juega en contra**. Más copas son más
partidos, más equipos jugando más tiempo, más gente entrando a mirar. Y más gente
entrando son **más personas-día**, que es de donde sale la plata de la publicidad
(`como-funciona-el-reparto.md`).

Si se cobra por copa, el organizador va a poner tres en vez de cuatro para
ahorrarse unos pesos, y se pierde un mes de un torneo activo. **Sería cobrar por
justo lo que más conviene que pase.**

### 6.2 Cobrar por el formato, una sola vez, en porcentaje

Un recargo **por usar el formato de varias copas**, sin importar si son dos o
seis. Y en porcentaje, no en plata fija:

| | |
|---|---|
| **Por qué porcentaje** | Se acomoda solo: un torneo de 32 equipos paga más que uno de 12 sin tener que pensarlo |
| **Por qué no plata fija** | El día que suban los precios de los paquetes hay que acordarse de subir este también, y nadie se va a acordar |
| **Cuánto** | **15%.** Sobre Premium ($130.000) son unos $19.500: se nota, no espanta |

Los paquetes hoy cobran por cantidad de equipos (`src/lib/pricing.ts`): basico
1-8, … premium 25+. Un torneo de 4 grupos de 8 son 32 equipos, o sea **que ya cae
en Premium** sin tocar nada. El recargo va encima de eso.

### 6.3 Una nota para el dueño

Este es **el primer formato que un organizador no puede correr en ningún otro
lado**. Hasta hoy se vende por tamaño; acá se podría vender por lo que el torneo
*vale*. No hay que cobrarlo caro —el dueño dijo que no— pero **es la primera vez
que existe esa carta**, y conviene saber que existe.

---

## 7. Lo único que falta decidir

**a) Qué pasa si un equipo se retira o lo descalifican.** El dueño dijo *"uno
avanzaría directo, o avanzaría de pronto"* y quedó pensándolo. Son dos momentos
distintos:

1. **Se retira entre los grupos y la copa**, sin haber jugado ningún partido de
   copa. Acá se podría correr a todos un puesto: si se va el 3º, el 4º sube a la
   Plata y el 5º toma el lugar del 4º. Queda todo parejo.
2. **Se retira con la copa ya empezada.** Acá no se puede reacomodar nada, y lo
   natural es lo que la plataforma ya hace: **el rival avanza por W**.

**Recomendación:** hacer el 2 siempre, y el 1 **solo si resulta fácil** — correr
los puestos suena simple pero puede desarmar una llave que el organizador ya armó
a mano.

**b) El nombre por defecto de las copas.** "Oro / Plata / Bronce" como sugerencia
al crear, y nada más. En una liga pueden ser "Copa Presidente" y "Copa Amistad".

---

## 8. Cuánto es

| Parte | Peso |
|---|---|
| Tabla de copas + `cup_id` en los partidos | 1 – 2 días |
| Reparto por bloques de puestos | 2 – 3 días |
| Generar una llave por copa | 2 días |
| Pestañas por copa en playoffs + etiqueta en resultados | 3 – 4 días |
| Campeón de cada copa visible (5.2) + el arreglo de 5.5 | 1 – 2 días |
| Recargo del 15% en el precio | medio día |
| **Versión útil** | **≈ 2 semanas y media** |
| Foto y MVP por copa (5.3) | 3 – 4 días |
| Wizard de creación: nombres de copas y cupos, con validación | 3 – 4 días |
| **Total completo** | **≈ 4 semanas** |

---

## 9. Ojo con esto: el marcador en vivo

Cuando se construya el marcador en vivo (`PLANILLA-EN-VIVO-PUBLICO.md`), **el
dato que manda la planilla tiene que decir de qué copa es cada partido.** Si no,
la vista de "Hoy" va a mostrar *"Final · Cancha 2"* sin decir de cuál de las
seis.

Lo pidió el dueño y **hoy es gratis acordarse**, porque esa parte todavía no está
construida. Anotado en los dos documentos.
