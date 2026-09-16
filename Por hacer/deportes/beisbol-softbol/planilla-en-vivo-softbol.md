# Planilla en vivo de softbol — jugada por jugada, no lanzamiento por lanzamiento

**Estado:** diseño cerrado con el dueño el **2026-09-16**. **Nada construido.**
No queda nada por decidir para empezar.
**Maquetas:** `planilla-softbol-propuestas/` (el `LEEME.md` explica cada una).
**Origen:** pedido del dueño el 2026-09-16. La planilla de vóley
(`../voley/planilla-en-vivo-volley.md`) resultó, y la idea es hacer lo mismo
para el softbol y después el béisbol.

**Alcance de la primera versión: softbol bola lenta.** Decisión del dueño. El
lanzamiento rápido tiene jugadas que el lento no (sección 8) y va después,
encima de esta misma base. El béisbol, más adelante (sección 9).

---

## 0. Para retomar esto sin releer todo

- La mesa anota **qué pasó en cada turno al bate** (hit, "out 6-3", "fly al 8",
  ponche, base por bolas…), **no** cada bola y cada strike.
- De esa lista de jugadas **salen solas** las estadísticas que hoy se llenan a
  mano después del juego: turnos, hits, carreras, impulsadas, outs, asistencias
  y errores.
- Hace falta el **lineup antes del partido**, con los suplentes, y los
  **cambios** durante el juego, que se pueden hacer justo cuando le toca batear
  a alguien.
- A diferencia de vóley, **los jugadores son los de la nómina**. Si llega uno
  que no está, se agrega desde la planilla y **queda inscrito en el equipo**.
- Hay **historial de jugadas por entrada** y **Deshacer**, igual que en vóley.
- Todo se guarda en el teléfono y se manda al terminar, como en vóley.
- **Fuera de la primera versión:** estadísticas de pitcher (en las dos
  modalidades), nocaut y lanzamiento rápido.

---

## 1. La conclusión, arriba

**Se puede, y el grueso de lo que hay alrededor ya existe.** El link de la
mesa, la cola que manda el resultado cuando vuelve la señal, la tabla de
estadísticas, los líderes y la separación temporada regular / postemporada ya
están hechos y probados. Lo nuevo es la planilla misma.

**Es más trabajo que la de vóley.** En vóley el estado del partido es un
marcador y seis jugadores que giran. En softbol es: entrada, outs, quién está
en cada base, a quién le toca batear, quién juega cada posición y qué cambios
se hicieron. Y cada jugada reparte crédito entre varios jugadores (el que
bateó, el que fildeó, el que tiró a primera, el corredor que anotó).

**Estimado de la entrega 1: unas 2 semanas y media** (sección 7). Sacar el
pitcher y el nocaut de la primera versión le quitó unos días.

**La regla que decide todo, igual que en vóley:** lo que se guarda es **la
lista de jugadas**. El marcador, los outs, las bases, el turno al bate, el
historial y las estadísticas **se calculan** leyendo esa lista. Nada se lleva
en dos lugares, así que nada se puede desincronizar.

---

## 2. Lo que ya está construido

| Pieza | Dónde | Sirve para |
|---|---|---|
| **Link de planillero** | `src/app/score/[token]/page.tsx` | La mesa abre un link, sin cuenta. Igual que vóley |
| **Planilla de estadísticas a mano** | `src/components/forms/baseball-scoresheet.tsx`, `src/lib/baseball-scoresheet.ts` | La tabla jugador × estadística que se llena hoy después del juego. **Es lo que la planilla en vivo reemplaza**, pero se queda: sirve para corregir y para quien no la use |
| **Estadísticas guardadas** | tabla `match_events` | Una fila por cada hit, turno, out… con el jugador. **Ya tiene una columna `position`** que casi no se usa |
| **Identidad del jugador** | `match_events.player_id` | Las estadísticas se agrupan por jugador y no por cómo escribieron el nombre |
| **Líderes, PDF, temporada/postemporada, MVP** | `tournament-stats.tsx`, `stats-pdf.ts` | Leen `match_events`. Si la planilla termina escribiendo ahí mismo, **todo esto funciona sin tocarlo** |
| **Cola sin señal, guardado en el teléfono, interruptor, aplazar** | `src/lib/volley/` | Se reusan casi tal cual. Hoy dicen "volley" en el nombre; hay que sacarlos a un lugar común |

**La decisión que ahorra más trabajo:** al terminar el juego, la lista de
jugadas **se resume en las mismas filas de `match_events` que hoy se cargan a
mano**. Para el resto del sistema, un partido anotado en vivo se ve igual que
uno cargado al final.

---

## 3. Qué anota la mesa en cada turno

### 3.1 El resultado del turno

Un botón grande por grupo, y dentro las opciones. Los números son las
posiciones de siempre: 1 pitcher, 2 catcher, 3 primera, 4 segunda, 5 tercera,
6 short, 7 left, 8 center, 9 right, y **10 el short fielder**.

**El short fielder es "a veces"** (dueño, 2026-09-16): hay partidos de bola
lenta con diez en el campo y otros con nueve. Por eso no es una regla del
torneo sino un interruptor **en el lineup de cada partido**, "Juegan 10 en el
campo" (maqueta `1-lineup.png`). Si está apagado, la posición 10 no aparece.

| Grupo | Opciones en bola lenta | Cómo se anota |
|---|---|---|
| **Hit** | sencillo, doble, triple, jonrón | Un toque. Opcional: a qué zona (7, 8, 9…) |
| **Out bateando** | rolling (6-3, 4-3, 3 sin asistencia…), fly (F8), línea (L6), foul fly (F2) | Se tocan los fildeadores **en orden**: 6 y después 3 = "6-3" |
| **Ponche** | ponche | Un toque. El out va para el catcher, como en la planilla oficial |
| **Tercer strike no atrapado** | llegó a primera / lo sacaron en primera | El ponche cuenta igual para el bateador. **Sí existe en lento** (corrección del dueño, 2026-09-16) |
| **Se embasa sin hit** | base por bolas, error (E8), bola ocupada (BO) | Base por bolas: un toque. Error: se toca quién. Bola ocupada: se toca quién fildeó y a quién tiró, y en corredores cuál corredor fue out (3.4) |
| **Fly de sacrificio** | fly de sacrificio | Botón en "Más" + a dónde fue. La app ya pone "Anotó" al de 3.ª. **Se queda como botón** y además la app revisa (3.4) |
| **Doble play** | 6-4-3, 4-6-3, etc. | Como el rolling, y la app pregunta cuál corredor fue el otro out |

**No aparecen en bola lenta:** golpeado y toque de bola (sección 8).

**Un foul con dos strikes NO es out** (dueño, 2026-09-16). Como no se anotan
strikes ni fouls, para la planilla no existe: el turno sigue hasta que pase
algo.

**Se toca dónde, no se escribe la notación.** En fly, línea, rolling y error
aparece el campo con los nombres de los que están defendiendo, y la mesa toca
al jugador. La app arma "F8" o "6-3" y lo muestra para confirmar. Así lo anota
bien también quien no sabe la notación (maquetas `3-fly.png` y
`4-rolling.png`). En la pantalla del juego van en tres filas: hits en dorado,
outs en rojo, lo demás en blanco; el fly de sacrificio, el tercer strike no
atrapado y el doble play van en "Más" (`2-juego.png`).

**Lo que NO se anota en ninguna modalidad:** bolas, strikes, fouls, conteo,
lanzamientos. Pedido explícito del dueño.

### 3.2 Los corredores

Es la parte difícil, porque de acá salen las **carreras anotadas** y las
**impulsadas**.

**La app propone y la mesa corrige.** Después de cada jugada con gente en base,
la app mueve a los corredores como pasa casi siempre (en un sencillo todos
avanzan una; en una base por bolas solo avanzan los forzados) y muestra el
diamante con el resultado. Si pasó otra cosa —el de segunda anotó con el
sencillo— la mesa toca al corredor y lo pone donde llegó. Si nadie toca nada,
se acepta lo propuesto.

Si no había nadie en base, esta pantalla no aparece. La mayoría de los turnos
son un solo toque.

**Dos preguntas que aparecen debajo de un corredor**, solo cuando hacen falta.
Son lo que la app no puede adivinar y sin ellas se pierde una estadística:

- **Si se marca Out: "¿Quién lo sacó?"** Fila con las posiciones y el nombre
  de cada defensor; se tocan en orden el que tiró y el que tocó al corredor
  ("8-2"). Sin esto, el out y la asistencia no quedan para nadie. Maqueta
  `5-corredores-out-en-home.png`.
- **Si llegó más lejos de lo que la app propuso: "¿Por qué?"** Dos respuestas:
  "Por el tiro, sin error" o "Error de…" y se toca quién. Sin esto, el error del
  que tiró mal no queda anotado. Maqueta `5-corredores-error.png`.

**Entre turnos**, un botón "Corredores" en la pantalla principal abre:

- **Robo de base.** Hay robos en las dos modalidades (dueño, 2026-09-16).
- **Out robando.**
- **Avanza por error** (de quién).
- **Out por despegarse antes de tiempo.** En bola lenta el corredor tiene que
  estar pegado a la base; si sale antes, **el ampayer canta out directo**.
  **No se le anota a nadie** (dueño, 2026-09-16): suma un out al equipo y
  saca al corredor, sin out ni asistencia para ningún fildeador.

### 3.3 Qué calcula la app sola

La mesa nunca escribe un número de estas:

| Estadística | De dónde sale |
|---|---|
| **Turnos al bate (AB)** | Todo turno **menos** base por bolas, fly de sacrificio e interferencia |
| **Hits, 2B, 3B, HR** | El resultado del turno |
| **Carrera anotada (R)** | El corredor que cruza home |
| **Impulsada (RBI)** | Las carreras que entran por el turno del bateador, **salvo** en error y doble play (la regla oficial). La app la propone y la mesa puede quitarla |
| **Base por bolas, ponche** | El resultado del turno |
| **Out (PO) y asistencia (A)** | La notación: en "6-3", asistencia al short y out al de primera. En "F8", out al center |
| **Error (E)** | "E6" = error al short |
| **Robos** | El botón "Corredores" |
| **Outs, entrada, bases, marcador** | Contando la lista |
| **Carreras por entrada** (la pizarra) | Contando la lista |

**Estadísticas nuevas que salen gratis:** fly de sacrificio y robos. Hoy no se
llevan porque a mano eran columnas de más. Necesitan tipos nuevos en
`match_events` (el mismo cambio que ya describía `stats-beisbol-sf-hbp.md`).

### 3.4 Casos que hay que anotar bien

Hablados con el dueño el 2026-09-16. Son la prueba de que las pantallas
alcanzan.

**Fly al 8, el 8 tira a home y el corredor de 3.ª anota igual.** Fly → 8 →
en corredores, el de 3.ª en "Anotó" → Listo. Queda: fly de sacrificio para el
bateador (sin turno al bate, 1 impulsada), out para el 8, carrera para el
corredor. El tiro que no sacó a nadie no se anota.

**Fly al 8, tira a home y sacan al corredor.** Fly → 8 → en corredores, el de
3.ª en "Out" → "¿Quién lo sacó?" 8 y 2 → Listo. Queda: turno al bate sin
impulsada para el bateador, out y asistencia para el 8, out para el catcher, y
en el historial "doble play".

**Al 8 se le cae el fly.** Error → 8 ("E8"). Queda: turno al bate sin hit para
el bateador, error para el 8. Impulsada en cero por defecto; la mesa la suma
con "+" si la carrera entraba igual.

**Hit limpio y el 8 tira mal.** Sencillo → en corredores, el corredor o el
bateador un paso más lejos → "¿Por qué?" → "Error de…" → 8. Queda: el
sencillo sigue siendo sencillo (no se vuelve doble) y el error va para el 8.

**Bola ocupada.** El bateador se embasa porque la defensa prefirió sacar a otro
corredor (en inglés, *fielder's choice*). Ejemplo: corredor en 1.ª, rolling al
short, tira a 2.ª y saca al corredor; el bateador queda en 1.ª. Bola ocupada →
6 y 4 → en corredores, el de 1.ª en "Out" (ya viene propuesto con 6-4) → Listo.
Queda: turno al bate sin hit para el bateador, asistencia para el 6, out para
el 4. También es bola ocupada si la defensa intenta sacar al otro y no lo logra.

**Sacrificio: botón y revisión** (decisión del dueño, 2026-09-16). El botón
"Fly de sacrificio" se queda en "Más", porque los planilleros piensan en
"fue sacrificio". Y la app revisa las dos equivocaciones posibles:

- Anotaron **Fly** normal y el corredor anotó → se cuenta como sacrificio igual.
  Así el bateador no pierde promedio porque tocaron el botón equivocado.
- Anotaron **Sacrificio** y nadie anotó (por ejemplo, el corredor solo pasó de
  2.ª a 3.ª) → avisa "Nadie anotó, se cuenta como fly normal". Es la regla:
  sin carrera no hay sacrificio.

---

## 4. El lineup y los cambios

### 4.1 Antes del partido

Una pantalla por equipo:

1. **Orden al bate.** Se eligen de la nómina. **Con bateador extra**, así que
   el orden puede tener más de nueve (o de diez).
2. **Posición defensiva** de cada uno. El bateador extra batea y no fildea.
3. **Número de camiseta, opcional.** Hoy `players` no tiene dorsal. Se escribe
   en el lineup del partido para que la pantalla diga "#14 Pérez", sin tocar la
   nómina.
4. **Los suplentes quedan solos**: todo el de la nómina que no quedó en el
   orden al bate está en el banco. Igual que en vóley, sin pantalla aparte.

**"Usar el lineup del partido anterior".** Los equipos casi siempre repiten.
Con eso el lineup es revisar y confirmar, no armarlo desde cero.

**Validaciones: se avisa, no se bloquea** —la misma línea que vóley—. Posición
repetida, nadie en una posición: aviso visible y se puede seguir.

### 4.2 Cambios durante el juego

**Decidido el 2026-09-16: cambios libres, con reingreso ilimitado.** Cualquiera
puede salir y volver las veces que sea. La app no lleva la cuenta ni avisa.

| Cambio | Qué hace |
|---|---|
| **Bateador emergente** | Entra en el lugar del orden al bate de otro |
| **Corredor emergente** | Entra a correr por el que está en base. **Libre**: no gasta nada y no saca a nadie del juego |
| **Cambio defensivo** | Entra alguien a una posición, o dos jugadores se cambian de posición |

El cambio de pitcher es un cambio defensivo más. Hay que registrarlo aunque no
haya estadísticas de pitcher, porque el out y la asistencia van al que está en
la posición en ese momento.

### 4.3 El cambio en el momento del turno

**Pedido del dueño:** los cambios se hacen muchas veces justo cuando le toca
batear a alguien. Por eso **en la pantalla del bateador hay un botón de cambio
a mano**, sin ir a otra pantalla:

Maqueta: `6-cambio.png`.

1. Toca "Cambiar bateador" en la tarjeta del que va a batear.
2. Se abre el banco del equipo y elige quién entra.
3. **Abajo de todo, más escondido**, "Agregar jugador nuevo": escribe el nombre
   y entra.

Queda en letra chica, abajo del botón de confirmar. Es escondido a propósito: la mayoría de las veces el jugador está en el banco,
y si "Agregar nuevo" está a la vista la mesa escribe nombres que ya existen y
aparece "Pérez" dos veces.

**El jugador nuevo queda inscrito en el equipo** (dueño, 2026-09-16), no solo
en ese partido. **Esto necesita una puerta nueva en el servidor:** hoy el link
del planillero no puede crear jugadores. Como el link no pide cuenta, esa
puerta tiene que dejar agregar jugadores **solo a los dos equipos de ese
partido**, y guardar quién lo agregó y con qué link, igual que ya se guarda
con los resultados. Y tiene que pasar por la cola sin señal: el jugador se usa
enseguida en la planilla y se crea en el servidor cuando haya red.

Lo mismo vale para el lineup de antes del partido (4.1): si falta alguien,
"Agregar jugador nuevo" también está ahí, abajo.

---

## 5. Historial de la entrada y Deshacer

**Igual que en vóley** (dueño, 2026-09-16).

**Historial:** debajo del marcador, la lista de lo que pasó en la entrada, la
más reciente arriba:

> Baja de la 3.ª · 2 outs
> Díaz — robo de segunda
> Gómez — out 6-3 · Díaz a segunda
> Cambio: López batea por Martínez
> Pérez — sencillo al 7 · Ruiz anota

Se puede mirar la de entradas anteriores. Los cambios también aparecen, porque
también son jugadas de la lista.

**Deshacer quita la última jugada.** Si el error fue tres jugadas atrás, se
toca Deshacer tres veces y se vuelven a anotar. No se edita una jugada del
medio: cambiar una jugada vieja cambia los outs, quién estaba en base y a quién
le tocaba batear en todo lo que vino después. Es la misma razón por la que en
vóley un punto no se edita, se deshace.

---

## 6. Cómo se ve y cómo se manda

### 6.1 La pantalla principal

Maqueta: `2-juego.png`. De arriba abajo:

1. **Pizarra**: carreras por entrada de los dos equipos, R-H-E al final.
2. **Situación**: "Baja de la 4.ª", los outs como tres puntos y **las carreras
   que van en esta entrada** ("+2"), grandes.
3. **El diamante** con los corredores (nombre en cada base), al lado de la
   tarjeta del bateador.
4. **Al bate**: nombre, número y cómo le va hoy ("1 de 1, un doble"), con el
   botón **Cambiar bateador** (4.3). Debajo, quién sigue y el de después.
5. **Botones del resultado** (3.1), grandes, para el pulgar.
6. **Historial de la entrada** (sección 5): las últimas tres jugadas y "Ver
   todas".
7. **Abajo**: Deshacer, Corredores, Cambios.

Tres outs cierran la entrada solos y cambian de equipo. **Son 7 entradas.** Al
terminar la 7.ª —o si el home club va ganando después de la alta de la 7.ª, o
anota la carrera que gana en la baja— la app **pregunta** si terminó; no cierra
sola. Si van empatados, sigue a la 8.ª.

### 6.2 Al terminar

1. **Revisión liviana** (decisión del dueño, 2026-09-16): una pregunta grande,
   "Tigres 8 – Caimanes 6. ¿Es el mismo marcador del ampayer?", con "Sí,
   mandar" y "No, revisar". Abajo, chico, "Ver estadísticas de cada jugador"
   para quien quiera mirar. "No, revisar" vuelve al juego para usar Deshacer.
   **Por qué así:** después de mandar, corregir ya no es Deshacer sino el
   organizador a mano (6.3). El error más común y el que más pesa es una
   carrera sin marcar, porque cambia la tabla de posiciones, y se atrapa
   comparando con el marcador del ampayer. Una tabla de 22 jugadores por 9
   columnas, en cambio, un planillero con poca tecnología la pasa sin mirar.
2. **Se manda**: el marcador y las estadísticas resumidas, por el mismo
   endpoint del planillero y en el mismo formato de siempre, con la cola sin
   señal de vóley.
3. **La lista de jugadas también viaja y se guarda aparte.** No la usa nadie en
   la entrega 1, pero sin ella el día que se quiera la pantalla en vivo o las
   estadísticas de pitcher hay que empezar de cero.

### 6.3 Si después hay que corregir

El organizador sigue pudiendo abrir la planilla de estadísticas a mano y
corregir un número. Lo que manda es lo que queda en `match_events`; la lista de
jugadas queda como detalle y puede no coincidir con la corrección. Pasa poco,
y rehacer la lista a partir de un número cambiado no tiene solución.

### 6.4 Aplazado

Los juegos de softbol se suspenden por lluvia y por luz. **Se hace igual que
en vóley** (decisión del dueño, 2026-09-16), que ya sabe aplazar a mitad de
camino y retomar (`../voley/APLAZADO-PLANILLA-URGENTE.md`). Acá es más simple
de guardar —la lista de jugadas ya es el estado completo—. Entra en la
entrega 1.

### 6.5 Con señal y sin señal

**Igual que vóley, con dos cosas más: la nómina y los jugadores nuevos.**

1. **Abrir el link necesita señal la primera vez.** Al abrirlo, la app baja y
   guarda en el teléfono los partidos del link, la nómina de los dos equipos y
   el último lineup de cada uno. Desde ahí el lineup se arma sin señal. Hasta
   que exista la pieza de abrir sin señal (6.5.1) hay que abrirlo **antes de
   llegar a la cancha** y sin cerrar el navegador.
2. **Durante el juego no va nada al servidor.** Cada toque se guarda en el
   teléfono al instante. Si se apaga la pantalla, se recarga la página o se
   cierra el navegador, al volver a abrir el link sigue donde iba.
3. **Jugador nuevo sin señal:** se crea en el teléfono marcado como pendiente y
   se usa enseguida. Viaja por la misma cola, **antes** que el resultado: si
   el resultado llegara primero, las estadísticas de ese jugador no tendrían a
   quién pegarse.
4. **Al terminar**, el resultado entra a la cola de vóley y sale solo cuando
   hay señal. Si el servidor lo rechaza (por ejemplo, el link venció: vence 72
   horas después del último partido), queda con el motivo y un botón para
   reintentar a mano.

**Lo que no se puede sin señal:** pasar el partido a otro teléfono a mitad del
juego. Con señal sí, desde la última copia de respaldo.

**Copia de respaldo al cerrar cada entrada** (decisión del dueño,
2026-09-16). Si el teléfono se pierde o se daña a mitad del juego, sin esto se
pierde lo anotado. Cuando hay señal, al cerrar cada media entrada se manda una
copia de la lista de jugadas, por la misma puerta del aplazado (6.4). Si no hay
señal, no se reintenta ni se avisa: la próxima entrada manda la copia
completa. No es un resultado —la tabla de posiciones no se toca— y sirve para
que otro teléfono retome el juego desde la última entrada cerrada.

### 6.5.1 Pendiente: abrir la planilla sin señal

**Falta, igual que en vóley** (objetivo anotado el 2026-09-16; ver 8.1 de
`../voley/planilla-en-vivo-volley.md`). Se construye una sola vez para los dos
deportes.

**Qué resuelve y qué no.** La primera vez de todas **siempre necesita
internet**: el teléfono tiene que bajar la planilla por lo menos una vez, y eso
no lo evita ninguna página web (solo una app de tienda). Lo que resuelve es lo
que pasa en la cancha: la mesa abrió el link en la casa, cerró el navegador o
reinició el teléfono, y llega a un coliseo sin señal. Hoy ahí la página no
carga; con esto carga, con la planilla y los datos de la última vez.

**Las advertencias, para cuando se construya y para decírselas a las mesas:**

- **Los datos son los de la última vez que abrió con señal.** Si el organizador
  cambia la programación o agrega un jugador después, la mesa no lo ve hasta
  tener señal otra vez.
- **En iPhone, Safari puede borrar la copia** si el link pasa más o menos una
  semana sin abrirse. Se evita agregando el link a la pantalla de inicio
  ("Compartir" → "Agregar a inicio") o abriéndolo el día antes.
- **La instrucción para las mesas:** "Abre el link con internet antes de ir a
  la cancha."

**Cuánto:** 1 – 2 días. Es una sola pieza (service worker) y sirve a la vez a
vóley y a softbol: se hace una vez.

**Lo que suma en softbol:** la copia de la última vez también trae la nómina y
el último lineup de cada equipo. Un jugador inscrito después de esa copia no
aparece en el banco; la mesa lo puede agregar como "Jugador nuevo" y **puede
quedar repetido** en la nómina. Cuando se construya, conviene que al agregar
uno nuevo la app avise si ya hay alguien con ese nombre al volver la señal.

### 6.6 Cuántos datos se guardan y dónde

Son más datos que en vóley, pero ninguno es un problema hoy. Van a cuatro
lugares:

| Dónde | Qué | Cuánto |
|---|---|---|
| **El teléfono** | La lista de jugadas y los lineups mientras se juega | Un juego son unas 150 jugadas, **unos 30 KB**. El navegador aguanta unos 5 MB. Se borra cuando el servidor confirma el resultado |
| **`match_events`** | Las estadísticas resumidas, en el mismo formato de hoy: una fila por cada turno, hit, carrera, out… | **Unas 200 filas por partido.** Un torneo de 40 partidos, unas 8.000. Toda la plataforma tenía 23.617 el 9 de septiembre |
| **Tabla nueva de jugadas** | La lista de jugadas entera, **una sola fila por partido** | 30 KB por partido |
| **`players`** | Los jugadores nuevos | Pocos |

**Dos cuidados:**

- **La lista de jugadas NO va en `matches`**, aunque sea más cómodo. La página
  del torneo trae los partidos completos, y 40 partidos × 30 KB serían más de
  1 MB extra en cada visita, para un dato que nadie mira ahí. En tabla aparte
  solo se lee cuando alguien lo pide.
- **Las filas de `match_events` crecen rápido.** La página del torneo ya las
  pide de a páginas (`fetchMatchEventsByMatchIds`), así que el corte de 1000
  filas de la API no las pierde. Lo que sí crece es lo que baja el que abre la
  página para ver los líderes. Con un torneo de 8.000 filas todavía anda bien;
  si un torneo pasa de unas 15.000 o la página se pone lenta, el arreglo es
  guardar **una fila por jugador por partido** (la línea del box score) en vez
  de una por evento. Es un cambio grande y hoy no hace falta.

**Qué ve el público:** lo mismo que hoy. La planilla guarda todas las
estadísticas; las que elige el organizador para su torneo son las que se
muestran.

---

## 7. Cuánto es

| Parte | Peso |
|---|---|
| El modelo: lista de jugadas → entrada, outs, bases, turno, cambios, historial, estadísticas | **~1 semana** |
| Pantallas: lineup, turno, corredores, cambios, historial, resumen | ~1 semana |
| Envío: resumir a `match_events`, guardar la lista, reusar la cola de vóley | 2 días |
| Agregar jugador nuevo desde el link (puerta en el servidor + cola) | 1 – 2 días |
| Abrir sin señal (service worker, sirve también a vóley) | 1 – 2 días |
| Copia de respaldo por entrada y retomar en otro teléfono | 1 día |
| **Entrega 1 — softbol bola lenta** | **~2 semanas y media a 3** |
| Nocaut | 1 – 2 días |
| Lanzamiento rápido encima (sección 8) | ~3 – 4 días |
| Estadísticas de pitcher (las dos modalidades) | ~1 semana |
| Pantalla en vivo para el público | se suma a `../voley/PLANILLA-EN-VIVO-PUBLICO.md` |

El modelo es lo que más hay que probar: cada jugada rara (doble play con
corredor en tercera que anota, error en el tiro después de un hit) tiene que
dejar las estadísticas bien. Se prueba con planillas en papel reales del
organizador, jugada por jugada, comparando el resultado.

---

## 8. Lanzamiento rápido: qué hay que sumarle después

La base es la misma. El rápido **agrega jugadas**; no cambia las que ya hay.
Por eso la modalidad va como **configuración del torneo** (lenta / rápida) y
no escrita adentro del código.

| Jugada o estadística | Rápido | Lento | Qué hay que hacer para el rápido |
|---|---|---|---|
| **Golpeado (HBP)** | Sí | No — en lento la bola que pega al bateador es bola, no da base | Botón en "Se embasa sin hit". No cuenta como turno al bate |
| **Toque de sacrificio** | Sí | No — en lento no se permite tocar | Botón en "Sacrificio". No cuenta como turno |
| **Hit de toque** | Sí | No | Variante del sencillo |
| **Lanzamiento desviado / passed ball** | Sí | No se anota | Motivos de avance en "Corredores" |
| **Sorprendido fuera de la base (pickoff)** | Sí, con tiro | Out directo cantado por el ampayer (3.2) | En rápido el out tiene fildeadores, como un 2-6 |
| **Tercer strike no atrapado** | Sí | Sí | Ya está en la entrega 1 |
| **Robos** | Sí | Sí | Ya están en la entrega 1 |
| **Short fielder (10)** | No, juegan 9 | Depende de la liga | La modalidad decide si existe la posición 10 |

Con golpeado y toque de sacrificio cambian dos fórmulas: el turno al bate
(tampoco cuentan) y el porcentaje de embasado (el golpeado suma).

**El pitcher pesa más en el rápido.** Ponches del pitcher, bases por bolas,
golpeados y entradas lanzadas son la estadística que más se mira en
lanzamiento rápido. Queda para después (decisión del dueño), pero la lista de
jugadas ya guarda quién lanzaba en cada jugada, así que no se pierde nada.

---

## 9. Y el béisbol

La misma base que el rápido, con más cosas encima: 9 entradas (menos en
infantiles), balk, carreras limpias, sin reingreso, y **conteo de lanzamientos
obligatorio en categorías infantiles** —que son justo los torneos de béisbol
que hay hoy en producción (Pre-Infantil, Infantil, Pony, Pre-Junior)—.
Probablemente ahí sí haga falta contar lanzamientos por pitcher, aunque no se
anoten bolas y strikes. Va en su propio documento cuando llegue.

---

## 10. Pendiente

**Para la segunda versión:**

- **Nocaut** (carreras de ventaja y desde qué entrada).
- **Lanzamiento rápido** (sección 8).
- **Estadísticas de pitcher**, las dos modalidades.

**Nada más por decidir para la primera.** Las últimas tres preguntas se
cerraron el 2026-09-16: el short fielder juega a veces (interruptor por
partido, 3.1), un foul con dos strikes no es out (3.1), y el out por
despegarse no se le anota a nadie (3.2).

**Sobre copiar la planilla en papel:** no se va a copiar. Decisión del dueño:
la idea es una interfaz propia, más fácil que la de papel, porque hay
planilleros que no manejan mucha tecnología. Lo que sí hace falta antes de
soltarla es **probarla con un planillero de verdad** anotando un juego entero,
y comparar las estadísticas que saca con las que el organizador tiene de ese
juego.

---

## 11. El recorrido completo, de punta a punta

Cómo la usa la mesa un día de juego. Las maquetas están en
`planilla-softbol-propuestas/`.

### 11.1 Antes de llegar a la cancha

El organizador comparte el link del planillero, como hoy. La mesa lo abre con
señal y queda guardado en el teléfono lo que necesita (6.5).

### 11.2 Elegir el partido

La mesa ve los partidos del link y toca el suyo. Dice "Empezar planilla".
La app toma de la programación quién es visitante (batea en la alta) y quién
home club (batea en la baja); si en la cancha es al revés, hay un "Cambiar
quién batea primero".

### 11.3 El lineup (`1-lineup.png`)

Un equipo por vez, primero el visitante.

1. **El atajo:** "Usar el lineup del partido anterior". Llena todo con el orden
   y las posiciones de la última vez. Si el equipo repite, se revisa y se sigue.
2. **Si no, a mano:** se abre la nómina del equipo. Cada nombre que se toca
   pasa al siguiente turno del orden al bate (el primero tocado es el 1.º) y
   pide su posición con una fila de botones: P, C, 1B, 2B, 3B, SS, LF, CF, RF,
   SF y EH.
3. **Ajustar:** para cambiar el orden se arrastra la fila (≡). Tocando una fila
   se cambia la posición o se escribe el número de camiseta, que es opcional.
4. **"Juegan 10 en el campo"** prende o apaga el short fielder para este
   partido.
5. **El banco se arma solo:** los de la nómina que no se tocaron.
6. **Falta alguien:** "+ Jugador nuevo", abajo y chiquito. Se escribe el nombre
   y queda en el equipo (4.3).
7. **Avisos, no bloqueos:** si hay dos en la misma posición o falta el catcher,
   se ve el aviso y se puede seguir.

"Seguir con el otro equipo", mismo trámite, y "Empezar juego".

### 11.4 Cada turno al bate (`2-juego.png`)

Arriba siempre está la pizarra, la entrada, los outs, las carreras de esta
entrada y el diamante con los corredores. La tarjeta dice quién batea.

1. La mesa toca **qué pasó**: hit, out, base por bolas, error, bola ocupada o
   "Más".
2. Si hace falta, **toca dónde** en el campo (`3-fly.png`, `4-rolling.png`).
3. Si había gente en base, **confirma los corredores** (maquetas 5, sección 3.2). Si no, no
   aparece nada.
4. La app suma, anota en el historial y **pasa al siguiente bateador**.

### 11.5 Entre turnos: el botón Corredores

Para lo que pasa sin que nadie batee: robo, out robando, avance por error, out
por despegarse. **También se puede tocar al corredor en el diamante**, que es
más directo: abre lo mismo, ya sabiendo de quién se trata.

### 11.6 Dónde se hacen los cambios

| Qué cambio | Dónde se toca | Cuándo se usa |
|---|---|---|
| **Bateador emergente** | "Cambiar bateador", en la tarjeta del que va a batear (`6-cambio.png`) | Justo antes del turno. Es el caso más común |
| **Corredor emergente** | Tocar al corredor en el diamante → "Corredor emergente" | Con el corredor en base |
| **Cambio defensivo o de pitcher** | Botón "Cambios", abajo | En cualquier momento, pero sobre todo al empezar la media entrada |
| **Mover a alguien de posición** | Botón "Cambios" → tocar al jugador → nueva posición | Igual |
| **Agregar un jugador nuevo** | Abajo de cualquier lista del banco | Cuando no está en la nómina |

Al terminar cada media entrada la app muestra "Termina la alta de la 4.ª" con
las carreras que hizo el equipo, y un **"¿Cambios en la defensa de Tigres?"**
que se puede saltar. Es el momento natural de los cambios defensivos y así la
mesa no tiene que acordarse de buscar el botón.

Cuando entra un emergente, **toma la posición del que salió** para la próxima
defensa, y se puede cambiar desde "Cambios".

Todo cambio es una jugada más: aparece en el historial y se deshace igual.

### 11.7 Si se equivocaron

**Deshacer** quita la última jugada, las veces que haga falta (sección 5). El
historial muestra las últimas tres jugadas de la entrada y "Ver todas" abre el
juego entero por entradas.

### 11.8 El final

1. Terminada la 7.ª (o antes, si el home club va ganando), la app **pregunta**
   si terminó el juego. Si van empatados, sigue a la 8.ª.
2. **"¿Es el mismo marcador del ampayer?"** Sí manda; No vuelve al juego para
   revisar. Las estadísticas de cada jugador están a un toque, para quien
   quiera mirarlas (6.2).
3. **Sin MVP en la planilla** (dueño, 2026-09-16). La planilla no lo pide.
4. **"Mandar resultado"**: entra a la cola y sale cuando hay señal (6.5).
5. La página del torneo se actualiza sola: marcador, tabla de posiciones y
   líderes.

### 11.9 Si se suspende

Lluvia o luz: "Aplazar" en el menú. **Igual que en vóley** (dueño,
2026-09-16): queda guardado cómo iba el juego y se retoma después desde la
misma entrada, con los mismos lineups (6.4).

