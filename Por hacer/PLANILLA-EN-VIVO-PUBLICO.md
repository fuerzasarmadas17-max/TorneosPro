# El marcador en vivo, para el público

**Estado:** diseño hablado con el dueño el 2026-09-16. Falta decidir cuándo se
construye.
**Maqueta:** `planilla-en-vivo-propuesta/hoy.png`

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

## 2. Qué ve el que entra: la vista de "Hoy"

Ver `planilla-en-vivo-propuesta/hoy.png`.

**Cómo es hoy:** el que abre el link ve la lista de partidos por fecha, repartida
en pestañas. Están todos, los de la semana pasada y los del otro fin de semana.
No hay ningún lugar que diga "esto es lo que está pasando ahora".

**Lo que se agrega:** arriba de todo, antes de las pestañas, un bloque con **solo
los partidos de hoy**, en orden de hora y con el estado de cada uno:

```
        Hoy, sábado 20                    4 partidos

  12:00 · Cancha 1                        ✓ TERMINÓ
  Titanes                                        3
  Delfines                                       1

  14:00 · Cancha 2                        ● EN VIVO
  Aura Voleibol                                  1
  Caribe FC                                      0
  ┌ SET 2, JUGÁNDOSE                     14 – 11 ┐
  Actualizado hace 40 segundos        ↻ Actualizar

  [ patrocinador ]

  16:00 · Cancha 2                            FALTA
  Halcones                                       –
  Cóndores                                       –
```

Es lo que alguien manda por WhatsApp. Un marcador suelto de un partido, no.

**Esto va primero.** En la primera versión la vista de "Hoy" era la entrega 2, o
sea lo último. Está al revés: el bloque de hoy es el producto, y el marcador a
medias es lo que lo hace sentir vivo.

---

## 3. "EN VIVO" lo decide el reloj, no el partido

Fue una idea del dueño y es la que sostiene todo lo demás: **no mostrar nada en
vivo si no sabemos que la planilla está hablando de verdad.**

El dato que se guarda no es "este partido está en vivo", es **cuándo fue la
última vez que la planilla habló**. La pantalla decide sola:

| Última señal | Qué se ve |
|---|---|
| Hace menos de ~5 minutos | 🔴 **EN VIVO**, con el marcador |
| Hace más | *"Iba 1–0 hace 40 minutos"*, sin el cartel rojo |
| Nunca | **Nada.** La pantalla queda igual que hoy |

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

| Cuándo | Por qué |
|---|---|
| **Al cerrar cada set** | Siempre. Es el dato que más importa y son 3 a 5 envíos. |
| **Cada 7 puntos dentro del set** | Un set son ~46 puntos entre los dos: unos 6 envíos por set. |
| **Cada pocos minutos aunque no pase nada** | Es el latido que sostiene el "EN VIVO" de la sección 3. |
| **Al terminar el partido** | Ya existe. Ahí se borra el dato en vivo. |

**Los 7 puntos son del dueño y se quedan, pero por una razón distinta a la que
decía la primera versión.** No es por precisión del marcador: es que sin
movimiento, el que entra a mitad de set ve "1–0" y **nada cambia durante veinte
minutos**. Un cartel que dice EN VIVO y no se mueve en veinte minutos se siente
roto, y si se siente roto la gente deja de entrar. Es un argumento de sensación,
no de dato, y está bien que lo sea.

**Cada envío es una foto completa, no un incremento.** Manda "va 1–0 y el set 2
va 14–11", no "sumale un punto a Aura". Por eso **perder un envío no rompe
nada**: el siguiente trae el marcador al día igual. Y por eso esto no necesita
cola ni reintentos, a diferencia del resultado final y del aplazamiento.

---

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

**Decidido con el dueño:**

- **Un solo anunciante** en el torneo → se muestra **una vez**. No se repite.
- **Dos o más** → **rotan cada 7 minutos** mientras la página esté abierta.

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

1. **La vista de "Hoy"**, con los partidos del día y su estado. Es el producto.
2. **La puerta chiquita con copia compartida**, y que los refrescos no cuenten en
   la analítica. Las dos van desde el día uno, no después.
3. **El envío desde la planilla**: al cerrar set, cada 7 puntos, y el latido.
4. **El "EN VIVO" por reloj**, con el "actualizado hace X" y el botón Actualizar.
5. **La rotación de anunciantes** cada 7 minutos cuando hay más de uno.

Comparte la casilla y el camino con el de aplazados (`APLAZADO-PLANILLA-URGENTE.md`),
que ya está construido: es el mismo dato con otro motivo. Conviene reusar eso y
no hacerlo dos veces.
