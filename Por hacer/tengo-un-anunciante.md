# "Tengo un anunciante" — que los organizadores traigan la pauta

**Fecha:** 2026-08-25
**Estado:** idea, **nada construido**. El trato ya está en los términos
(`monetizar-terms.ts`, sección *"Si vos conseguís al anunciante, ganás
aparte"*) y hoy se opera a mano.

---

## 1. Para qué

Los anunciantes son el cuello de botella del negocio. La audiencia sobra —viene
gratis con el producto que ya se les vendió— y no vale un peso hasta que
alguien le vende un espacio a un negocio. Conseguir esos negocios ciudad por
ciudad no escala con software: escala con gente que conozca al de la ferretería.

**Y esa gente ya la tenés: son los organizadores.** Ellos ya le piden plata al
negocio del barrio para trofeos y arbitraje. Esto no les pide que aprendan a
vender, les pide que hagan **dentro de la plataforma lo que ya hacen por
fuera** — y que esta vez les deje algo.

Un teleoperador cuesta $2.000.000 al mes y hay que conseguir 10 campañas solo
para pagarlo. Esto cuesta cero y crece con cada organizador nuevo.

---

## 2. El flujo

**Dónde:** en la sección Monetizar, arriba del resumen, **después** de que
aceptó los términos. Antes no: el que todavía no se inscribió no tiene contexto
para entender de qué se le habla.

```
[ Tengo un anunciante ]   ← botón arriba del resumen
          ↓
  Modal: primero el trato, después el formulario
          ↓
  "Listo, lo tenemos" + queda en su lista de contactos presentados
          ↓
  Al dueño le llega el aviso y llama
          ↓
  El organizador ve en qué va: contactado / pautando / no prosperó
```

---

## 3. El texto del modal

> ### ¿Conocés un negocio que quiera mostrarse en tus torneos?
>
> Pasanos el contacto y nosotros nos encargamos del resto: lo llamamos, le
> explicamos, acordamos el precio, cobramos y armamos el aviso. Vos no tenés que
> vender nada, ni manejar plata, ni diseñar nada.
>
> Si termina pautando, te llevás **al menos el 15% de todo lo que pague durante
> sus primeros 6 meses** — además de lo que ya te toca por la audiencia de tus
> torneos.
>
> Ayuda mucho si ya hablaste con ellos, aunque sea para tantear. Contanos qué
> les dijiste y por quién preguntamos, así la llamada no arranca de cero.
>
> *El contacto queda registrado a tu nombre apenas lo enviás. Si otro
> organizador presenta al mismo negocio después, la comisión sigue siendo tuya.*

Esa última línea hace dos cosas a la vez: le saca el miedo a que se lo "roben"
y le mete apuro para avisar antes de hablar. Las dos juegan a favor.

---

## 4. Los campos

| Campo | Obligatorio | Para qué |
|---|---|---|
| Nombre del negocio | sí | identificarlo y detectar duplicados |
| WhatsApp o teléfono | sí | es por donde se lo contacta |
| ¿Por quién preguntamos? | no | que la llamada no empiece con "¿quién es el dueño?" |
| ¿Ya hablaste con ellos? | sí (sí/no) | separa el que está tibio del que es un dato suelto |
| ¿Qué les dijiste? | no | el argumento que ya funcionó, para no contradecirlo |
| Ciudad | sí | define a qué torneos puede apuntar la campaña |

Seis campos es el techo. Cada campo de más es gente que abandona el formulario.

⚠️ **Nada de precios.** Si le pedís que estime cuánto pagaría, se mete a
negociar y llega a un número que después vos tenés que desdecir. El precio lo
ponés vos en la llamada.

---

## 5. Lo que hay que construir

| Pieza | Detalle |
|---|---|
| Tabla `advertiser_leads` | negocio, contacto, ciudad, notas, `referred_by` (organizador), `created_at`, estado |
| Botón + modal | en Monetizar, solo para inscritos |
| Aviso al dueño | correo o WhatsApp al llegar un contacto. **Sin esto no sirve**: una fila en una tabla que nadie mira es un contacto perdido |
| Lista del organizador | qué presentó y en qué va cada uno |
| Panel de admin | ver, marcar estado, y atar el lead a la campaña cuando se cierre |

---

## 6. El estado es la mitad del producto

**El riesgo más grande de esta función es el silencio.**

El organizador manda un contacto, no vuelve a saber nada, y no manda nunca más.
Pasa siempre con este tipo de features.

Cuatro estados, visibles para él:

| Estado | Lo que ve |
|---|---|
| **Enviado** | "Lo tenemos. Te avisamos cuando hablemos con ellos." |
| **Contactado** | "Ya hablamos con ellos, estamos viendo." |
| **Pautando** 🎉 | "Está pautando. Vas a ver tu comisión en tu próximo corte." |
| **No prosperó** | "No se dio esta vez. Gracias igual." |

Y avisarle en cada cambio, no solo dejarlo en pantalla. El mensaje de "está
pautando" es el que hace que traiga el segundo.

⚠️ **"No prosperó" hay que decirlo igual.** Es tentador no avisar de los que no
salieron, pero el que no recibe respuesta asume que no le importó a nadie.

---

## 7. Lo que hay que cuidar

**Duplicados.** Los términos prometen que la comisión es de quien avisó
primero. Hace falta comparar contra los contactos ya cargados (por teléfono
normalizado, no por nombre — "Deportes El Gol" y "DEPORTES EL GOL" son el
mismo) y avisarle en el momento si ya estaba: *"Ese negocio ya lo presentó otro
organizador"*. Enterarse después es peor.

**Son datos de un tercero.** El organizador está entregando el teléfono de otra
persona. Conviene una línea en el modal diciendo que se usa solo para
contactarlo por esto, y revisar que encaje con
`legal/politica-tratamiento-datos.md`.

**Expectativas.** Que el modal no prometa plazos. "Te avisamos cuando hablemos
con ellos" es honesto; "te contactamos en 48 horas" es una promesa que se
incumple la primera semana ocupada.

---

## 8. Lo que NO hay que hacer

- **Que el organizador cobre.** En el momento en que tiene que manejar plata,
  deja de hacerlo.
- **Que arme el aviso.** Ni el diseño ni el texto.
- **Que explique cómo funciona la plataforma.** Va a explicarlo mal y vas a
  llegar a una conversación ya torcida.
- **Un formulario largo.** Seis campos.

Todo lo que le agregues al organizador, se lo restás a la cantidad de contactos
que te va a traer.

---

## 9. Cuándo construirlo

**Todavía no.** Con cinco organizadores esto se opera con un WhatsApp: se les
dice el trato y avisan por ahí.

Se construye cuando pase una de estas dos:

1. **Ya trajeron 3 o 4 anunciantes a mano.** Ahí está probado que la conducta
   existe y vale automatizarla.
2. **Son más de 15 organizadores.** Ahí el WhatsApp deja de alcanzar y empiezan
   a perderse contactos.

Antes de eso, construirlo es adivinar. La versión a mano además te enseña qué
preguntas hacen y qué los frena — y eso va directo al texto del modal.

---

## Relacionados

- `como-funciona-monetizar.md` — el reparto y la comisión, ya en producción
- `src/lib/monetizar-terms.ts` — el trato, tal como lo aceptaron
