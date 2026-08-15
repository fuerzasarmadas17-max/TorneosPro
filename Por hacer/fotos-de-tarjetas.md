# Fotos de las tarjetas de torneo — qué falta y cómo generarlo

> **Verificado el 6 de agosto de 2026: sigue igual.** El mecanismo está hecho
> y desplegado (`src/data/sport-images.ts` + el selector del organizador);
> **falta solo el material**: `public/sports/` está vacío y las 11 listas de
> `SPORT_IMAGES` también, así que hoy todas las tarjetas caen al degradado.
> Las 5 fotos del hero de la portada ya están en `public/hero/` y no hacen
> falta más.
>
> (Nota menor: el comentario de `sport-images.ts` apunta a
> `Por hacer/fotos-por-deporte.md`, que no existe — el archivo es este.)

> 👉 **Para generarlas, usá `prompts-fotos-tarjetas.md`** (2026-08-14): trae
> los 24 prompts de la Tanda 1 ya armados, listos para copiar y pegar uno por
> uno, más qué herramienta conviene y cómo recortar. Este documento queda como
> el "por qué" y la referencia del mecanismo.

## Qué es esto

Son las fotos que van de fondo en la **tarjeta de cada torneo** (la portada,
`/tournaments` y el perfil del organizador) y en el **torneo destacado** de la
portada. Es la misma foto en los dos lugares, recortada distinto.

> ⚠️ **Corregido el 2026-08-14.** Antes acá decía que la foto también salía en
> la "banda superior al abrir el torneo". **Eso ya no es cierto**: verificado
> contra el código, `tournament-detail.tsx` no muestra ninguna foto. De ahí
> salía la regla de "dejar despejado el tercio izquierdo" (para que el título
> se leyera encima), que **ya no aplica**. La regla correcta hoy es **acción
> centrada con aire a los dos lados**, porque el destacado recorta 15-20% de
> cada borde. Ver `prompts-fotos-tarjetas.md`.

**No confundir con las del hero**, que son las del banner grande de la
portada: esas ya están (volleyball, fútbol, béisbol, softball, microfútbol) y
se decidió no generar más.

## Cómo funciona hoy

Cuando existan los archivos, sumar una foto es:

1. Poner el `.jpg` en `public/sports/`.
2. Agregar su entrada en `SPORT_IMAGES` de `src/data/sport-images.ts`.

Nada más — ningún componente cambia. Mientras la lista de un deporte esté
vacía, la tarjeta usa el degradado de ese deporte y no se rompe nada.

Cada entrada tiene esta forma:

```ts
volleyball: [
  { key: "volleyball-fem-1", file: "volleyball-fem-1.jpg",
    label: "Remate femenino", category: "femenino" },
],
```

- `key` es lo que se guarda en la base (`tournaments.card_image`). **No se
  puede cambiar** una vez que un organizador la eligió, o su torneo vuelve al
  degradado.
- `category` es `general` | `masculino` | `femenino` | `infantil`. Agrupa el
  selector que ve el organizador.

El organizador elige la suya en **Configurar torneo → Información → Foto de
la tarjeta**. Si no elige, el sistema reparte por turnos dentro del deporte
para que dos torneos vecinos nunca muestren la misma.

---

## Cuánto material

11 deportes: futbol, futsal, microfutbol, beisbol, softball, wiffleball,
volleyball, basketball, padel, ping-pong, tenis.

**No hacen falta 4-5 × 11 × 4 categorías** — eso son 200 fotos y la mayoría
no se usaría nunca. El catálogo real está muy desbalanceado: de 21 torneos,
10 son de volleyball, 4 de béisbol, 3 de fútbol, 3 de softball y 1 de
microfútbol.

> ⚠️ **El reparto de abajo quedó obsoleto el 2026-08-14.** El organizador
> pidió otras categorías (volley playa, mamás, padres, jóvenes, mixtos) y el
> plan se rehízo a **26 fotos**. El reparto vigente, con nombres de archivo y
> prompts, está en **`prompts-fotos-tarjetas.md`**. Se deja lo de abajo solo
> como registro de lo que se pensó primero.

### ~~Tanda 1~~ (obsoleto — ver `prompts-fotos-tarjetas.md`)

| Deporte | General | Masculino | Femenino | Infantil | Total |
|---|---|---|---|---|---|
| volleyball | 2 | 2 | 2 | 2 | **8** |
| beisbol | 1 | 1 | — | 2 | **4** |
| futbol | 1 | 2 | 1 | 1 | **5** |
| softball | 1 | 1 | 2 | — | **4** |
| microfutbol | 1 | 1 | — | 1 | **3** |

### ~~Tanda 2~~ (obsoleto)

futsal, wiffleball, basketball, padel, ping-pong, tenis: **2 cada uno**
(1 general + 1 infantil).

---

## Requisitos técnicos

| | |
|---|---|
| Proporción | **8:3** (así se recorta la tarjeta) |
| Tamaño | 1200 × 450 px |
| Formato | JPG |
| Peso | Yo las comprimo — mandalas como salgan |

Generá directamente en 8:3, no en 16:9 para recortar después: recortando se
pierden cabezas y pies.

---

## El bloque de estilo (va en TODOS los prompts)

Esto es lo que hace que las fotos parezcan de la misma familia. Copialo igual
en cada prompt y cambiá solo la parte de la acción.

```
Fotografía deportiva editorial, ultra realista, horizontal panorámica 8:3.
Estadio o cancha con público desenfocado al fondo (bokeh marcado, poca
profundidad de campo). Luz de día difusa y brillante, cielo claro. Paleta
fría de azules y blancos con un acento cálido tenue; ligeramente
desaturada, no colores saturados. Contraste suave, sin sombras duras.
Uniformes lisos, SIN escudos, SIN números legibles, SIN nombres, SIN marcas.
Sin texto de ningún tipo, sin logos, sin marcas de agua.
Personas de rasgos latinoamericanos, no reconocibles, sin parecido a
ninguna persona famosa.
La acción va centrada, con aire a los dos lados: nada importante en el 20%
del borde izquierdo ni en el 20% del derecho.
```

**Negativos** (si el generador los acepta):

```
sin texto, sin letras, sin números grandes, sin logos, sin marcas de agua,
sin collage, sin bordes, sin marco, sin firma, sin manos deformes,
sin dedos de más, sin cuerpos incompletos
```

### Por qué cada regla

- **8:3 panorámica** — es como recorta la tarjeta.
- **Acción centrada con aire a los lados** — la misma foto se usa en el
  torneo destacado, que la recorta 15-20% por cada borde. Lo que sobrevive
  siempre es el centro.
- **Uniformes lisos sin escudos** — la foto se repite en torneos de
  organizadores distintos; un escudo inventado confunde. Además los kits
  reales son marca registrada.
- **Sin texto** — encima va el degradado con los chips de deporte y estado.
  Ojo con la publicidad de las gradas: los generadores la meten sola.
- **Paleta fría y desaturada** — es lo que unifica el set. La excepción son
  béisbol y softball, que van nocturnos y cálidos a propósito.

---

## Volleyball (8 fotos — el deporte con más torneos)

Con 10 torneos de volley, repetir imagen se lee como error de carga.

| key | categoría | Acción |
|---|---|---|
| `volleyball-gen-1` | general | `Un balón de voleibol en el aire junto a la red, vista desde la cancha, gradas desenfocadas detrás.` |
| `volleyball-gen-2` | general | `Plano general de una cancha de voleibol al aire libre durante un punto, jugadores pequeños en el encuadre, red nítida en primer plano.` |
| `volleyball-fem-1` | femenino | `Una jugadora recibiendo el balón de abajo con los antebrazos, agachada y concentrada, el balón entrando por la izquierda del encuadre.` |
| `volleyball-fem-2` | femenino | `Un equipo femenino celebrando un punto, brazos arriba, sonrisas, agrupadas en el centro derecha.` |
| `volleyball-masc-1` | masculino | `Un jugador rematando en salto por encima de la red, brazo extendido, el balón a punto de ser golpeado.` |
| `volleyball-masc-2` | masculino | `Dos jugadores bloqueando en la red con las manos arriba mientras un tercero remata del otro lado.` |
| `volleyball-inf-1` | infantil | `Niños de 10 a 12 años jugando voleibol en una cancha, uno golpeando el balón, los demás atentos.` |
| `volleyball-inf-2` | infantil | `Un grupo de niños de 10 a 12 años en ronda alrededor de un entrenador junto a la red, escuchando indicaciones.` |

## Béisbol (4 fotos — nocturno cálido)

Reemplazá en el bloque de estilo la línea de luz por:

```
Nocturno bajo las torres de luz del estadio, halos cálidos dorados,
fondo oscuro, siluetas recortadas por la luz de atrás.
```

| key | categoría | Acción |
|---|---|---|
| `beisbol-gen-1` | general | `Un bate y una pelota de béisbol en el momento del contacto, chispas de tierra, plano medio.` |
| `beisbol-masc-1` | masculino | `Un bateador en posición de swing esperando el lanzamiento, visto de perfil.` |
| `beisbol-inf-1` | infantil | `Un niño de 9 a 11 años bateando en un campo de béisbol, casco puesto, con el equipo detrás.` |
| `beisbol-inf-2` | infantil | `Un niño de 9 a 11 años lanzando desde el montículo, brazo atrás, concentrado.` |

## Fútbol (5 fotos)

| key | categoría | Acción |
|---|---|---|
| `futbol-gen-1` | general | `Primer plano bajo de un balón de fútbol sobre el césped junto a los pies de un jugador que va a patearlo, cámara a ras de suelo.` |
| `futbol-masc-1` | masculino | `Un jugador conduciendo el balón a toda velocidad, cuerpo inclinado, césped levantándose.` |
| `futbol-masc-2` | masculino | `Un arquero estirado en el aire desviando un balón, plano lateral.` |
| `futbol-fem-1` | femenino | `Una jugadora rematando de derecha al arco, pierna extendida.` |
| `futbol-inf-1` | infantil | `Niños de 8 a 11 años disputando el balón en una cancha de fútbol, uniformes lisos.` |

## Softball (4 fotos — nocturno cálido, igual que béisbol)

| key | categoría | Acción |
|---|---|---|
| `softball-gen-1` | general | `Un guante de softbol atrapando la pelota, primer plano, polvo en el aire.` |
| `softball-fem-1` | femenino | `Una lanzadora de softbol en el movimiento de molinete, brazo abajo a punto de soltar la pelota.` |
| `softball-fem-2` | femenino | `Una bateadora de softbol siguiendo con la mirada la pelota que acaba de golpear.` |
| `softball-masc-1` | masculino | `Un jugador de softbol deslizándose hacia la base mientras llega la pelota.` |

## Microfútbol (3 fotos — cancha techada)

Cambiá la línea de luz del bloque de estilo por:

```
Cancha techada de piso sintético, luz de galpón deportivo pareja, líneas
del piso visibles.
```

| key | categoría | Acción |
|---|---|---|
| `microfutbol-gen-1` | general | `Un balón de microfútbol en el piso de una cancha techada junto a las líneas del área.` |
| `microfutbol-masc-1` | masculino | `Dos jugadores disputando el balón en una cancha techada de microfútbol.` |
| `microfutbol-inf-1` | infantil | `Niños de 8 a 11 años jugando microfútbol en una cancha techada.` |

## Tanda 2 — el resto (2 por deporte, 1 general + 1 infantil)

Mismo bloque de estilo. La acción, en una línea cada una:

- **futsal**: `un balón de futsal frenado bajo la suela de un jugador en cancha techada` / `niños de 8 a 11 años jugando futsal`
- **wiffleball**: `un bate plástico golpeando una pelota perforada en un campo abierto` / `niños de 8 a 11 años jugando wiffleball`
- **basketball**: `un jugador entrando a canasta en bandeja, balón en la mano` / `niños de 10 a 12 años jugando baloncesto`
- **padel**: `un jugador de pádel golpeando de revés junto a la pared de vidrio` / `niños de 10 a 12 años jugando pádel`
- **ping-pong**: `primer plano de una paleta golpeando la pelota sobre la mesa` / `niños de 9 a 12 años jugando tenis de mesa`
- **tenis**: `un jugador sirviendo, pelota en el aire sobre la cabeza` / `niños de 9 a 12 años jugando tenis`

---

## Cómo revisar lo generado

Antes de sumar una foto, mirala **en miniatura al tamaño real de la tarjeta
(~245 px de ancho)**. Ahí se cae la mayoría:

- ¿Se entiende **qué deporte es** a ese tamaño?
- ¿Se entiende **la categoría** (que son niños, que son mujeres)?
- ¿El tercio izquierdo queda lo bastante limpio para que el título de la
  banda del torneo se lea encima?
- ¿Quedó texto o algún logo inventado? Los generadores los meten solos en
  camisetas y en la publicidad de las gradas.
- ¿Manos y dedos correctos?

## Cuando las tengas

1. Guardalas en `public/sports/` con el nombre de su `key` + `.jpg`.
2. Avisame y yo escribo las entradas en `SPORT_IMAGES` y las comprimo.

**No hace falta generarlas todas de una.** Con 2 o 3 de volleyball ya se ve
el selector funcionando y podés juzgar si el estilo va bien antes de seguir.
