# Prompts listos para generar las fotos de las tarjetas

Compañero de `fotos-de-tarjetas.md`. Ese explica **por qué**; este trae los
prompts de **las fotos que todavía faltan**, listos para copiar y pegar.

Los prompts de las que ya están generadas salieron de acá y viven en
**`prompts-fotos-tarjetas-hechos.md`**, por si alguna hay que rehacerla.

**Estado al 2026-08-15:** hay **33 fotos generadas y funcionando en
producción**, y **todos los torneos activos tienen la suya**. Lo único que
falta son las **8 de baloncesto**.

| Deporte | Fotos | Urgencia |
|---|---|---|
| **Baloncesto** | 8 | Ninguna — no hay ni un torneo de baloncesto todavía |

Esto ya no bloquea nada. Son para cuando aparezca el primer torneo de
baloncesto, o si querés adelantarlas.

---

## Antes de empezar — lee esto una vez

### Cuál herramienta usar

| | Nano Banana (Gemini) | ChatGPT |
|---|---|---|
| Qué tan ancho genera | Hasta **21:9** — casi lo que necesitamos | Máximo **3:2**, mucho más cuadrado |
| Recorte hasta 8:3 | Pierde una franja finita arriba y abajo | Pierde **casi la mitad** de alto |
| Veredicto | **Usa esta como principal** | Solo si Nano Banana no te da la foto |

Los prompts sirven para las dos. Si usas ChatGPT, agrégale la línea extra que
está al final de esta sección.

Si la herramienta te deja **elegir** la proporción en un menú, elige la más
ancha que tenga y no te preocupes por lo que diga el prompt.

### La misma foto se usa en tres tamaños distintos

Esto es lo que manda en la composición. Verificado contra el código el
2026-08-14.

| Dónde | Forma | Qué le pasa a la foto |
|---|---|---|
| **Tarjeta normal** (portada, `/tournaments`, perfil) | Franja ancha 8:3 | Se ve **completa**, no se corta nada |
| **Destacado, en computador** | Panel vertical al lado del texto | Se recorta **de los lados**, sobrevive el centro |
| **Destacado, en celular** | Más cuadrada (16:9) | Se recorta **de los lados**, sobrevive el centro |

Conclusión práctica: **una sola foto sirve para los tres**, siempre que la
acción esté en el **centro**. Lo que se pierde en el destacado son los bordes
izquierdo y derecho, más o menos un 15-20% de cada lado.

No hay que generar nada aparte para los destacados.

### Los colores de los equipos, y de qué lado va cada uno

Dos reglas nuevas (2026-08-15), después de ver que todas las fotos salían con
un equipo de blanco y otro de azul:

**1. Cada foto lleva su propio par de colores.** Ninguna repite el par de otra.
Van escritos dentro de cada prompt, no hay que inventarlos.

**2. Un color de cada lado de la red.** El equipo de un color va completo de un
lado, el otro completo del lado contrario. Ningún jugador de un color aparece
mezclado en el campo del rival. Suena obvio, pero los generadores mezclan los
uniformes todo el tiempo si no se les dice.

> ⚠️ **Cambio en la regla de color del documento viejo.** Antes todos los
> prompts pedían *"paleta fría de azules y blancos"*, y eso era exactamente lo
> que hacía que todos los uniformes salieran iguales. Ya no se pide.
>
> Lo que unifica el set ahora es **la luz y el revelado** — desaturado suave,
> contraste bajo, fondo desenfocado — no el color de la ropa. Los uniformes
> son libres y variados a propósito.

### Lo que hay que hacer con cada foto que salga

1. **Míralas chiquitas antes de aceptarlas.** Achica la ventana hasta que la
   foto mida como 3 cm de ancho — así se ve en la tarjeta. Si a ese tamaño no
   se entiende qué deporte es, no sirve por linda que sea.
2. **Recórtala a 8:3** (por ejemplo 1200 × 450 px), quitando parejo de arriba
   y de abajo.
3. **Guárdala con el nombre exacto** de la tabla de más abajo.
4. Mándamelas y yo las conecto y las comprimo.

### Qué revisar en cada una

- ¿Se entiende el deporte en miniatura?
- ¿Se entiende **la edad y el género**? Esto es lo más difícil de todo el set:
  a 3 cm de ancho, un joven de 20 y un señor de 45 se ven igual si no hay
  pistas claras. Si no distingues la categoría, esa foto no cumple su trabajo.
- **Tapá con el dedo un 20% de cada lado.** Lo que queda es lo que se ve en el
  destacado. ¿Se sigue entendiendo? Si la acción quedó cortada, no sirve.
- ¿La franja de arriba quedó tranquila? Ahí van los chips de deporte y estado.
- ¿Se coló texto, logo o publicidad en las gradas? Los generadores los meten
  solos.
- ¿Manos y dedos correctos?

### Por dónde arrancar

No hay apuro. Si las hacés, arrancá por la **callejera (3x3)** y la de
**niños**: son las dos más distintas entre sí y sirven para juzgar si el
estilo sigue funcionando.

### Si usas ChatGPT

Agrégale esta línea al final de cualquier prompt:

```
Composición pensada para recortarse después a una franja horizontal muy ancha:
deja aire de sobra arriba y abajo, y mantén toda la acción, las cabezas y los
pies dentro de la franja central del encuadre.
```

---

## Las 8 fotos que faltan

El nombre importa: es lo que el sistema busca. Guardalas **exactamente** así.

| # | Archivo | Grupo | Cómo lo ve el organizador |
|---|---|---|---|
| 28 | `basketball-calle-1.jpg` | General | Callejero |
| 29 | `basketball-inf-1.jpg` | Infantil | Niños |
| 30 | `basketball-inf-2.jpg` | Infantil | Niñas |
| 31 | `basketball-jov-masc-1.jpg` | Masculino | Jóvenes |
| 32 | `basketball-jov-fem-1.jpg` | Femenino | Jóvenes |
| 33 | `basketball-mixto-1.jpg` | General | Mixto |
| 34 | `basketball-masc-1.jpg` | Masculino | Adultos |
| 35 | `basketball-fem-1.jpg` | Femenino | Adultas |

> Los números (28-35) son los que tenían dentro del set completo de 38. Se
> dejan igual para que coincidan con los prompts ya usados, guardados en
> `prompts-fotos-tarjetas-hechos.md`.

### Las edades, para que sean consistentes en todo el set

| Palabra | Edad que le pido al generador |
|---|---|
| Niños / Niñas | 9 a 12 años |
| Jóvenes | 17 a 22 años |
| Masculino / Femenino (softball, micro, futsal) | 28 a 40 años |
| Adultos / Mamás / Padres | 38 a 50 años, contextura de gente que juega recreativo |

---

# BALONCESTO — 8 fotos

> Armado igual que volleyball: **8 fotos, ocho ángulos, ocho jugadas, ocho
> pares de colores.** A las seis categorías de siempre se les sumaron dos que
> son el equivalente de "volley playa" y "mixto":
>
> - **Callejero (3x3)** — el basket de barrio, en placa de cemento. Es la que
>   más se sale del molde y le da aire al set.
> - **Mixto** — hombres y mujeres en el mismo equipo.
>
> **Acá tampoco hay red.** Los dos equipos comparten la cancha, así que la
> regla de color es: cada jugador lleva el color de su equipo y no hay ninguna
> mezcla — a simple vista se ve quién es de cada bando.

| # | Foto | Ángulo de cámara | Jugada | Colores |
|---|---|---|---|---|
| 28 | Callejero | Lateral desde la calle, altura de la cintura | Uno contra uno atacando el aro | Rojo tomate vs gris humo |
| 29 | Niños | Contrapicado junto al aro | Lanzamiento a dos manos desde el pecho | Azul denim vs amarillo curry |
| 30 | Niñas | Frontal, teleobjetivo corto | Dribbling protegiendo el balón | Rosa chicle vs verde musgo |
| 31 | Jóvenes (h) | Desde detrás del tablero, por la red del aro | Tapa en el momento del tiro | Morado uva vs verde aguacate |
| 32 | Jóvenes (m) | Contrapicado desde la línea de fondo | Triple en suspensión | Azul hielo vs marrón canela |
| 33 | Mixto | Picado alto desde la grada | Pase picado y corte a recibir | Naranja melón vs azul prusia |
| 34 | Adultos | Frontal desde el aro contrario, teleobjetivo | Tiro libre con la zona ocupada | Amarillo trigo vs verde selva |
| 35 | Adultas | Seguimiento lateral en paneo | Entrada a canasta en bandeja | Morado malva vs azul turquí |

## 28 · `basketball-calle-1.jpg` — Callejero (3x3)

```
Fotografía deportiva editorial, ultrarrealista, encuadre horizontal panorámico
muy ancho, proporción 8:3.

LA JUGADA: un uno contra uno callejero. El atacante baja el hombro y ataca el
aro con el balón protegido a la cadera, mientras el defensor desliza los pies
de costado con los brazos abiertos. Cuatro jugadores más esperan alrededor.

EL ÁNGULO: toma lateral amplia desde la calle, la cámara a la altura de la
cintura, con las casas del barrio y el tablero entrando por el costado.

LOS COLORES: el atacante y su trío visten ROJO TOMATE; el defensor y su trío
visten GRIS HUMO. Cada jugador lleva el color de su equipo, no hay ninguna
mezcla.

ESCENARIO: cancha callejera de barrio. Placa de cemento agrietado con las
líneas pintadas descoloridas, un solo tablero de metal gastado con el aro sin
red o con red de cadena, malla de alambre en un costado y casas de ladrillo
alrededor. Nada de coliseo ni de piso de madera.

Media tarde, sol alto filtrándose entre los árboles, sombras suaves en el
cemento. Fondo desenfocado con bokeh marcado y poca profundidad de campo.
Colores ligeramente desaturados y contraste suave: aspecto de fotografía
editorial real, no de colores saturados de videojuego.

Ropa deportiva de color liso y plano, sin escudos, sin números, sin nombres,
sin marcas. Muros, malla y tablero completamente limpios, sin publicidad ni
grafitis con letras. Hombres jóvenes de 18 a 30 años, de rasgos
latinoamericanos, anónimos, sin parecido a ninguna persona famosa.

La acción va CENTRADA en el encuadre, con aire a los dos lados: nada
importante en el 20% del borde izquierdo ni en el 20% del borde derecho,
porque esos bordes se recortan. La franja de arriba queda tranquila, sin
detalles importantes.

Imagen limpia: sin texto de ningún tipo, sin letras, sin números grandes, sin
logotipos, sin marcas de agua, sin bordes ni marco, sin firma. Manos y dedos
anatómicamente correctos, cuerpos completos.
```

## 29 · `basketball-inf-1.jpg` — Niños

```
Fotografía deportiva editorial, ultrarrealista, encuadre horizontal panorámico
muy ancho, proporción 8:3.

LA JUGADA: un niño lanza al aro con las dos manos desde el pecho, empujando
con todo el cuerpo porque el aro le queda alto; el balón acaba de salir de sus
manos y sus compañeros miran hacia arriba siguiéndolo.

EL ÁNGULO: contrapicado desde el piso junto al poste del aro, la cámara
mirando hacia arriba, de modo que el niño y el tablero se recortan contra el
techo iluminado.

LOS COLORES: el que lanza y su equipo visten AZUL DENIM; el equipo rival viste
AMARILLO CURRY. Cada jugador lleva el color de su equipo, no hay ninguna
mezcla.

ESCENARIO: coliseo pequeño techado de barrio o de colegio, piso de cemento
pintado o madera gastada, líneas de la cancha bien marcadas, gradas bajas con
pocas personas. Luz artificial pareja del techo.

Fondo desenfocado con bokeh marcado y poca profundidad de campo. Colores
ligeramente desaturados y contraste suave, sin sombras duras: aspecto de
fotografía editorial real, no de colores saturados de videojuego.

Uniformes y tenis de color liso y plano, sin escudos, sin números, sin
nombres, sin marcas. Paredes y gradas completamente limpias, sin publicidad ni
carteles. Niños de 9 a 12 años, de rasgos latinoamericanos, anónimos, sin
parecido a ninguna persona real. Que se lea con total claridad que son niños:
estatura muy baja frente al aro, proporciones infantiles, uniformes holgados.

La acción va CENTRADA en el encuadre, con aire a los dos lados: nada
importante en el 20% del borde izquierdo ni en el 20% del borde derecho,
porque esos bordes se recortan. La franja de arriba queda tranquila, sin
detalles importantes.

Imagen limpia: sin texto de ningún tipo, sin letras, sin números grandes, sin
logotipos, sin marcas de agua, sin bordes ni marco, sin firma. Manos y dedos
anatómicamente correctos, cuerpos completos.
```

## 30 · `basketball-inf-2.jpg` — Niñas

```
Fotografía deportiva editorial, ultrarrealista, encuadre horizontal panorámico
muy ancho, proporción 8:3.

LA JUGADA: una niña dribla protegiendo el balón con el cuerpo y el brazo libre
extendido, mientras otra se le agacha enfrente con las manos abajo intentando
robárselo.

EL ÁNGULO: frontal a la altura de la cintura con teleobjetivo corto, siguiendo
el dribbling — el balón queda grande en primer plano y las dos caras nítidas
detrás.

LOS COLORES: la que dribla y su equipo visten ROSA CHICLE; la que marca y su
equipo visten VERDE MUSGO. Cada jugadora lleva el color de su equipo, no hay
ninguna mezcla.

ESCENARIO: cancha techada de colegio, piso de cemento pintado, líneas de la
cancha bien marcadas, gradas bajas con pocas personas. Luz artificial pareja
del techo.

Fondo desenfocado con bokeh marcado y poca profundidad de campo. Colores
ligeramente desaturados y contraste suave, sin sombras duras: aspecto de
fotografía editorial real, no de colores saturados de videojuego.

Uniformes y tenis de color liso y plano, sin escudos, sin números, sin
nombres, sin marcas. Paredes y gradas completamente limpias, sin publicidad ni
carteles. Niñas de 9 a 12 años, de rasgos latinoamericanos, anónimas, sin
parecido a ninguna persona real. Que se lea con total claridad que son niñas:
estatura muy baja frente al aro, proporciones infantiles, pelo recogido.

La acción va CENTRADA en el encuadre, con aire a los dos lados: nada
importante en el 20% del borde izquierdo ni en el 20% del borde derecho,
porque esos bordes se recortan. La franja de arriba queda tranquila, sin
detalles importantes.

Imagen limpia: sin texto de ningún tipo, sin letras, sin números grandes, sin
logotipos, sin marcas de agua, sin bordes ni marco, sin firma. Manos y dedos
anatómicamente correctos, cuerpos completos.
```

## 31 · `basketball-jov-masc-1.jpg` — Jóvenes (hombres)

```
Fotografía deportiva editorial, ultrarrealista, encuadre horizontal panorámico
muy ancho, proporción 8:3.

LA JUGADA: una tapa. Un jugador salta y manotea el balón justo en el momento
en que el rival lo suelta para tirar; los dos cuerpos estirados al máximo, el
balón desviándose hacia un costado.

EL ÁNGULO: cámara montada detrás del tablero, mirando hacia abajo a través del
aro y de la red — se ve el borde del aro desenfocado en primer plano y los dos
jugadores debajo.

LOS COLORES: el que tapa y su equipo visten MORADO UVA; el que tira y su
equipo visten VERDE AGUACATE. Cada jugador lleva el color de su equipo, no hay
ninguna mezcla.

ESCENARIO: coliseo pequeño techado, piso de madera gastada, líneas de la
cancha bien marcadas, gradas bajas con público moderado. Luz artificial pareja
del techo.

Fondo desenfocado con bokeh marcado y poca profundidad de campo. Colores
ligeramente desaturados y contraste suave, sin sombras duras: aspecto de
fotografía editorial real, no de colores saturados de videojuego.

Uniformes y tenis de color liso y plano, sin escudos, sin números, sin
nombres, sin marcas. Paredes y gradas completamente limpias, sin publicidad ni
carteles. Hombres jóvenes de 17 a 22 años, de rasgos latinoamericanos,
anónimos, sin parecido a ninguna persona famosa. Que se lea con claridad que
son jóvenes: contextura delgada y atlética, rostros sin marcas de edad.

La acción va CENTRADA en el encuadre, con aire a los dos lados: nada
importante en el 20% del borde izquierdo ni en el 20% del borde derecho,
porque esos bordes se recortan. La franja de arriba queda tranquila, sin
detalles importantes.

Imagen limpia: sin texto de ningún tipo, sin letras, sin números grandes, sin
logotipos, sin marcas de agua, sin bordes ni marco, sin firma. Manos y dedos
anatómicamente correctos, cuerpos completos.
```

## 32 · `basketball-jov-fem-1.jpg` — Jóvenes (mujeres)

```
Fotografía deportiva editorial, ultrarrealista, encuadre horizontal panorámico
muy ancho, proporción 8:3.

LA JUGADA: un triple en suspensión. La jugadora está en el aire con los dos
pies despegados, el brazo estirado hacia arriba y la muñeca quebrada después
de soltar el balón; la defensora salta tarde a su lado.

EL ÁNGULO: contrapicado desde la línea de fondo, la cámara baja mirando hacia
arriba, de modo que la jugadora se recorta contra las lámparas del techo.

LOS COLORES: la que tira y su equipo visten AZUL HIELO; la defensora y su
equipo visten MARRÓN CANELA. Cada jugadora lleva el color de su equipo, no hay
ninguna mezcla.

ESCENARIO: coliseo pequeño techado, piso de madera gastada, líneas de la
cancha bien marcadas, gradas bajas con público moderado. Luz artificial pareja
del techo.

Fondo desenfocado con bokeh marcado y poca profundidad de campo. Colores
ligeramente desaturados y contraste suave, sin sombras duras: aspecto de
fotografía editorial real, no de colores saturados de videojuego.

Uniformes y tenis de color liso y plano, sin escudos, sin números, sin
nombres, sin marcas. Paredes y gradas completamente limpias, sin publicidad ni
carteles. Mujeres jóvenes de 17 a 22 años, de rasgos latinoamericanos,
anónimas, sin parecido a ninguna persona famosa. Que se lea con claridad que
son jóvenes: contextura delgada y atlética, rostros sin marcas de edad.

La acción va CENTRADA en el encuadre, con aire a los dos lados: nada
importante en el 20% del borde izquierdo ni en el 20% del borde derecho,
porque esos bordes se recortan. La franja de arriba queda tranquila, sin
detalles importantes.

Imagen limpia: sin texto de ningún tipo, sin letras, sin números grandes, sin
logotipos, sin marcas de agua, sin bordes ni marco, sin firma. Manos y dedos
anatómicamente correctos, cuerpos completos.
```

## 33 · `basketball-mixto-1.jpg` — Mixto

```
Fotografía deportiva editorial, ultrarrealista, encuadre horizontal panorámico
muy ancho, proporción 8:3.

LA JUGADA: un hombre da un pase picado por debajo del brazo del defensor y una
mujer de su mismo equipo corta hacia el aro con las manos listas para recibir.
Se ve con claridad que hombres y mujeres juegan en el mismo equipo y con el
mismo uniforme.

EL ÁNGULO: picado alto desde la grada, la cámara arriba mirando en diagonal,
de modo que se ve media cancha con las líneas del piso dibujando la
perspectiva y el recorrido del pase.

LOS COLORES: el equipo mixto viste NARANJA MELÓN; el equipo rival viste AZUL
PRUSIA. Cada jugador lleva el color de su equipo, no hay ninguna mezcla.

ESCENARIO: cancha techada de barrio, piso de cemento pintado, líneas de la
cancha bien marcadas, gradas bajas con poca gente. Luz artificial pareja del
techo.

Fondo desenfocado con bokeh marcado y poca profundidad de campo. Colores
ligeramente desaturados y contraste suave, sin sombras duras: aspecto de
fotografía editorial real, no de colores saturados de videojuego.

Uniformes y tenis de color liso y plano, iguales para hombres y mujeres del
mismo equipo, sin escudos, sin números, sin nombres, sin marcas. Paredes y
gradas completamente limpias, sin publicidad ni carteles. Hombres y mujeres
adultos de 25 a 40 años, de rasgos latinoamericanos, anónimos, sin parecido a
ninguna persona famosa.

La acción va CENTRADA en el encuadre, con aire a los dos lados: nada
importante en el 20% del borde izquierdo ni en el 20% del borde derecho,
porque esos bordes se recortan. La franja de arriba queda tranquila, sin
detalles importantes.

Imagen limpia: sin texto de ningún tipo, sin letras, sin números grandes, sin
logotipos, sin marcas de agua, sin bordes ni marco, sin firma. Manos y dedos
anatómicamente correctos, cuerpos completos.
```

## 34 · `basketball-masc-1.jpg` — Adultos (padres)

```
Fotografía deportiva editorial, ultrarrealista, encuadre horizontal panorámico
muy ancho, proporción 8:3.

LA JUGADA: un tiro libre. El lanzador está solo en la línea con las rodillas
flexionadas y el balón saliendo de sus dedos, mientras los demás jugadores
esperan alineados a los costados de la zona, listos para el rebote.

EL ÁNGULO: frontal desde detrás del aro contrario con teleobjetivo largo, la
cámara a la altura del pecho — toda la zona queda comprimida y el lanzador
nítido en el centro.

LOS COLORES: el que lanza y su equipo visten AMARILLO TRIGO; el equipo rival
que espera el rebote viste VERDE SELVA. Cada jugador lleva el color de su
equipo, no hay ninguna mezcla.

ESCENARIO: coliseo pequeño techado de barrio, piso de cemento pintado, líneas
de la cancha bien marcadas, gradas bajas casi vacías. Luz artificial pareja de
la noche.

Fondo desenfocado con bokeh marcado y poca profundidad de campo. Colores
ligeramente desaturados y contraste suave, sin sombras duras: aspecto de
fotografía editorial real, no de colores saturados de videojuego.

Uniformes y tenis de color liso y plano, sin escudos, sin números, sin
nombres, sin marcas. Paredes y gradas completamente limpias, sin publicidad ni
carteles. Hombres adultos de 38 a 50 años, de rasgos latinoamericanos,
anónimos, sin parecido a ninguna persona famosa. Contextura normal de gente
que juega por recreación, no atletas de élite. Que se lea con claridad que son
señores adultos y no jóvenes: rasgos maduros, algunas canas, entradas en el
pelo.

La acción va CENTRADA en el encuadre, con aire a los dos lados: nada
importante en el 20% del borde izquierdo ni en el 20% del borde derecho,
porque esos bordes se recortan. La franja de arriba queda tranquila, sin
detalles importantes.

Imagen limpia: sin texto de ningún tipo, sin letras, sin números grandes, sin
logotipos, sin marcas de agua, sin bordes ni marco, sin firma. Manos y dedos
anatómicamente correctos, cuerpos completos.
```

## 35 · `basketball-fem-1.jpg` — Adultas (mamás)

```
Fotografía deportiva editorial, ultrarrealista, encuadre horizontal panorámico
muy ancho, proporción 8:3.

LA JUGADA: una entrada a canasta en bandeja. La jugadora despega con la pierna
contraria, sube el balón con una mano y lo protege con la otra, mientras una
rival la persigue medio paso atrás.

EL ÁNGULO: seguimiento lateral en paneo, la cámara a la altura del hombro
acompañando el desplazamiento — el fondo queda barrido por el movimiento y
ella nítida.

LOS COLORES: la que entra al aro y su equipo visten MORADO MALVA; la que
persigue y su equipo visten AZUL TURQUÍ. Cada jugadora lleva el color de su
equipo, no hay ninguna mezcla.

ESCENARIO: cancha techada de barrio, piso de cemento pintado, líneas de la
cancha bien marcadas, gradas bajas con poca gente. Luz de día entrando por los
costados abiertos.

Fondo desenfocado con bokeh marcado y poca profundidad de campo. Colores
ligeramente desaturados y contraste suave, sin sombras duras: aspecto de
fotografía editorial real, no de colores saturados de videojuego.

Uniformes y tenis de color liso y plano, sin escudos, sin números, sin
nombres, sin marcas. Paredes y gradas completamente limpias, sin publicidad ni
carteles. Mujeres adultas de 38 a 50 años, de rasgos latinoamericanos,
anónimas, sin parecido a ninguna persona famosa. Contextura normal de gente
que juega por recreación, no atletas de élite. Que se lea con claridad que son
señoras adultas y no jóvenes: rasgos maduros, algunas canas.

La acción va CENTRADA en el encuadre, con aire a los dos lados: nada
importante en el 20% del borde izquierdo ni en el 20% del borde derecho,
porque esos bordes se recortan. La franja de arriba queda tranquila, sin
detalles importantes.

Imagen limpia: sin texto de ningún tipo, sin letras, sin números grandes, sin
logotipos, sin marcas de agua, sin bordes ni marco, sin firma. Manos y dedos
anatómicamente correctos, cuerpos completos.
```

---

# Si algo sale mal — arreglos rápidos

| Lo que ves | Qué agregarle al prompt |
|---|---|
| **No se distingue la edad** (el joven parece señor, o al revés) | Para jóvenes: `Rostros claramente juveniles, sin arrugas, sin barba, cuerpos delgados de adolescente tardío.` Para adultos: `Rostros claramente maduros de 40 y pico, con arrugas de expresión, canas visibles y contextura de persona que no entrena a diario.` |
| **No se entiende que son niños** | `Los jugadores son claramente niños de estatura baja, con proporciones infantiles y uniformes que les quedan grandes; comparalos con la altura de la red o del aro.` |
| **Mezcló los uniformes** (jugadores de los dos colores del mismo lado) | `Los dos equipos NO se mezclan: todos los de [COLOR A] están de un lado de la red y todos los de [COLOR B] del otro lado. Ni un solo jugador cruzado.` |
| **Micro y futsal salieron iguales** | A micro: `Cancha de placa de cemento con reja metálica alrededor y aros de baloncesto al fondo, con luz natural entrando por los costados abiertos.` A futsal: `Gimnasio cerrado con piso de madera clara y gradas, sin ninguna reja ni aro de baloncesto a la vista.` |
| **En softbol puso los dos colores en el campo** | `En el terreno de juego solo hay jugadores de [COLOR DEFENSA]. Del equipo contrario solo se ve al bateador o al corredor, de [COLOR AL BATE]. Nadie más.` |
| **Ignoró los colores** y volvió a hacer blanco contra azul | `Ningún uniforme es blanco ni azul. Un equipo viste [COLOR A] sólido y el otro [COLOR B] sólido.` |
| **No respetó el ángulo** que le pediste | Ponelo en la PRIMERA línea del prompt, antes de la jugada. El generador le da más peso a lo que va primero. |
| Le metió texto o publicidad en las gradas | `Las gradas y las vallas están completamente vacías y lisas, de un solo color, sin ningún cartel.` |
| Las camisetas salen con escudos o números | `Las camisetas son de un solo color plano, completamente lisas, como una camiseta sin estampar.` |
| Salió muy saturada, tipo videojuego | `Aspecto de fotografía real tomada con cámara réflex, grano fotográfico sutil, colores apagados y naturales.` |
| La acción quedó corrida a un lado | `El sujeto principal está exactamente en el centro del encuadre, con la misma cantidad de espacio vacío a la izquierda y a la derecha.` |
| Se sale de cuadro al recortar los lados | `Plano más abierto, con el sujeto más pequeño y más margen alrededor.` |
| En el mixto no se ve que hay hombres y mujeres | `En el mismo equipo y con el mismo uniforme hay claramente hombres y mujeres, se distinguen a simple vista.` |
| Manos o dedos deformes | Regenerá. No se arregla con prompt — cambiá levemente la acción y volvé a tirar. |

---

# Deportes que quedan sin foto

Wiffleball, pádel, ping-pong y tenis no tienen torneos todavía, así que no
entran en esta tanda. Sus tarjetas siguen con el degradado, que no se ve mal.

Cuando aparezca un torneo de alguno, usá cualquier prompt de arriba como molde
y cambiale solo el párrafo de la acción:

| Deporte | Acción | Escenario a usar |
|---|---|---|
| wiffleball | `Un bate plástico golpeando una pelota perforada en un campo abierto.` | Día |
| padel | `Un jugador de pádel golpeando de revés junto a la pared de vidrio.` | Día |
| ping-pong | `Primer plano de una paleta golpeando la pelota sobre la mesa.` | Techada |
| tenis | `Un jugador sirviendo, con la pelota en el aire sobre su cabeza.` | Día |
