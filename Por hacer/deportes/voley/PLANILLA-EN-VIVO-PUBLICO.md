# El marcador en vivo, para el público

**Estado:** **construido el 2026-09-16, falta correr el SQL y probarlo en una
cancha.** La planilla manda la foto (`use-mandar-en-vivo.ts`), el servidor la
guarda en `match_live_scores` y la página la muestra (`en-vivo.tsx`,
`en-vivo-hoja.tsx`, `use-en-vivo.ts`). Antes de desplegar hay que correr
`supabase/migrations/20260916_marcador_en_vivo.sql`. Con `?envivo=demo`, fuera
de producción, se ve con marcadores inventados.
**Maquetas:** `planilla-en-vivo-propuesta/envivo.html` (se abre en el navegador
y funciona: el aviso abre la hoja y los patrocinadores rotan; con `?rapido=1`
rotan cada 3 segundos para ver el ciclo) y sus capturas `envivo-aviso.png`,
`envivo-hoja.png` y `envivo-escritorio.png`. `hoy.png` es la idea vieja,
descartada.

**Ojo con el nombre.** Este documento NO es `planilla-en-vivo-volley.md`. Ese es
la planilla que usa **la mesa**, y ya está construida. Este es lo que ve **el
público** mientras esa planilla se está llevando.

Esta versión reemplaza la primera, que se escribió antes de hablarlo. Varias
cosas de aquella estaban mal y están corregidas acá — sobre todo el motivo por el
que esto vale la pena.

---

## 1. Para qué sirve

**Para que alguien sepa si ya tiene que ir saliendo para la cancha.**

Es del dueño, y es mejor que lo que decía la primera versión. El que abre el link
un sábado a mediodía no está buscando entretenimiento: está buscando saber si el
partido de antes del suyo ya terminó, o cuánto le falta.

Eso cambia qué hay que mostrar:

- **El marcador exacto importa poco.** A un papá le da igual 14–11 que 15–11.
- **El set importa mucho.** "Van 1–0 y el set 2 va por la mitad" le dice que
  faltan unos 25 minutos. Eso es lo que necesita.
- **Y lo que más importa: que se note que TODAVÍA se está jugando.** Si el último
  dato es de hace veinte minutos, no puede distinguir "sigue" de "terminó y nadie
  actualizó" — y ahí la pantalla no sirve para lo único que la abrió.

### Lo que NO es: un truco para más visitas

La primera versión insinuaba que esto trae más visitas y por lo tanto más plata.
**Es falso, y conviene tenerlo claro.**

El reparto se paga por **persona-día**: un punto por cada combinación de persona
y día, y *"cuántas veces entró ese día no importa"*
(`como-funciona-el-reparto.md`). El que hoy entra una vez y con esto entra treinta
sigue valiendo **uno**.

Puede haber un efecto de rebote —alguien que hoy solo entra el domingo a ver
resultados, con esto entra también el sábado, y eso sí son dos personas-día— pero
el dueño fue claro: **eso no es lo relevante.** Se construye porque es un gancho
útil, no porque pague. Si alguna vez hay que justificarlo con plata, que sea con
ese rebote y no con las visitas.

---

## 2. Qué ve el que entra: un aviso EN VIVO y una hoja

**Cambió el 2026-09-16, y el dueño lo aprobó viéndolo en local, en celular y en
escritorio.** La primera idea era un bloque "Hoy" con todos los partidos del día
(terminó / en vivo / falta). Se descartó: para ver resultados y partidos por
jugar ya está la pestaña Calendario, y lo nuevo es solo lo que está pasando
ahora.

1. **Al cargar la página del torneo**, debajo de la información del torneo y
   antes de los patrocinadores, un aviso rojo: "● EN VIVO · 4 partidos
   jugándose ahora · Ver marcadores →".
2. **Al tocarlo** sube una hoja desde abajo:
   - **Arriba, fijos, los patrocinadores del torneo** (si son muchos se deslizan
     de lado).
   - **Abajo, con scroll**, una tarjeta por partido: hora y cancha, los dos
     equipos con escudo, los sets ganados grandes, el set que se juega
     ("Set 2, jugándose 14 – 11") y "Actualizado hace 1 minuto".
   - **Al final**, "Actualizar".
En celular la hoja sube desde abajo y ocupa casi toda la pantalla; en
escritorio queda centrada, angosta, sobre la página oscurecida.

3. **Si no hay ningún partido con planilla en vivo, el aviso no aparece** y la
   página queda igual que hoy. Sin planilla no hay de dónde sacar el marcador.

**Decisiones del dueño, 2026-09-16:**

- **Solo vóley por ahora.** Cuando exista la planilla de softbol se mira si
  entra; a futuro, todos los deportes que tengan planilla.
- **Día sin partidos en vivo: no se muestra nada.** Las fechas futuras están en
  Calendario.

---

## 3. "EN VIVO" lo decide el reloj, no el partido

Fue una idea del dueño y es la que sostiene todo lo demás: **no mostrar nada en
vivo si no sabemos que la planilla está hablando de verdad.**

El dato que se guarda no es "este partido está en vivo", es **cuándo fue la
última vez que la planilla habló**. La pantalla decide sola:

**Señal inestable** (dueño, 2026-09-16): el marcador va apareciendo a medida
que la señal deja salir los envíos. Como cada envío es la foto completa, el que
logra salir pone todo al día. Y **cuando vuelve la señal, la planilla manda en
ese momento**, sin esperar a que se cumplan los 30 segundos.

| Última señal | Qué se ve |
|---|---|
| Hace **5 minutos o menos** | El partido está en la hoja, con su marcador y "Actualizado hace X" |
| Hace **más de 5 minutos** | **Sale de la hoja.** Si era el único, el aviso EN VIVO desaparece |
| **Vuelve a llegar un envío** (por ejemplo al minuto 8) | **Vuelve a la hoja** como cualquier otro, con el marcador al día |
| Nunca | **Nada.** La página queda igual que hoy |

**5 minutos y no 10** (dueño, 2026-09-16): con 10 un partido sin señal se
queda mucho rato mostrando un marcador viejo. Con 5 sale rápido, y como vuelve
solo apenas llega un envío, la señal inestable no se pierde: solo desaparece
mientras no hay dato fresco.

El último caso es el importante: **si la mesa no tiene señal, el público no ve
una función rota — ve la página de siempre.** No hay nada peor que un cartel de
EN VIVO congelado.

Para que el reloj no mienta, **la planilla manda aunque no pase nada**. Si el set
está trabado 20–20 y no se mueve en tres minutos, igual manda: "sigo acá, sigue
20–20". Sin eso, un partido peleado se ve muerto.

Dos reglas que no se negocian:

- **Si el navegador sabe que no hay señal, ni se intenta.** No tiene sentido
  reventar treinta pedidos contra la nada.
- **Esto nunca puede frenar a la mesa.** Se dispara y se olvida. Si el servidor
  tarda ocho segundos, el botón de punto sigue respondiendo al instante.

**Sobre la señal:** el dueño confirmó que en la mayoría de las canchas hay. O sea
que esto va a funcionar casi siempre, y cuando no, se degrada sin ensuciar nada.

---

## 4. Cuándo manda la planilla

**Cambió el 2026-09-16: por tiempo, no por puntos.** La primera versión decía
"cada 7 puntos". Se cambió porque el público lee una copia compartida que se
renueva cada ~30 segundos (sección 5): mandar más seguido que eso se
desperdicia, y mandar por puntos deja la pantalla atrasada en un set lento.
Lo que manda es el tiempo.

| Cuándo | Qué hace |
|---|---|
| **Cambió el marcador** | Manda, **como máximo una vez cada 30 segundos**. Si entraron tres puntos en ese rato, va una sola foto con el último |
| **Se cerró un set** | Manda **de inmediato**, sin esperar los 30 segundos |
| **No pasa nada** | El latido de "sigo acá" cada 2 minutos (sección 3) |
| **Terminó el partido** | Ya existe: el resultado oficial por la cola. Ahí se borra el dato en vivo |

**30 segundos y no 1 minuto** (decisión del dueño, 2026-09-16): cuestan casi lo
mismo y con 30 la tarjeta dice "hace 20 segundos" en vez de "hace 1 minuto",
que se siente en vivo de verdad. **El intervalo va en una sola constante** del
código: pasar a 1 minuto es cambiar ese número y desplegar.

**Por qué escala:** cada partido manda como máximo 2 envíos por minuto, se
juegue como se juegue, y cada envío **reemplaza** una fila, no agrega. 1.000
partidos a la vez serían ~33 envíos por segundo. El costo depende de cuántos
partidos se juegan a la vez, no de cuánta gente mira ni de lo rápido del juego.

**Cada envío es una foto completa, no un incremento.** Manda "va 1–0 y el set 2
va 14–11", no "sumale un punto a Aura". Por eso **perder un envío no rompe
nada**: el siguiente trae el marcador al día igual. Y por eso esto no necesita
cola ni reintentos, a diferencia del resultado final y del aplazamiento.

### 4.1 ⚠️ Revisar el rendimiento cuando esté andando

**Pedido del dueño, 2026-09-16:** los 30 segundos son una apuesta razonable,
no un número medido. Hay que revisarlo con datos reales.

**Cuándo:** al mes de prender el en vivo, y antes si pasa algo de la lista de
abajo.

**Qué mirar:**

1. **Envíos por minuto en la hora pico** (un sábado a mediodía): cuántos
   llegan y cuántos partidos había en vivo a la vez.
2. **Cuánto tarda en responder la puerta del envío** y la del papelito del
   público. Si alguna pasa de ~1 segundo, algo está mal.
3. **El uso de Supabase en el panel** (pedidos a la base y ancho de banda) el
   mes con en vivo contra el mes anterior.
4. **Si la copia compartida está funcionando:** que las lecturas a la base por
   el papelito sean ~2 por minuto por torneo y no crezcan con la gente que mira.
   Si crecen, la copia no está haciendo su trabajo y ese es el problema, no los
   30 segundos.

**Qué hacer según lo que salga:**

- Todo tranquilo → se deja en 30.
- El plan de Supabase se acerca al límite por culpa de esto → pasar a 60
  segundos (una constante).
- Lo que crece son las lecturas del público → arreglar la copia compartida, no
  el intervalo.

## 5. El costo: que no crezca con la gente que mira

Fue la mejor pregunta del dueño: *"me preocupa estar enviando peticiones por cada
persona que está viendo el partido en vivo; de pronto hoy no sea mucho pero
mañana sí, y no solo en vóley"*.

La preocupación es correcta. **Pero la solución no es alargar el intervalo** —
pasar de un minuto a dos solo compra el doble, y hace falta algo que compre mil
veces. Existe, porque este dato tiene una propiedad que casi ningún otro del
sistema tiene: **es idéntico para todos los que miran.**

### a) Una puerta chiquita, aparte

Hoy, abrir la página del torneo trae **la carpeta entera**: todos los partidos,
los resultados, los patrocinadores, los equipos. Eso **no se puede pedir cada
minuto**.

El refresco tiene que pegarle a **otra puerta**, que devuelva solo un papelito
con los marcadores del día — unos cientos de bytes:

```
Aura 1–0 Caribe · set 2: 14–11 · 14:32
Titanes 3–1 Delfines · terminado
```

**Regla: la página se abre pidiendo la carpeta, una vez. Después solo pide
papelitos.**

### b) Una sola copia para todos

Como el papelito es el mismo para todo el mundo, no hace falta ir a la base de
datos cada vez que alguien pregunta. Se guarda **una copia hecha durante ~30
segundos** y se le da esa misma a todos los que pregunten en ese rato.

Es el **tablero del coliseo**: no hay un tablero por persona, hay uno y todos lo
miran.

| Gente mirando | Veces que se va a la base, por minuto |
|---|---|
| 10 | **2** |
| 100 | **2** |
| 10.000 | **2** |

**El costo deja de depender de cuánta gente mira y pasa a depender de cuántos
torneos se están jugando a la vez** — que son pocos, y que es un número que
conviene que suba. Sin esto, la preocupación es legítima; con esto, deja de
serlo, y sigue valiendo el día que haya planilla en otros deportes.

---

## 6. La publicidad

**Cambió el 2026-09-16, con la hoja nueva (sección 2):** los patrocinadores del
torneo van arriba de la hoja, y siempre se ven hasta tres.

- **3 o menos** → se ven todos, fijos.
- **Más de 3** → **siempre se ven 3.** Se muestran de a 3 en orden y, cuando
  se acaban, se sigue desde el principio. **Cambia de grupo cada 2 minutos**
  mientras la hoja está abierta.
- **Nunca hay más de 6:** es el tope que ya tiene el torneo.

| Patrocinadores | Cómo rotan |
|---|---|
| 1, 2 o 3 | Fijos, se ven todos |
| 4 (ABCD) | ABC → DAB → CDA → BCD → ABC… |
| 5 (ABCDE) | ABC → DEA → BCD → EAB → CDE → ABC… |
| 6 (ABCDEF) | ABC → DEF → ABC… |

**Por qué esta regla y no otra:** es una sola para cualquier cantidad, siempre
llena los 3 lugares, y en una vuelta completa **todos salen la misma cantidad
de veces**, que es lo justo con quien paga. Con 6 nunca se repite nadie de un
grupo al siguiente; con 4 o 5 alguno se repite, y es inevitable porque no
alcanzan para llenar 3 lugares sin repetir. Está escrita tal cual en
`envivo.html` (función `grupoVisible`).

~~Un solo anunciante → una vez; dos o más → rotan cada 7 minutos.~~ Era para el
bloque "Hoy", donde había un solo lugar para el anunciante.

**Por qué rotar y no repetir.** Si alguien tiene la página abierta 40 minutos con
el mismo aviso, ese rato de atención le rinde a un solo anunciante. Rotando, cada
uno se lleva una **persona-día real** de un visitante enganchado — que es
exactamente lo que el reparto sabe medir. Es lo que hace cualquier tablero de un
estadio.

**Lo que NO se hace: volver a mostrar el MISMO aviso para contar más vistas.** Se
descartó por dos razones. El reparto no paga por vistas, así que no trae un peso;
lo único que haría es inflar un número que después se le muestra al anunciante en
el reporte, y si un anunciante descubre que sus 50.000 vistas eran 500 personas
refrescando, el problema no es la campaña, es que no vuelve a comprar. Y encima
castiga al mejor visitante: el que dejó la página abierta esperando para salir
para la cancha.

### 🔴 La alarma que hay que resolver ANTES de construir

**Los refrescos automáticos NO pueden contar como visitas en la analítica.**

El reparto entre organizadores se calcula con lo que mide esa analítica. Si cada
refresco entra como una visita más, **el reparto se descuadra solo**, sin que
nadie toque nada, y no se va a notar hasta que un organizador reclame y no se
entienda por qué le dio distinto.

Es fácil de evitar, pero hay que decidirlo el día uno y no después. Ya está
decidido: **no cuentan.**

---

## 6.1 Que no ponga lenta la página del torneo

**Preocupación del dueño, 2026-09-16:** si esto hace lenta la entrada al torneo
en un celular, no se hace. Reglas para que no pase:

1. **La página carga primero, igual que hoy.** Lo del en vivo se pide
   **después**, cuando la página ya se ve, y nunca la frena.
2. **Lo que se pide es chiquito:** el papelito con los marcadores de hoy, unos
   cientos de bytes. Si no hay partidos en vivo, vuelve vacío y no aparece nada.
3. **La hoja se baja solo si alguien toca el aviso.** El que no lo toca no paga
   nada por ella.
4. **Los logos de los patrocinadores ya los bajó la página** para el banner de
   siempre; la hoja usa los mismos, no vuelve a bajarlos.
5. **Refresca solo mientras la pestaña está a la vista.** Si el celular se
   bloquea o cambian de app, deja de preguntar.

**Cómo comprobarlo antes de soltarlo:** medir la carga de la página del torneo
en un celular de gama media, con y sin en vivo. Tiene que dar lo mismo.

## 6.5 Ojo: el papelito tiene que decir de qué copa es el partido

Lo pidió el dueño el 2026-09-16, pensando en el torneo de varias copas
(`grupos-y-copas.md`): cuando un torneo tenga Copa Oro, Plata y Bronce corriendo
a la vez, la vista de "Hoy" no puede mostrar *"Final · Cancha 2"* sin decir de
cuál de las seis.

**Hoy es gratis acordarse**, porque esto todavía no está construido. Es un campo
más en el papelito y una línea en la tarjeta.

---

## 7. Dos límites que conviene tener claros

**a) Esto solo existe donde hay planilla, y la planilla solo existe en vóley.**
El marcador en vivo no es una función aparte: es un subproducto de que la mesa
esté anotando en la app. En fútbol nadie tiene el celular en la mano durante el
partido, así que no hay de dónde sacar el dato. Es "los partidos de vóley en
vivo", no "los partidos en vivo de Torneos Pro".

**b) La planilla sigue apagada** hasta que el dueño la pruebe en una cancha de
verdad (`PLANILLA_VOLLEY_ENABLED`). Sin eso prendido, esto no tiene de dónde
alimentarse.

---

## 8. Lo que se descartó

- **Un interruptor por torneo** para que el organizador apague el marcador en
  vivo. Era una función inventada por si acaso. Se construye el día que alguien
  la pida, no antes.
- **Tiempo real** (websockets, suscripciones). El dueño ya dijo que refrescar
  está bien, y con el refresco automático más el botón "Actualizar" alcanza.
- **La presión sobre la mesa.** Se planteó como riesgo —un error de la mesa se
  vuelve público al instante— y el dueño dijo que no le preocupa. Queda anotado y
  no se hace nada al respecto.

---

## 9. El orden en que se construye

Hecho el 2026-09-16, todo junto:

1. ✅ **El aviso EN VIVO y la hoja** (sección 2). La hoja se baja recién al
   tocar el aviso.
2. ✅ **La puerta chiquita con copia compartida**: `GET
   /api/tournaments/[id]/en-vivo`, 30 segundos en la red de Vercel. No pasa por
   la analítica.
3. ✅ **El envío desde la planilla**: `POST /api/scorer/[token]/match/[id]/en-vivo`.
   Al cambiar el marcador (máximo cada 30 s), al cerrar set y al volver la señal
   de inmediato, y el latido cada 2 minutos. Guarda en `match_live_scores`, una
   fila por partido, fuera del tiempo real de `matches`.
4. ✅ **El "EN VIVO" por reloj**: 5 minutos sin envío y sale; al guardar el
   resultado o aplazar sale en el momento.
5. ✅ **La rotación de patrocinadores**: de a 3, cada 2 minutos.
6. **Falta:** correr el SQL, desplegar, verificar en producción que la copia
   compartida funcione (el encabezado `Cache-Control` de la puerta del público),
   probarlo con una planilla de verdad, y medir la carga del torneo en un
   celular de gama media con y sin en vivo.

Comparte la casilla y el camino con el de aplazados (`APLAZADO-PLANILLA-URGENTE.md`),
que ya está construido: es el mismo dato con otro motivo. Conviene reusar eso y
no hacerlo dos veces.
