# Aplazar un partido a mitad de la planilla

**Estado:** diseño cerrado con el dueño el 2026-09-15. Listo para construir.
**Alcance: solo vóley.**

Este documento reemplaza la primera versión, que se escribió antes de hablarlo.
Varias cosas de aquella quedaron al revés y no vale la pena conservarlas.

---

## 1. Qué se va a construir, en una frase

**La planilla no cambia en nada.** Lo único que se agrega es que, en el cartel de
cerrar set, aparece una tercera opción chiquita: **"El partido se aplazó"**. Se
escribe el motivo, se guarda cómo iba, y el partido se va a la pestaña de
Aplazados. Cuando se reprograma y se genera el link nuevo, el que toca "Planilla
en vivo" ve primero una pantalla que le dice por dónde iba, elige saque y lados,
y sigue desde ahí.

Todo lo demás —guardar en el teléfono sin señal, encadenar set 1 → 2 → 3, mandar
el resultado al final— **queda exactamente igual**.

---

## 2. Dónde va el botón

En el cartel que ya sale al tocar "Cerrar set" (el que dice *"¿Cerramos el set
2?"* con el marcador grande). Hoy tiene dos botones; se le agrega un tercero,
**chico y abajo**, en letra chiquita:

> **¿Cerramos el set 2?**
> **15 – 10**
> `[ Seguir anotando ]` `[ Cerrar set ]`
> *El partido se aplazó*

**Por qué ahí y no en el marcador.** Al lado de los botones de punto se aprieta
sin querer y se arruina un partido. El cartel de cerrar set es la zona de las
cosas que se hacen una vez, y la mesa ya sabe que es por ahí donde se termina
algo.

**Por qué siempre visible y no solo "si cerró con menos de 25".** La app no sabe
a cuántos puntos se juega ese set —nunca lo supo, lo decide la mesa— y además
"Cerrar set" está bloqueado cuando el marcador está empatado. Si llueve a 0–0 o
a 3–3, por ese camino no habría forma de aplazar. Siempre visible resuelve los
dos casos y no le agrega ni un toque al caso normal.

**Se puede aplazar en cualquier set:** el 1, el 2, el 3, y en un torneo al mejor
de 5 también el 4 y el 5.

**Se puede aplazar las veces que haga falta.** Si se retoma y vuelve a llover, se
vuelve a aplazar y se guarda encima. Solo importa cómo iba la última vez.

Al tocarlo, una confirmación que diga en palabras lo que se va a guardar:

> **El partido queda aplazado.**
> Va **1–0** (25–20) y el set 2 iba **15–10**.
> Cuando se reprograme se retoma justo ahí.
> Motivo: `[Lluvia_______________]`
>
> `[ Seguir anotando ]` `[ Guardar ]`

---

## 3. Por qué el marcador parcial va en una casilla nueva

Esta es la parte que hay que entender bien, porque no es obvia.

**Hoy hay una sola casilla donde se escribe cómo quedó un partido**: el marcador
final y los parciales de cada set. Esa casilla la lee todo — la tabla de
posiciones, el perfil de los equipos, las estadísticas, el PDF, la página
pública. No existe una casilla de "va por la mitad", porque hasta hoy un partido
o no se jugó, o se jugó y terminó.

Si escribiéramos el 1–0 ahí, pasarían dos cosas:

1. **El torneo se ensucia.** Toda pantalla que lea esa casilla diría "este
   partido se jugó y quedó 1–0", y la tabla de posiciones le daría los puntos a
   alguien por un partido que no terminó.
2. **No dejaría igual.** Esa casilla tiene un candado que solo acepta resultados
   que existen: en un partido a 3 sets son 2–0, 2–1, 0–2 y 1–2. **Un 1–0 no es un
   resultado de vóley**, es un partido a medias, y el candado lo rechaza
   (`volleyball-sets.ts:137`). El candado está en los tres lados —la planilla, el
   formulario del anotador y el panel del organizador— y **no se toca**: es lo
   que impide que un partido mal cargado descuadre la tabla.

**Entonces se hace una casilla nueva, aparte,** que dice *por dónde iba*. La leen
solo dos pantallas: la pestaña de Aplazados y la planilla el día que se juegue.
La casilla del resultado queda vacía hasta que el partido termine de verdad; ese
día se llena como siempre y la de "por dónde iba" se borra.

**Es lo mismo que se hace en papel.** Cuando llueve no se pasa nada al acta
oficial: se guarda la hoja a medio llenar en una carpeta, y el día que se juega
se saca, se termina, y recién ahí se escribe en el acta. La casilla nueva es esa
carpeta.

---

## 4. Qué se guarda

```json
{
  "setsCerrados": [ { "n": 1, "home": 25, "away": 20 } ],
  "enCurso": {
    "n": 2,
    "home": 15,
    "away": 10,
    "saca": "home",
    "izquierda": "home",
    "yaCambiaronDeCancha": false
  },
  "motivo": "Lluvia",
  "aplazadoEn": "2026-09-15T22:10:00Z",
  "mesa": "Carlos Ruiz"
}
```

**Va en JSON y no en columnas sueltas** porque así agregar un dato mañana no
cuesta una migración nueva, y porque son seis columnas que en fútbol, básquet y
béisbol quedarían en NULL para siempre.

**No se guarda** la rotación, la nómina, los cambios ni los tiempos ya gastados:
son de unos jugadores que probablemente no vuelvan.

**Lo que NO se escribe al aplazar:** `home_score`, `away_score`, `winner_id` y
las filas de `volleyball_sets` se quedan como estaban. `status` pasa a
`postponed` y `postponed_reason` al motivo, que es lo mismo que ya hace el
organizador a mano.

---

## 5. Cómo se retoma

### El saque viene marcado; el lado viene informado

Es la decisión del dueño, y la razón importa:

- **El saque se sugiere.** *"Sacaba Aura"* es un dato absoluto: no importa dónde
  se juegue ni quién esté en la mesa, sigue siendo verdad. Viene marcado y la
  mesa lo puede corregir, igual que la sugerencia de saque entre sets.
- **El lado NO se marca, se informa.** "Izquierda" es *la izquierda de la mesa*,
  y la mesa nueva puede estar sentada en la otra punta, en otra cancha o del otro
  lado del coliseo. Un lado decidido desde otra silla confunde más de lo que
  ayuda. Se muestra como dato y se elige mirando la cancha de hoy:

> Ese día, Aura estaba a la izquierda de la mesa.
> **¿Quién queda a la izquierda hoy?** `[ Aura ]` `[ Caribe ]`

### Dónde aparece

Al tocar **"Planilla en vivo"**, **antes de la rotación**:

> **Este partido venía aplazado.**
> Aplazado el 15 de septiembre por lluvia.
> Va **1–0** y el set 2 iba **15–10**.
> La rotación se carga de cero: pueden jugar otros.
>
> `[ Retomar en 15–10 ]` `[ Empezar todo de cero ]`

Que sea una pregunta y no automático es a propósito: la mesa de hoy no estaba el
día de la lluvia, y tiene que poder decir "acá dice 15–10 pero acordamos jugarlo
entero".

### El truco técnico: un punto de partida, no puntos inventados

El motor cuenta los puntos recorriendo la lista de eventos desde cero
(`estadoDelSet`, `planilla.ts:201`). Para que el set arranque en 15–10 **no** se
inventan 25 puntos falsos: *Deshacer* borraría puntos que anotó otra mesa hace
dos semanas, el historial mostraría puntos que nadie anotó, y la rotación giraría
25 veces con jugadores que no estaban.

Se le agrega al set un campo:

```ts
/** De dónde arranca el marcador de este set. Solo lo tiene un set que se
 *  retoma de un partido aplazado; en uno normal no existe y arranca 0–0. */
vieneDe?: { home: number; away: number };
```

y `estadoDelSet` arranca el contador ahí. Es **una línea** en el motor. A cambio:
*Deshacer* no puede bajar de 15–10 (correcto, eso pasó otro día), el historial
arranca diciendo de dónde viene, y la rotación gira desde la rotación nueva.

### El aviso de cambio de cancha del set decisivo

En el set decisivo los equipos cambian de cancha a los 8 puntos y la app avisa.
Si un decisivo se retoma viniendo de 10–9, ese aviso saltaría de nuevo aunque ya
se hubieran cambiado. Por eso se guarda `yaCambiaronDeCancha`.

### Al final

El partido termina en el set que sea y **se manda el resultado como siempre**, con
el resultado completo. Ahí se borra la casilla de "por dónde iba".

---

## 6. Sin señal

Se aplaza por lluvia, y si llueve puede que no haya red. El aplazamiento va por
**la cola que ya existe** (`envio.ts`): queda anotado en el teléfono y sale solo
cuando vuelve la señal. Recién cuando queda encolado **se borra la planilla del
teléfono**, igual que hoy con el resultado final.

Borrarla no es opcional: si no, la misma mesa con el mismo link vuelve a abrir el
partido y entra derecho al marcador con el 15–10 y la rotación vieja, salteándose
la pantalla de "venía aplazado".

---

## 7. El link

- **Un partido aplazado conserva fecha y hora en la base**, así que entra sin
  problema en un link nuevo. (En la pantalla la fecha parece borrarse al aplazar,
  pero vuelve al recargar: `mappers.ts:312` descarta los campos vacíos. Es un bug
  chiquito que ya existía y no es de esto.)
- **Si se reprograma dentro de las 72 horas, el link viejo sigue vivo** y al armar
  el nuevo va a decir que ese partido ya está en otro link. Hay que revocar el
  viejo primero. Decisión del dueño: se deja así.

---

## 8. El agujero que hay que tapar

Hoy un partido aplazado le aparece a la mesa en la lista del anotador con la
etiqueta gris "Pendiente", igual que uno que nunca arrancó, y se puede abrir y
cargar desde cero (`score/[token]/page.tsx:449`, y el endpoint del resultado
escribe `completed` sin mirar el estado, `result/route.ts:199`).

O sea que alguien podría abrir el partido de la lluvia por el formulario de
cargar el resultado a mano y pisar el 15–10 sin enterarse. Hay que avisarle.

---

## 9. Lo que queda fuera, a propósito

- **Un partido que nunca se vuelve a jugar.** El organizador le carga un
  resultado completo a mano al reprogramarlo. No se construye nada para esto.
  (Ojo: no va a poder guardar "1–0" — mismo candado de la sección 3. Tiene que
  ser un resultado completo, tipo 2–0.)
- **Los otros deportes.** Un fútbol suspendido 2–1 tiene el mismo problema, pero
  es otro documento.
- **Los empates.** El dueño está pensando en sacarlos. No se toca nada de eso acá.

---

## 10. Lo que hay que tocar

| Archivo | Qué |
|---|---|
| SQL en `supabase/migrations/` | La columna `volley_partial_state` |
| `src/types/index.ts` + `src/lib/db/mappers.ts` | Que el dato viaje |
| `src/lib/volley/planilla.ts` | El campo `vieneDe` y una línea en `estadoDelSet` |
| `src/lib/volley/envio.ts` | Un segundo tipo de pendiente en la cola |
| `src/app/api/scorer/[token]/match/[matchId]/postpone/` | El endpoint nuevo |
| `src/components/scorer/volley/marcador-screen.tsx` | El botón chiquito |
| `src/components/scorer/volley/planilla-screen.tsx` | La confirmación y la pantalla de "venía aplazado" |
| `src/app/score/[token]/page.tsx` | Que un aplazado se vea aplazado, y el aviso del formulario |
| `src/components/standings/match-schedule.tsx` | Por dónde iba, en la pestaña de Aplazados |
