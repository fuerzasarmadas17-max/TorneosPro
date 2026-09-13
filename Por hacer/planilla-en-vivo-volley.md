# Planilla en vivo de vóley — para la mesa, no para el entrenador

**Estado:** **en construcción desde el 2026-09-12.** Las cuatro decisiones que
faltaban se cerraron ese día. Ya están hechos el dato del torneo (jugadores en
cancha) y las dos pantallas de antes del partido. **Falta el marcador**, que es
lo que la hace servir; hasta entonces la planilla está apagada (ver 8).
**Fecha:** escrito el 2026-08-26, actualizado el 2026-09-12.
**Origen:** el organizador preguntó cuánto trabajo sería que la mesa lleve la
planilla en vivo —rotación, punto por punto— en vez de cargar el resultado al
final.

**Alcance: solo vóley.** Las planillas en vivo de los otros deportes son otra
conversación y no van en este documento — el básquet y el béisbol tienen reglas
distintas, y meterlos acá sería mezclar tres proyectos en uno.

> La primera versión de esta respuesta la pensé para el **entrenador** y salió
> cara y con un riesgo grande: en vóley el entrenador no lleva la planilla,
> tiene las dos manos ocupadas dirigiendo. Para la **mesa** es otra cosa —
> anotar es literalmente su trabajo. Casi todo lo caro se cae. La diferencia
> está explicada en "Qué cambia que sea la mesa", más abajo.

---

## 1. La conclusión, arriba

**La entrega 1 es una planilla que vive en el teléfono: unos 4 o 5 días.**
Decisión del dueño, 2026-09-06 — y es la buena.

Mientras el partido está en juego **no se manda nada al servidor**. La mesa
cuenta puntos y ve rotar a los seis en la pantalla; cuando el partido termina se
guarda lo único que el sistema guarda hoy de un partido de vóley: el marcador y
los parciales de cada set, por el endpoint del planillero que ya existe y ya
está probado.

**Ojo, corregido el 2026-09-12:** antes acá decía que se guardaba *al cerrar
cada set*, y el servidor no lo acepta. `validateVolleyballSets` exige un partido
completo —el ganador tiene que llegar a los sets que se piden— así que un 1-0 a
mitad de camino se rechaza, y con razón: es la regla que impide que un partido a
medio cargar desordene la tabla. Los sets cerrados se acumulan en el teléfono y
salen todos juntos al final. Sale más simple, no más caro.

Eso hace desaparecer, de un saque, el pedazo más caro del proyecto: **trabajar
local ES trabajar sin señal**. Se caen también la tabla de puntos, el tiempo
real y toda la discusión de cuántas conexiones aguanta (ver 6.5).

Lo que se pierde es la **pantalla en vivo para el público**: el que mira desde
la casa ve el marcador al terminar cada set, no punto a punto. Sigue siendo
mejor que hoy —hoy lo ve cuando termina el partido— pero no es "seguilo en
vivo", y esa pantalla es justo la que trae gente a la página durante el partido,
que es la que se cuenta para el reparto de publicidad. Por eso es entrega 2 y no
descarte.

Para referencia, la versión con todo (punto por punto en el servidor, pantalla
en vivo y modo sin señal completo) sigue costando **5 a 6 semanas**. La entrega
1 da el 80% de lo útil por el 10% del trabajo.

---

## 2. Lo que ya está construido

Más de lo que parece. La mitad del camino ya existe y está en producción:

| Pieza | Dónde | Qué hace |
|---|---|---|
| **Link de planillero** | `supabase/migrations/aplicadas/20260613_scorer_links.sql`, `src/app/score/[token]/page.tsx` | Token con vencimiento, sin cuenta y sin app. La mesa abre un link y carga. Ya se revoca, ya se audita (`entered_by_name`, `entered_via_token`), ya sirve para varios torneos (`20260727`) |
| **Sets de vóley** | tabla `volleyball_sets` | Set por set, con puntos de cada lado, atado al partido |
| **La regla de los sets** | `src/lib/volleyball-sets.ts` | Que el 2-1 sean exactamente tres sets. La validan los tres lados, incluido el servidor, porque el link es un endpoint público |
| **Tiempo real** | `src/components/tournaments/tournament-detail.tsx:713` | Ya hay un canal de Supabase Realtime andando. La pantalla del torneo ya se actualiza sola cuando el anotador guarda |
| **Jugadores por equipo** | tabla `players` | Nombre, edad, documento |

**Ojo con dos cosas de esa lista**, porque son los dos huecos exactos:

1. El canal de Realtime escucha **`UPDATE` sobre `matches`**, nada más. No
   escucha `volleyball_sets` ni escucharía una tabla de puntos. Hay que sumarle
   la suscripción — es poco, pero no es gratis.
2. ~~`players` **no tiene número de camiseta.**~~ **Ya no importa** (decisión
   del 2026-09-06, ver 4.2): los números de la rotación son etiquetas sueltas,
   no jugadores. La tabla `players` no se toca y no hay backfill.

---

## 3. Qué cambia que sea la mesa y no el entrenador

Dos cosas caras se caen enteras:

**Se cae el conflicto de dos anotadores.** Si el entrenador y la mesa cargan el
mismo partido, se pisan, y hay que decidir cuál manda y reconciliar. Con la mesa
sola hay un solo autor y el problema no existe.

**Se cae validar la rotación.** Esto es lo grande. La falta de posición la canta
el árbitro, no la planilla. El sistema no tiene que decidir si una rotación es
legal — solo mostrar los seis en cancha y girarlos cuando el equipo recupera el
saque. Eso es rotar un arreglo de seis, no una máquina de estados con casos
raros. Lo mismo con el líbero y con los cambios: la mesa los apunta, el sistema
los guarda y no opina.

Comprobar la rotación costaba tres semanas. Anotarla cuesta días.

---

## 4. Qué hay que construir

### 4.1 Punto por punto — la base

Hoy solo se guarda el marcador final de cada set. Para que sea en vivo hay que
guardar **cada punto cuando pasa**: número de set, marcador después del punto,
qué equipo lo hizo y quién tenía el saque.

Tabla nueva. Es la parte fácil y es de la que cuelga todo lo demás — la pantalla
en vivo, la rotación y, si algún día se quiere, las estadísticas por jugador.

Dos decisiones que conviene tomar acá y no después:

- **`volleyball_sets` no se toca.** Sigue siendo el resultado oficial del set.
  Los puntos son el detalle; el set es el resumen. Así los partidos viejos y los
  cargados a mano al final siguen funcionando igual.
- **Un punto no se edita, se deshace.** Que el último punto se pueda quitar y ya.
  Editar el punto 14 de un set que va 22-19 es la puerta a que la planilla y el
  marcador digan cosas distintas.

### 4.2 Rotación mostrada — con números sueltos, no con jugadores

**Decisión del dueño, 2026-09-06: el número NO se relaciona con el jugador.** La
mesa escribe seis etiquetas —"5", "12", "B", lo que use esa liga— al empezar el
set, y con eso alcanza. Un cambio reemplaza una etiqueta por otra.

Eso saca de encima la columna de dorsal en `players`, su backfill y tenerla
sincronizada con la nómina.

Y trae algo mejor: **la rotación no hace falta guardarla.** En vóley se rota
exactamente cuando el equipo que recibía gana el punto, así que con los seis del
arranque y la lista de puntos, quién está en cada posición se calcula. Los seis
en cancha no se pueden desincronizar del marcador porque salen del mismo dato.
Un cambio es una línea más en esa lista.

Se muestra, no se valida: la falta de posición la canta el árbitro.

**Lo que se pierde con esta decisión, para que no sorprenda después:** la
pantalla dice "5" y no "María Gómez", y de esta planilla no salen estadísticas
por jugador — nadie sabe quién hizo cada punto. Si alguna vez se quiere eso, hay
que atar los números a la nómina y vuelve el trabajo que esta decisión ahorra.

### 4.2.1 El cambio ata dos etiquetas hasta que termine el set

**Regla que trajo el dueño, 2026-09-09.** Dentro de un set, si el 8 entra por el
10, esos dos quedan atados: el 8 solo puede salir por el 10, y el 10 solo puede
volver por el 8. Ninguno de los dos puede usarse contra otro jugador hasta que
el set termine. **Al cerrar el set se reinicia** y todos quedan libres otra vez.

Buena noticia para lo que hay que guardar: **no hace falta nada nuevo.** Un
cambio ya es una línea más en la lista del set (ver 4.2), así que quién está
atado con quién se calcula leyendo los cambios de ese set, igual que la
rotación se calcula leyendo los puntos.

Lo que sí cambia es la pantalla de cambio. No alcanza con listar la banca: hay
que decir cuáles se pueden usar para el jugador que sale y cuáles no, **con el
motivo a la vista** ("solo por el 4"). Un jugador atado se muestra apagado y no
se esconde: si desaparece, la mesa lo busca y cree que se borró.

Las etiquetas pueden ser letras, no solo números (ver 4.2), así que la casilla
del jugador tiene que estar pensada para una "A" igual que para un "12".

**Decidido el 2026-09-12: se avisa, no se bloquea.** La propuesta era bloquear
el cambio ilegal, y el dueño eligió lo contrario: la mesa puede hacerlo igual y
la pantalla advierte. Queda alineado con la rotación —"se muestra, no se
valida"— y con que hay ligas de barrio que no aplican esta regla. Una planilla
que le dice "no" a la mesa en media cancha es peor que una que le avisa.

Lo que sí hay que construir es el aviso, y tiene que ser visible: el jugador
atado se muestra con su motivo escrito ("solo por el 4") y, si lo eligen de
todas formas, la confirmación lo dice antes de aplicarse. Apagado no, porque
apagado es bloqueado.

**Decidido el 2026-09-12: sin tope de cambios por set.** El reglamento oficial
son seis por equipo, pero los torneos de barrio no lo aplican y la primera
versión no los cuenta.

### 4.2.2 Tiempos: dos por set y por equipo

**Regla que trajo el dueño, 2026-09-09.** Cada equipo tiene dos tiempos por set.
Se reinician con el set, igual que los cambios.

En la pantalla van del lado de su equipo, no en el centro: son de un equipo y
no del partido. Los dos que quedan se muestran como dos puntos —lleno el
disponible, hueco el gastado— para que la mesa sepa cuántos le quedan sin abrir
nada. Sin tiempos disponibles el botón se apaga en vez de desaparecer.

Un tiempo pedido por error se corrige con Deshacer, igual que un punto.

### 4.2.3 Antes de construir estas pantallas

Las pantallas están dibujadas en `Por hacer/planilla-volley-propuestas/`:
quiénes juegan, la rotación de arranque, el marcador y el cambio, cada una de
pie y acostada. **Están dibujadas para seis por equipo.** Antes de escribir
código hay que resolver esto, que las toca a todas.

**Cuántos juegan no siempre son seis.** Hay torneos de niños de cuatro por
equipo, otros de cinco, y los de seis de siempre. La cancha de la pantalla de
rotación no puede tener seis casillas fijas: sale de cuántos juegan en ese
torneo. Con cuatro son dos y dos, con seis son tres arriba y tres abajo.

Eso significa un dato nuevo del torneo, **jugadores en cancha por equipo**, al
lado de "mejor de 3 o 5" que ya existe. Sin eso la planilla no sabe cuántas
casillas dibujar ni cada cuántos puntos cierra la vuelta de rotación.

**Decidido el 2026-09-12: va configurable por torneo desde la primera versión**
—4, 5 o 6, lo elige el organizador al crear el torneo—, y no fijo en seis. Es
la decisión que evita rehacer las cuatro pantallas cuando aparezca el primer
torneo de niños. Entra por migración, junto a `best_of`.

**Se puede empezar con menos de los que corresponden.** En un torneo de seis
puede que lleguen cinco y el partido arranque igual. Hay que poder empezar con
una posición vacía, pero **a propósito y avisando**, nunca por descuido: la
pantalla tiene que decir "vas a empezar con cinco de seis" y pedir confirmar.
La posición vacía rota como una más.

**El que llega tarde se agrega en el momento.** Es el caso de arriba cuando
aparece el que faltaba, a mitad del primer set. Dos cosas que hay que tener
claras cuando se construya:

- La pantalla de "quiénes juegan" **no puede ser solo del principio**. Tiene
  que poder abrirse desde el marcador, con el set empezado.
- Completar una posición vacía **no es un cambio**. No gasta cambio y no ata a
  nadie con nadie (ver 4.2.1). Si el equipo ya estaba completo, el que llega
  entra al banco y de ahí sale por cambio como cualquiera.

**Inscribir a los jugadores tiene que ser un trámite corto.** La idea del dueño
es que en la misma pantalla de la rotación queden los suplentes: se ubican los
que arrancan y **todos los demás quedan de suplentes solos**, sin una pantalla
aparte. El dibujo ya funciona así ("los que queden sin ubicar van al banco").

Queda para decidir si con equipos chicos —cuatro o cinco jugadores, donde casi
todos arrancan— los dos pasos se juntan en una sola pantalla. Con seis y banco
largo conviene separarlos; con cuatro, dos pantallas para escribir cinco
números es un paso de más.

**Atar las etiquetas a los jugadores inscritos: NO en la primera versión.** En
4.2 está decidido que el número es una etiqueta suelta y no un jugador de la
nómina, y esa decisión se sostiene: es lo que hace que la planilla arranque en
treinta segundos y sin nómina cargada.

Lo que sí conviene es **no cerrarse la puerta**. Dos cosas baratas ahora que lo
dejan posible después:

- Guardar la etiqueta como texto en cada línea del set. Si más adelante se
  agrega a quién corresponde, se suma una columna al lado y lo viejo no se
  rompe.
- Cuando el torneo ya tenga la nómina cargada, ofrecer los nombres como
  sugerencia al escribir la etiqueta. La mesa elige "María Gómez" y la app
  guarda su número. Es opcional, no bloquea a quien no tiene nómina, y va
  llenando la relación sin que nadie haga trabajo de más.

Recién con eso hecho tendría sentido la estadística por jugador, que hoy esta
planilla no da (ver el final de 4.2).

### 4.3 Sin señal

Un coliseo de barrio no tiene wifi. La planilla tiene que anotar con el teléfono
desconectado y subir cuando vuelva la red.

Es la mitad del trabajo de todo el proyecto y es lo que decide si sirve en la
cancha o es una demo bonita.

### 4.4 La pantalla del público

Lo más fácil. El Realtime ya está puesto; hay que sumarle la tabla nueva y una
vista de marcador.

---

## 5. Cuánto es

| Parte | Peso |
|---|---|
| **Entrega 1 — planilla local (marcador + rotación + guardado del set)** | **4 – 5 días** |
| Entrega 3 — que la página abra sin señal (service worker) | 1 – 2 días |
| Entrega 2 — mandar los puntos y pantalla en vivo para el público | ~1 semana |
| Tabla de puntos en la base + tiempo real, si se hace la entrega 2 | incluido arriba |

---

## 5.5 La entrega 1 en detalle — la planilla local

**Qué hace:** la mesa abre el link, escribe los números de cada equipo, cuenta
puntos con dos botones grandes y ve girar la rotación. Al cerrar el set, el
parcial queda guardado en el teléfono y arranca el siguiente; al terminar el
partido se manda todo junto (ver la corrección en el punto 1).

**Tres cosas que hay que hacer bien, y son baratas:**

1. **Guardar en el teléfono a cada punto**, no en la base: en el almacenamiento
   del propio navegador. Si se recarga la página, se apaga la pantalla o cambian
   de pestaña, el set sigue 18-16. Sin esto, un toque mal dado borra medio set y
   no lo usan nunca más. Medio día.
2. **Que el dato interno sea la LISTA DE PUNTOS**, aunque no se mande. Si
   adentro del teléfono guardamos solo dos numeritos, el día que quieras la
   pantalla en vivo hay que rehacerlo; si guardamos la lista, mandarla es una
   llamada más.
3. **Que el guardado del final del set espere si no hay señal.** Se queda en el
   teléfono y sale cuando vuelve la red, sin que la mesa tenga que estar
   pendiente.

**Lo único que hoy necesita señal es ABRIR la página la primera vez** — el
navegador tiene que bajarse el programa. Dos salidas:

- **La barata (gratis):** que la mesa abra el link al llegar a la cancha y no
  cierre la pestaña. Una vez cargada, el resto funciona desconectado.
- **La buena (1 o 2 días):** un *service worker*, que hace que el teléfono se
  guarde la página y la pueda abrir sin señal. La app ya tiene `manifest.ts`, o
  sea que ya se puede "agregar a la pantalla de inicio" y abre como app; lo que
  falta es exactamente esa pieza. Hoy **no** hay service worker en el proyecto.

Se decide después de probar en una cancha real.

---

## 6. Cómo partirlo

**Entrega 1 — la planilla local, con rotación.** 4 – 5 días. Todo en el
teléfono; al cerrar el set se guarda el resultado como hoy. Sirve en la cancha
desde el día uno y no depende de que haya señal. Ver 5.5.

**Entrega 2 — la pantalla en vivo para el público.** ~1 semana encima de la
entrega 1: mandar los puntos a medida que pasan y sumar la suscripción de tiempo
real. Como la entrega 1 ya guarda la lista de puntos adentro del teléfono, acá
solo se agrega el envío. Vale la pena cuando haya un torneo con público que la
justifique.

**Entrega 3 — abrir sin señal.** 1 – 2 días (el service worker). Antes se creía
que era 2 – 3 semanas; con la planilla local, casi todo eso ya no hace falta.

---

## 6.5 ¿Aguanta 10 canchas a la vez?

Pregunta del dueño, 2026-09-06. **Sí, y no de casualidad: el que anota casi no
pesa. El que mira, sí.**

Anotar un punto es escribir una fila. Diez canchas anotando un punto cada medio
minuto son unas 20 escrituras por minuto en total — Postgres hace miles por
segundo. Diez planilleros no se notan.

El límite de 30 guardados por minuto (`src/lib/scorer/rate-limit.ts`) no
estorba: la cuenta es por IP + token + partido, así que dos mesas distintas
nunca se pisan, ni compartiendo el wifi del mismo coliseo.

Donde sí hay techo es **la tribuna**. Cada persona con la pantalla en vivo
abierta es una conexión de tiempo real, y los planes de Supabase topan las
conexiones simultáneas. Diez canchas con cien espectadores cada una son mil
conexiones, y ahí el número del plan importa. **Antes de un evento grande hay
que mirar cuál es el tope del plan actual**, no cuántos planilleros hay.

Y una trampa a evitar en la construcción: hoy guardar un resultado **borra todos
los eventos del partido y los vuelve a insertar**. Con esa técnica, cada punto
reescribiría el partido entero — 200 filas por punto. La planilla en vivo tiene
que insertar una fila por punto y nada más. Es la diferencia entre que aguante y
que no.

---

## 6.6 Una pregunta que los dibujos no hacían: quién saca primero

Encontrada al construir, el 2026-09-12. Las cuatro pantallas dibujadas no
preguntan **quién saca el primer punto del set**, y sin eso la rotación no se
puede calcular: la app rota al que recibe cuando gana el punto, así que si no
sabe quién empezó sacando, rota al equipo equivocado desde el primer punto.

En la cancha lo define el sorteo del árbitro, así que es un dato que la mesa
tiene y la app no puede deducir. Se resolvió con una pantalla corta entre la
rotación y el marcador: los dos equipos, se toca uno, y ahí mismo va el aviso
de "fulano empieza con 5 de 6" cuando alguna posición quedó vacía. Es el último
momento antes de que empiece a contar, que es donde corresponde avisar.

---

## 6.7 Los lados de la cancha

Pedido por el dueño después de probarla, el 2026-09-13. La pantalla dibujaba
siempre al local a la izquierda, y en la cancha los equipos cambian de lado: la
mesa terminaba tocando el botón del lado equivocado.

- **Set 1:** en la pantalla de "¿Quién saca primero?" se pregunta también quién
  queda a la izquierda de la mesa. Las dos cosas salen del sorteo.
- **Sets del medio** (el 2.º de 3; del 2.º al 4.º de 5): cambian de cancha, así
  que la app lo propone ya marcado al revés de como terminó el anterior. La
  mesa lo corrige con un toque si en esa liga no cambian.
- **Set decisivo** (el 3.º de 3, el 5.º de 5): sorteo otra vez, sin nada
  marcado. Cuando un equipo llega a **8** sale el aviso "Cambio de cancha" con
  "Ya cambiaron" / "No cambian". **Pregunta, no cambia solo**: si los lados se
  dieran vuelta sin aviso, la mesa tocaría el botón equivocado justo ahí. Si
  contestan "No cambian", vuelve a preguntar a los **13**, para los torneos que
  juegan el decisivo a 25.
- **"Cambiar de lado"** está siempre a mano en el marcador, para los torneos
  con otra costumbre. Es un evento de la lista, así que Deshacer lo revierte.

El lado solo cambia el dibujo: la rotación, el saque, los cambios y el
resultado que se manda no se tocan. Está en `src/lib/volley/planilla.ts`,
sección "Los lados de la cancha".

---

## 7. Qué falta para arrancar

**Nada. Se puede empezar.** Lo pidió el dueño el 2026-09-06 y las cuatro
decisiones que faltaban se cerraron el 2026-09-12: se avisa en vez de bloquear
el cambio ilegal (4.2.1), sin tope de cambios por set (4.2.1), jugadores en
cancha configurable por torneo (4.2.3), y la señal en la cancha.

**La señal: a veces hay y a veces no.** Respuesta del dueño, 2026-09-12. Es el
peor de los tres casos y el que hay que asumir, porque una planilla que se
rompe justo el día que no hay red no se usa más. Dos consecuencias concretas:

- **El envío del final tiene que esperar a la red, no fallar.** Se queda en el
  teléfono y sale solo cuando vuelve. Está en el punto 3 de 5.5 y con esta
  respuesta deja de ser opcional.
- **El service worker (entrega 3) sube de prioridad.** Sin él, la mesa que
  llega a un coliseo sin señal no puede ni ABRIR la planilla. Son 1 o 2 días y
  conviene hacerlos pegados a la entrega 1, no meses después.

Lo otro que conviene mirar antes de empezar, aunque no bloquea: si alguna mesa
quiere de verdad anotar en vivo o si cargar al final ya les sirve. La entrega 1
se puede hacer sola y ver qué pasa.

**Diseño:** hay tres propuestas de pantalla en modo oscuro para elegir, hechas
el 2026-09-06, en `Por hacer/planilla-volley-propuestas/` (los `.png` son las
propuestas; el `LEEME.md` de esa carpeta explica cada una y cómo cambiarlas).

---

## 8. Lo construido hasta ahora

Al 2026-09-12. El orden es el de la conversación con el dueño.

| Paso | Estado | Dónde |
|---|---|---|
| 1. Dato del torneo: jugadores en cancha | **hecho**, ya corrido en producción | `aplicadas/20260912_volley_jugadores_en_cancha.sql` |
| 2. Elegirlo al crear el torneo y después | **hecho** | formulario de crear torneo y Configuración › Formato |
| 3. Pantallas de antes del partido | **hecho** | `src/components/scorer/volley/` |
| 4. El marcador, de pie y acostado | **hecho** | `marcador-screen.tsx` |
| 5. Cambio y tiempos | **hecho** | `cambio-sheet.tsx` |
| 6. Envío al terminar, con cola sin señal | **hecho** | `src/lib/volley/envio.ts` |
| 7. Service worker (abrir sin señal) | falta | — |

**El modelo está en `src/lib/volley/planilla.ts`** y es lo que decide todo lo
demás: el estado del set es la lista de eventos, y el marcador, el saque, la
rotación, los tiempos y los atados se calculan leyendo esa lista. Es el punto 2
de 5.5 —"que el dato interno sea la lista de puntos"— hecho desde el principio
para que la entrega 2 sea agregar el envío y nada más.

**La entrega 1 está completa.** La mesa abre el link, anota el partido entero y
al terminar el resultado sale para el servidor solo; si no hay señal queda en
una cola en el teléfono y sale cuando vuelve, aunque hayan cerrado la pestaña.

**La planilla está APAGADA** igual: `PLANILLA_VOLLEY_ENABLED` en
`src/lib/volley/planilla-flag.ts`. Ya no falta código, falta la prueba en una
cancha de verdad, y esa decisión es del dueño. Se prende poniendo `true` y
desplegando. Para verla sin prenderla, agregarle `?planilla=1` al link del
planillero.

**Lo que sigue faltando es la entrega 3**, el service worker: una vez cargada la
página la planilla funciona desconectada, pero llegar a un coliseo sin señal y
ABRIR el link no va a andar. Con la respuesta del dueño del 2026-09-12 —a veces
hay señal y a veces no— eso es 1 o 2 días que conviene hacer pegados a esto.

**Dos casos que se resolvieron construyendo el envío:**

- **El partido que se corta empatado.** Los relámpagos de dos y tres días lo
  hacen y es práctica común. Al terminar un set con la serie igualada, la
  pantalla ofrece cortar el partido ahí en vez de obligar a jugar un set que
  nadie va a jugar. Solo aparece donde el empate es legal: en playoffs no, y de
  eso ya se encarga `volleyballDrawAllowed`.
- **El resultado rechazado por el servidor.** Un link vencido o un marcador que
  no cuadra no se puede arreglar reintentando, así que ese envío se queda en la
  cola con el motivo escrito y un botón para reintentar a mano, en vez de
  repetir el mismo error cada vez que hay señal.
