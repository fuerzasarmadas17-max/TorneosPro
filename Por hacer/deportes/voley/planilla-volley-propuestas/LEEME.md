# Planilla digital de vóley — la pantalla elegida

Es la pantalla que ve **la mesa** mientras se juega el set: el marcador, quién
saca, los seis en cancha, y los botones para sumar punto, deshacer, hacer un
cambio y cerrar el set.

De las tres propuestas quedó la del **marcador grande**: el marcador manda y
los botones de punto son enormes, para usarla sin mirar mucho. Está en **modo
oscuro** nomás; cuando se construya va en claro y oscuro como el resto de la
plataforma. Los colores son los del tema oscuro de Torneos Pro.

El orden en que las ve la mesa: primero quiénes juegan, después la rotación de
arranque, y de ahí en adelante el marcador. El cambio se abre desde el marcador.

| Archivo | Qué muestra |
|---|---|
| `1-jugadores.png` | Paso 1: **quiénes juegan**, de pie. |
| `1-jugadores-horizontal.png` | Paso 1, acostado. |
| `1-rotacion.png` | Paso 2: **la rotación de arranque**, de pie. |
| `1-rotacion-horizontal.png` | Paso 2, acostado. |
| `1-marcador-grande.png` | **De pie.** El celular vertical en una mano. El marcador arriba, los dos botones de punto en el medio, la rotación de apoyo abajo. |
| `1-marcador-grande-horizontal.png` | **Acostado.** El celular o la tablet horizontal, con las dos manos. |
| `1-cambio.png` | La pantalla de **cambio**, de pie. |
| `1-cambio-horizontal.png` | La pantalla de **cambio**, acostado. |

## Qué cambia al acostarlo

Acostado no hay alto para apilar y sí hay ancho de sobra, así que se reparte
distinto en vez de encoger lo mismo:

- **Cada equipo se lleva un lado entero de la pantalla.** Todo ese lado es su
  botón de punto, y cae justo donde apoyan los pulgares al sostener el aparato
  con las dos manos. Se toca el lado del que anotó, sin apuntar.
- **El marcador de cada equipo vive en su propio lado**, arriba de su botón.
  No hay forma de confundir a quién le estás sumando.
- **La rotación de cada equipo también va en su lado.** Todo lo de un equipo
  queda junto y se lee sin cruzar la pantalla.
- **El centro es lo que se mira y no se toca:** los sets, quién saca y los
  últimos puntos.
- **Los botones de acción van en el centro, no abajo de todo.** Acostado, el
  borde inferior es justo donde descansan los pulgares que están tocando los
  lados, y ahí un "Cerrar set" se aprieta sin querer.

## Cambio y tiempo: los dos son del equipo

Las dos acciones que son de un equipo y no del partido viven del lado de su
equipo, debajo de su botón de punto y arriba de su rotación.

- **Cambio** es la sustitución. Está pegado a los seis números de ese equipo,
  así que ya sabe a quién le vas a cambiar un jugador: se toca, se elige quién
  sale y quién entra, y listo. Antes había además un "Cambio" en el centro que
  hacía lo mismo pero sin saber de qué equipo, o sea que tenía que preguntarlo
  primero. Se sacó: dos botones con la misma palabra confunden a la mesa.
- **Tiempo** son los dos tiempos por set que tiene cada equipo. Los dos puntos
  al lado dicen cuántos le quedan: dorado el disponible, hueco el ya usado. En
  la imagen, Aura gastó uno y a Caribe le quedan los dos. Sin tiempos
  disponibles el botón se apaga en vez de desaparecer, para que se vea que
  existía y ya se usó.

Los dos se dibujan como botón. Antes eran una etiqueta gris en mayúsculas, del
mismo estilo que "EN CANCHA", y no parecían tocables.

Un tiempo pedido por error se arregla con **Deshacer**, igual que un punto mal
cargado.

## Los dos pasos de antes del partido

**Paso 1, quiénes juegan.** Se anotan las etiquetas de todos los que pueden
entrar hoy, los que arrancan y los del banco, un equipo por vez. No son
jugadores de la nómina: es el número que la mesa ve en la camiseta, y si
alguno no tiene número, una letra. Por eso el teclado trae una tecla ABC.

El teclado es propio y no el del teléfono: en la cancha se anota de a un
número por vez y las teclas grandes se aciertan sin mirar. Acostado va del
lado izquierdo, para que la mano que escribe no tape la lista de la derecha.

**Paso 2, la rotación de arranque.** Las seis posiciones se dibujan como se
ven parado detrás de la línea de fondo: arriba la red con las posiciones 4, 3
y 2, abajo el fondo con la 5, la 6 y la 1. Es el orden que la mesa tiene
enfrente, no una lista del uno al seis. La 1 va marcada porque es la que saca
primero.

Se toca una posición y se elige el jugador de los que quedan sin ubicar. Los
que sobren van al banco y entran por cambio.

Después de esto **no se toca más la rotación en todo el set**: la app rota
sola cuando el equipo que recibe gana el punto. Es la decisión de 4.2 del
documento, y es lo que hace que los seis en cancha nunca se desincronicen del
marcador.

## La pantalla de cambio

Se abre al tocar "Cambio" del lado de un equipo. Dos pasos en una sola pantalla:
quién sale, de los seis en cancha, y quién entra, de la banca. El botón de
confirmar dice el cambio completo en palabras, "Entra el 8 por el 9", para que
se lea antes de apretar.

De pie la hoja sube desde abajo, que es donde llega el pulgar. Acostado va
centrada, porque el borde inferior queda tapado por las manos que sostienen el
aparato.

Tres cosas que la pantalla tiene que respetar:

- **Un jugador puede identificarse con una letra**, no solo con un número. Hay
  ligas donde alguien no tiene dorsal y se lo anota como "A". Por eso la casilla
  es cuadrada y centrada, igual de cómoda para una "A" que para un "12".
- **Dentro del set, un cambio ata a los dos jugadores.** Si el 6 entró por el 4,
  desde ahí hasta que termine el set esos dos solo pueden entrar y salir entre
  ellos. En la banca esos jugadores salen apagados y **con el motivo escrito**
  ("solo por el 4"). Se apagan y no se esconden: si desaparecen, la mesa los
  busca y cree que se borraron.
- **Al cerrar el set se reinicia** y todos quedan libres otra vez.

## Para cambiar algo

1. Abrí el `.html` que corresponde y editá lo que quieras (los nombres de los
   equipos, los números, el marcador).
2. En la Terminal, parado en esta carpeta, corré `./render.sh`.
3. Los `.png` quedan actualizados.

El tamaño lo decide el nombre del archivo: los que terminan en `-horizontal`
se renderizan acostados y el resto de pie. `comun.css` tiene los colores y lo
que comparten las dos.
