# Planilla en vivo de vóley — para la mesa, no para el entrenador

**Estado:** evaluada y **pedida por el dueño el 2026-09-06.** Nada empezado
todavía. Falta una respuesta (la señal en la cancha) para poder arrancar.
**Fecha:** escrito el 2026-08-26, actualizado el 2026-09-06.
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

Mientras el set está en juego **no se manda nada al servidor**. La mesa cuenta
puntos y ve rotar a los seis en la pantalla; cuando el set termina se guarda lo
único que el sistema guarda hoy de un partido de vóley: el resultado del set,
por el endpoint del planillero que ya existe y ya está probado.

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
| **Link de planillero** | `supabase/migrations/20260613_scorer_links.sql`, `src/app/score/[token]/page.tsx` | Token con vencimiento, sin cuenta y sin app. La mesa abre un link y carga. Ya se revoca, ya se audita (`entered_by_name`, `entered_via_token`), ya sirve para varios torneos (`20260727`) |
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

**Qué hace:** la mesa abre el link, escribe los seis números de cada equipo,
cuenta puntos con dos botones grandes y ve girar la rotación. Al cerrar el set,
manda el resultado.

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

## 7. Qué falta para arrancar

Ya no es "no hay quien lo pida" — lo pidió el dueño el 2026-09-06. Queda una
sola pregunta abierta, y es la que decide el tamaño:

- **¿Hay wifi o datos en los coliseos donde se juega?** Ya no cambia el tamaño
  de la entrega 1 —esa funciona desconectada igual— pero sí decide si hace falta
  el service worker (entrega 3) para poder ABRIR la planilla en la cancha, y si
  la pantalla en vivo del público (entrega 2) tiene sentido ahí.

Lo otro que conviene mirar antes de empezar, aunque no bloquea: si alguna mesa
quiere de verdad anotar en vivo o si cargar al final ya les sirve. La entrega 1
se puede hacer sola y ver qué pasa.

**Diseño:** hay tres propuestas de pantalla en modo oscuro para elegir, hechas
el 2026-09-06, en `Por hacer/planilla-volley-propuestas/` (los `.png` son las
propuestas; el `LEEME.md` de esa carpeta explica cada una y cómo cambiarlas).
