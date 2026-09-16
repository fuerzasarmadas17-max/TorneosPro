# Planilla en vivo — que el público vea cómo va el partido

**Estado:** propuesta, sin construir.
**Fecha:** escrito el 2026-09-15.
**Origen:** el dueño preguntó si, mientras la mesa lleva la planilla, quien entre
al link del torneo puede ver la programación del día y **cómo va ese partido**.
Con una aclaración importante: *"ojo, no necesito que se muestre el punto a punto
para el que entra, pero que el resultado que vaya sí se vea, y si quiero ver otra
vez tendría que refrescar la página"*. Y una idea propia: *"cada 7 puntos que se
marquen en la planilla, tipo eso, haga que se despliegue algo que actualice el
partido"*.

**Ojo con el nombre.** Este documento NO es `planilla-en-vivo-volley.md`. Ese es
la planilla que usa **la mesa**, y ya está construida. Este es lo que ve **el
público** mientras esa planilla se está llevando. Son dos cosas distintas que se
llaman parecido.

---

## 1. La conclusión, arriba

**Se puede, es barato, y la idea de los 7 puntos es la correcta.**

La planilla ya guarda todo lo que hace falta; hoy simplemente no lo manda hasta
que el partido termina. Lo único que hay que agregar es que, cada tanto, suba
**solo el marcador** —los sets cerrados y cómo va el set en curso— y que la
página pública lo muestre.

Tres cosas que hacen que esto sea fácil y no un proyecto:

1. **Cada envío es una foto completa, no un incremento.** Manda "va 1–0 y el set
   2 va 14–11", no "sumale un punto a Aura". Por eso **perder un envío no rompe
   nada**: el siguiente trae el marcador al día igual. Esto es lo que hace que
   funcione en un coliseo con señal intermitente sin necesitar cola ni
   reintentos ni nada.
2. **No hace falta nada en tiempo real.** El dueño ya dijo que refrescar está
   bien. Nada de websockets ni suscripciones: la página lee el dato cuando carga,
   como lee todo lo demás.
3. **No toca la tabla de posiciones.** El partido sigue en `scheduled` y su
   marcador oficial sigue en NULL. Lo que se muestra sale de una columna aparte
   que solo mira esta pantalla. Verificado: las cuatro tablas de posiciones
   exigen `status === "completed"` antes de contar un partido
   (`src/hooks/use-volleyball-standings.ts:55` y las otras tres).

**Se construye junto con el de aplazados, no aparte.** Ver sección 6: son la
misma pieza usada para dos cosas.

---

## 2. Cuándo manda la planilla

La idea del dueño —cada 7 puntos— es buena y es la que recomiendo, con un
agregado:

| Cuándo | Por qué |
|---|---|
| **Al cerrar cada set** | Siempre, sin excepción. Es el dato que más importa y son 3 o 5 envíos en todo el partido. |
| **Cada 7 puntos dentro del set** | Un set a 25 son unos 46 puntos entre los dos, o sea ~6 envíos por set. |
| **Al terminar el partido** | Ya existe. Ahí se borra el dato en vivo. |

**Por qué 7 y no 1.** Uno por punto son ~46 envíos por set y el marcador público
no mejora en nada: nadie está mirando el celular esperando el punto 14. Con 7 el
público ve el marcador con un atraso máximo de unos 30 segundos, que para algo
que hay que refrescar a mano es de sobra.

**Por qué no cada 30 segundos en vez de por puntos.** Se puede, y tiene la
ventaja de acotar los envíos aunque la mesa anote rapidísimo. Pero por puntos es
más simple de explicar y de revisar: se cuenta lo que ya se cuenta. Si más
adelante aparece un partido con rachas rarísimas, se le pone un piso de tiempo
—"nunca más de uno cada 20 segundos"— y listo.

**Lo que no hace:** el envío en vivo **no entra en la cola de reintentos**
(`src/lib/volley/envio.ts`). Si falla, se pierde y no pasa nada — el próximo
trae todo. La cola es para el resultado final, que sí no se puede perder.
Mezclarlos sería llenar el teléfono de envíos viejos que ya no sirven.

**Y sobre todo: el envío nunca frena a la mesa.** Se dispara y se olvida. Si el
servidor tarda 8 segundos, el botón de punto sigue respondiendo al instante.

---

## 3. Qué se manda

La misma foto que ya arma la planilla, sin la lista de puntos:

```json
{
  "setsCerrados": [ { "n": 1, "home": 25, "away": 20 } ],
  "enCurso":      { "n": 2, "home": 14, "away": 11, "saca": "home" },
  "mesa": "Carlos Ruiz"
}
```

**No se manda:** la lista de puntos, la rotación, los cambios, los tiempos, ni
quién está en cancha. Es exactamente lo que pidió el dueño: el resultado sí, el
punto a punto no.

---

## 4. Qué ve el que entra al link

Hoy la página pública del torneo ya muestra la lista de partidos con sus fechas
(`TournamentDetail` → `MatchSchedule`). Lo que se agrega es:

### El partido que se está jugando

> 🔴 **EN VIVO** · Cancha 2
> **Aura** 1 — 0 **Caribe**
> Set 2: **14 – 11**
> *actualizado hace 2 minutos* `[ Actualizar ]`

Tres detalles que no son decorativos:

- **"actualizado hace 2 minutos"** va sí o sí. Sin eso, un marcador viejo se lee
  como el marcador de ahora, y la gente saca conclusiones de un partido que ya
  terminó hace media hora.
- **Un botón "Actualizar"** en vez de pedirle a la gente que recargue la página
  entera. Recargar vuelve a cargar todo el torneo y la publicidad; el botón pide
  solo ese partido. Cuesta lo mismo construirlo y es mucho mejor de usar.
- **Si el último envío tiene más de ~15 minutos, se apaga el "EN VIVO"** y pasa a
  decir *"iba 14–11 hace 2 horas"*. Un partido que se abandona sin cerrar deja la
  planilla colgada, y sin esta regla ese "EN VIVO" queda pegado para siempre.

### La programación del día

El dueño pidió también *"cómo va la programación del día"*. Hoy la lista está
ordenada por fecha pero no hay una vista de **hoy**. Se agrega arriba de todo:

> **Hoy, lunes 15**
> 🔴 14:00 · Cancha 2 · Aura 1–0 Caribe *(set 2: 14–11)*
> ✅ 12:00 · Cancha 1 · Titanes 3–1 Delfines
> ⏰ 16:00 · Cancha 2 · Halcones vs Cóndores

Eso es lo que la gente abre el link a buscar: si ya jugó su equipo, cómo salió, y
a qué hora le toca al que sigue.

---

## 5. Dónde se guarda

Una columna en `matches`, igual que la de aplazados:

```sql
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS volley_parcial JSONB,
  ADD COLUMN IF NOT EXISTS volley_parcial_at TIMESTAMPTZ;
```

`volley_parcial_at` es lo que hace posible el "hace 2 minutos" y el apagado
automático del EN VIVO. Sin esa fecha no hay forma de saber si el dato está vivo
o podrido.

**Se borra** cuando el resultado del partido se guarda. A partir de ahí el
marcador oficial es el marcador, y el parcial no tiene por qué seguir dando
vueltas.

**Lo que no se escribe:** `home_score`, `away_score`, `winner_id` y `status` no
se tocan. El partido está en `scheduled` desde antes y sigue en `scheduled` hasta
que termine.

---

## 6. Esto y el de aplazados son la misma pieza

Vale la pena verlo junto, porque cambia cuánto cuesta:

| | En vivo | Aplazado |
|---|---|---|
| Qué guarda | sets cerrados + set en curso | sets cerrados + set en curso |
| Dónde | `matches.volley_parcial` | `matches.volley_parcial` |
| Quién lo escribe | la planilla, cada 7 puntos | la planilla, al suspender |
| Quién lo lee | la página pública | la planilla del día que se reprograme |
| Cuándo se borra | al guardar el resultado | al guardar el resultado |

**Es el mismo dato con dos motivos.** Un partido está *jugándose* o está
*suspendido*, nunca las dos cosas, así que alcanza con un campo adentro del JSON
que diga cuál de las dos. Suspender no es más que el último envío en vivo, con
una marca.

Construidos juntos, la columna, el endpoint y el armado de la foto se hacen una
sola vez. Construidos aparte, se hacen dos veces y después hay que acordarse de
mantener las dos iguales. **Recomiendo hacerlos juntos**, con el de aplazados
primero, que es el urgente.

Si al escribirlos se vuelve confuso, se parten en dos columnas y no pasa nada
grave — pero vale la pena intentarlo con una.

---

## 7. ¿Aguanta?

Diez canchas jugando a la vez, un envío cada 7 puntos: alrededor de **20
escrituras por minuto** en total. Es nada — el mismo sistema aguanta hoy mucho
más que eso con la publicidad y las visitas.

Del lado de la lectura es una columna más en una consulta que la página pública
ya hace. No agrega ni una consulta.

---

## 8. Preguntas para el dueño

1. **¿En qué link?** ¿Solo en la página del torneo, o también en tu perfil de
   organizador, con todos los torneos que estén jugando hoy? Lo segundo es más
   trabajo pero es lo que la gente comparte por WhatsApp.
2. **¿Se muestra quién saca?** En la planilla física se ve, y ya lo tenemos. Pero
   al que entra desde afuera puede no decirle nada.
3. **¿El organizador puede apagarlo?** Un interruptor por torneo, por si alguno
   no quiere que se vea el marcador antes de tiempo. Si no hace falta, mejor no
   construirlo.
4. **¿Cada 7 puntos, o alcanza con cada set?** Solo por set es **mucho** más
   barato y quizás ya sirve: el público ve 1–0, 1–1, 2–1. Si lo que querés es
   que alguien pueda seguir el set mientras se juega, entonces sí van los 7.
5. **¿Y los otros deportes?** El fútbol tiene el mismo problema y la misma
   solución, pero es otro documento.

---

## 9. Cómo partirlo

**Entrega 1 — que se vea.** La columna, el envío cada 7 puntos y al cerrar set, y
el marcador con el "EN VIVO" y el "hace 2 minutos" en la página del torneo. Con
esto ya está lo que pidió.

**Entrega 2 — que sea cómodo.** El botón "Actualizar" y la vista de **Hoy** con
la programación del día.

Las dos juntas son chicas. Lo que las hace chicas es no construir la columna dos
veces: por eso van pegadas al documento de aplazados.
