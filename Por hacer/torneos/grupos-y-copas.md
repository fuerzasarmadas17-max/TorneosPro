# Torneo con varias copas — grupos y después Oro, Plata, Bronce…

**Estado:** **construido (2026-09-18), sin desplegar**, con la opción en el
wizard y el recargo del 15%. Los dos SQL ya corrieron en producción. Falta
terminar de probarlo y desplegar (ver 0).
**Origen:** pedido por el dueño el 2026-09-06. Hay ligas que corren un solo
torneo donde después de los grupos todos siguen jugando, repartidos en varias
eliminaciones directas por nivel. Hoy ese torneo no se puede armar en la
plataforma.

---

## 0. Si estás retomando esto: leé solo esta sección

**Dónde íbamos (2026-09-18):** la versión útil está escrita y compila, **sin
desplegar**. La lógica (campeón por copa, que el torneo termine cuando TODAS
tienen campeón, el reparto por puestos, descalificados afuera, el formato de la
final compartido) se probó con un torneo inventado; **las pantallas no se
probaron con clics**, porque probarlas escribe en la base de producción.

**Cómo se prende hoy (sin wizard):** en la pestaña **Playoffs** de un torneo de
grupos + playoffs de una sola fase, mientras nadie haya puesto equipos en la
llave, aparece "Jugar con varias copas". Ahí se eligen 2 o 3 copas, sus nombres
y de qué puestos sale cada una, con el aviso de cuántos equipos y descansos va a
tener cada copa. Después, una pestaña por copa: cada una arma sus cruces, y el
fixture se genera para todas juntas. La primera copa que llega a la final elige
el formato de todas; a las demás se les arma la final con ese formato.

**Lo que falta, en orden:**
1. **El recargo del 15% ya está construido** (ver 6.4): se cobra con la regla
   del bono, y con crédito del paquete va incluido. Su SQL
   (`aplicadas/20260918_copas_recargo.sql`) corrió el 2026-09-18.
2. Desplegar y probar con un torneo real (armar copas, cruces, jugar una final).
3. La foto/MVP por copa (cuando lo pidan). El wizard ya tiene la opción
   "Grupos + múltiples copas" (2026-09-18).

**Dónde está el código:** `src/lib/copas.ts` (reparto, validación, vista de una
copa), `src/data/helpers.ts` (campeón y final por copa, `isBracketFinished`),
`src/components/brackets/cups-view.tsx` (las pestañas),
`src/components/tournaments/cups-config-dialog.tsx` (armar las copas), y en
`tournament-context.tsx` las acciones reciben la copa (`configureCups`,
`createPlayoffBracket`, `configurePlayoffFinal`).

**Lo que hay que construir, en una frase:** un torneo donde, después de los
grupos, en vez de una sola llave se arman **hasta 3 llaves en paralelo** (para
empezar; el diseño aguanta 6), y cada
una se alimenta de ciertos puestos de los grupos (1º y 2º a la Oro, 3º y 4º a la
Plata, etc.).

**La idea que lo hace barato:** una copa es **una llave con nombre**. El armador
de llaves, los byes, el avance automático del ganador y el reparto de cupos por
grupo **ya existen y funcionan**. No hay motor nuevo.

**Dónde está el trabajo de verdad:** en que todo el sistema hoy asume que hay
**un solo campeón**. Ver sección 5.

**Por dónde empezar:** la tabla de copas y la columna en los partidos (4.1). Es
de donde cuelga todo lo demás y no rompe nada de lo que ya anda. **El SQL ya
corrió en producción** (2026-09-18), vive en
`supabase/migrations/aplicadas/20260917_copas.sql`. Lo siguiente es código.

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

**Para empezar el tope es 3 copas** (sección 3), así que el ejemplo de arriba con
Estaño todavía no se podría armar: con 3, el caso es el de "solo pasan 6".

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

## 3. Lo que decidió el dueño (2026-09-16 y 2026-09-17)

| Pregunta | Respuesta |
|---|---|
| ¿Cuántas copas como máximo? | **3 para empezar**, "como para probar" (cambió el 2026-09-16; antes se había dicho 6). El diseño no cambia: el tope es un número y subirlo a 6 es cambiar ese número |
| ¿Cuántos grupos como máximo? | **8**, el tope que ya tiene el formulario. No se toca (2026-09-17) |
| ¿Las copas son una fase nueva? | **No. Son playoffs**, nada más que varias llaves en paralelo |
| ¿Cuentan como postemporada en las stats? | **Sí**, por lo de arriba. No se hace nada especial |
| ¿Grupos parejos obligatorios? | **No** |
| ¿Tercer puesto? | **No va en la v1** (2026-09-17). Hoy no existe en ningún torneo de la plataforma; cuando se haga, se hace para todos los torneos, no solo para las copas |
| ¿Copas después de **dos fases** de grupos? | **No en la v1** (2026-09-17). Solo grupos → copas |
| ¿El **formato de la final** es por copa? | **No: uno solo para todas las copas** (2026-09-17), elegido una vez, como hoy (`playoffFinalFormat`) |
| ¿Los **sets** (mejor de 3 o de 5) cambian por copa? | **No: iguales para todo el torneo** (2026-09-17), como hoy (`bestOf`) |
| ¿Filtrar por copa? | **Sí, en la vista de playoffs.** En el calendario no hace falta |
| ¿Quién les pone el nombre? | **El organizador**, igual que a los grupos, **con nombres por defecto** (7b) |
| ¿Y si un equipo se retira? | Copa empezada: **W al rival**. Antes: **no entra a ninguna copa y su rival pasa directo** (7a) |
| ¿El precio cambia? | **Sí**, ver sección 6 |
| ¿Foto del campeón y MVP en todas las copas? | **No en la v1** (2026-09-18). Solo la copa principal. **Se puede agregar después sin rehacer nada** (3 – 4 días, ver 5.3): se hace cuando un organizador lo pida |

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
  jugó "la Final" y no sabe de cuál copa. Es media hora de trabajo.

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
   guardarla, y el modal que se le muestra al público. Multiplicar eso por cada
   copa multiplica los lugares donde se puede romper.
2. En la práctica el organizador va a hacer **una sola sesión de fotos**. Pedirle
   una por copa es pedirle algo que no va a hacer.

**Y es reversible y barato:** como el MVP son cuatro casilleros y nada más,
extenderlo después es **agregarle cuatro columnas a la tabla de copas**. No hay
que rediseñar nada.

**Cuidado con la compatibilidad:** los torneos que ya existen tienen el MVP
pegado al torneo. Un torneo sin copas sigue usando el casillero del torneo; uno
con copas usa el de la copa. Dos caminos, pero **cero riesgo de migración**.

### 5.4 El resumen

| | v1 | Después, si lo piden |
|---|---|---|
| Campeón visible (nombre + escudo) | **Todas las copas** | — |
| Modal de "¡Tenemos campeón!" | Solo la principal | Las demás |
| Foto del campeón | Solo la principal | Las demás |
| MVP | Solo la principal | Las demás |

### 5.5 🔴 El detalle que se va a olvidar

Hay un lugar donde `getFinalSeriesChampion` decide **si el torneo terminó**
(`src/lib/admin/server-advance.ts:180`).

Con copas, el torneo **no termina cuando se juega una final: termina cuando las
todas tienen campeón.** Es un cambio chico, pero si se olvida, el torneo se cierra
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
tres (o seis, si algún día se sube el tope). Y en porcentaje, no en plata fija:

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

### 6.4 Cómo quedó construido y el paquete de torneos (2026-09-18)

**El recargo es del 15% del precio de lista y se cobra una sola vez por torneo**
(columna `tournaments.cups_surcharge_paid`, SQL `20260918_copas_recargo.sql`).
Con el bono del torneo se hace lo mismo que en las ampliaciones de equipos: un
50% también descuenta el recargo; con un 100% no se cobra, pero el precio del
torneo lo incluye, así que si el torneo está fiado contra publicidad la deuda
sube sola. Se cobra al crear ("Grupos + múltiples copas", va dentro del precio)
o al prender las copas después desde Playoffs (pago aparte por Wompi).

**Con un crédito del paquete de 5 torneos, las copas van incluidas: no se cobra
el recargo.** Decisión del dueño, 2026-09-18. Por qué:

- Lo que se deja de cobrar tiene techo: 15% del crédito ($9.600 por torneo),
  $48.000 por paquete en el peor caso (los 5 con copas). Es proporcional a lo
  vendido, no crece más rápido.
- El crédito cubre hasta 24 equipos: los torneos de copas grandes (4 grupos de
  8 = 32) no pueden usarlo y pagan lista + 15%.
- Cobrar $9.600 aparte obliga a un segundo pago en medio de la creación, y el
  paquete ya es el producto que más se cae. En cambio "incluye copas" lo ayuda a
  vender (va escrito en el banner del paquete).
- Las copas suelen ser torneos de fin de semana o de una semana: gastan un
  crédito rápido, así que el organizador vuelve a comprar antes.

**Cuándo revisarlo:** si más de la mitad de los créditos consumidos son de
torneos con copas, el regalo pasó a ser un descuento permanente. Ahí se decide
entre subir un poco el paquete o cobrar el recargo aparte. También al subir el
tope de 3 copas.

---

## 7. Lo que se decidió al final (2026-09-16)

### 7a) Si un equipo se retira, lo descalifican o lo eliminan

**Con la copa ya empezada:** se le da **W al rival**, que pasa directo. Es lo que
la plataforma ya hace: descalificar da por perdidos todos los partidos sin jugar
del equipo y sube al ganador a la ronda siguiente (`disqualifyTeam`, en
`src/context/tournament-context.tsx`).

**Antes de que empiece la copa** (aclarado por el dueño el 2026-09-16), la regla
es una sola:

> **Un equipo descalificado o eliminado no entra a ninguna copa. El lugar que
> habría ocupado en la llave queda vacío, y el rival que le tocaba pasa directo a
> la ronda siguiente, a la espera del ganador de la otra llave.**

Es un **descanso** (bye), y el armador de llaves ya los sabe manejar. No hace
falta inventar un partido con W.

Descalificar y eliminar llegan al mismo lugar por caminos distintos:

| | Qué pasa en la tabla del grupo | Qué pasa con las copas |
|---|---|---|
| **Descalificar** | Queda al fondo, último | No clasifica. Como estaba último, nadie cambia de puesto |
| **Eliminar** | Desaparece, como si nunca hubiera existido. Los de abajo suben un puesto | No clasifica. Los puestos ya se recalcularon sin él |

En los dos casos la copa que recibe el último puesto queda con un equipo menos, y
a quien le tocaba enfrentarlo pasa directo.

**Qué hay que construir para esto:**

1. **Al repartir los puestos en copas, saltar a los descalificados.** Los
   eliminados ya no aparecen en la tabla, así que salen solos.
2. **El aviso de antes de generar (4.3) los cuenta:** *"La Copa Bronce va a
   quedar con 5 equipos: Halcones está descalificado."*
3. **Si se descalifica con las llaves ya creadas** (decisión del dueño,
   2026-09-16): **no se agrega ninguna lógica nueva.** El partido se resuelve
   con un W, como cualquier otro. Hoy eso ya pasa de dos formas, sin tocar nada:
   al descalificar, la plataforma da W al rival en todos los partidos sin jugar
   y lo sube a la ronda siguiente; y si hiciera falta a mano, el organizador y el
   planillero ya tienen el botón de W al cargar el resultado.

### 7b) Los nombres por defecto

Al crear, las copas vienen con nombre puesto, en orden: **Copa Oro, Copa Plata,
Copa Bronce** (y si algún día se sube el tope: Estaño, Hierro, Madera). El
organizador los cambia si quiere; en una liga pueden ser "Copa Presidente" y
"Copa Amistad".

---

## 8. Cuánto es

| Parte | Peso |
|---|---|
| Tabla de copas + `cup_id` en los partidos | 1 – 2 días |
| Descalificados y eliminados fuera de las copas (7a) | medio día |
| Reparto por bloques de puestos | 2 – 3 días |
| Generar una llave por copa | 2 días |
| Pestañas por copa en playoffs + etiqueta en resultados | 3 – 4 días |
| Campeón de cada copa visible (5.2) + el arreglo de 5.5 | 1 – 2 días |
| Recargo del 15% en el precio | medio día |
| **Versión útil** | **≈ 2 semanas y media** |
| Foto y MVP por copa (5.3) — **fuera de la v1 por decisión del dueño (2026-09-18); se hace cuando lo pidan** | 3 – 4 días |
| Wizard de creación: nombres de copas y cupos, con validación | 3 – 4 días |
| **Total completo** | **≈ 4 semanas** |

**Estos tiempos siguen valiendo después de las decisiones del 2026-09-17:** el
tercer puesto quedó fuera de la v1, así que no suma nada.

---

## 9. El marcador en vivo

Cuando se escribió esto, el en vivo no existía y se pidió que la planilla mandara
de qué copa es cada partido. **Ya no hace falta** (2026-09-16): el en vivo está
construido y la página arma cada tarjeta con los datos del partido que ya
tiene. Cuando exista `cup_id`, alcanza con mostrar el nombre de la copa en la
tarjeta de `src/components/tournaments/en-vivo-hoja.tsx`. La planilla no se toca.

