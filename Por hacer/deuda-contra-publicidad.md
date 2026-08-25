# La deuda de los torneos fiados se abona con publicidad

**Fecha:** 2026-08-24 · **Actualizado:** 2026-08-25
**Estado:** decidido. Hechos los términos y el arreglo del cupón del 100%; la
deuda y los abonos, **sin construir**. Plan en la sección 5.

Qué hacer con la publicidad que genera un torneo que se regaló o se fió. Para
cómo funciona el reparto en sí, ver `como-funciona-el-reparto.md`. Para el
problema de cobrar un fiado, `pago-duvan.md`. La idea del neteo nació en
`programa-de-referidos.md` §4; este documento la cierra.

---

## 1. La idea

**El torneo regalado se paga solo con su propia publicidad.**

El organizador entra al reparto normalmente y gana lo mismo que cualquiera. Lo
que gana se le abona a lo que debe, y se le transfiere la diferencia.

La cadena queda así:

```
gana con la publicidad → se cierra el mes → se abona a lo que debe → se transfiere el resto
```

**Lo nuevo es solo el paso del medio.** La cuenta de la publicidad no se toca:
gana exactamente igual que antes. Eso es lo que hace este cambio seguro — no
puede romper el reparto.

---

## 2. Qué torneo genera deuda

| Cómo se creó el torneo | ¿Queda debiendo? | ¿Cobra publicidad? |
|---|---|---|
| Pagado normal | No | Completo |
| Pagado con crédito de paquete | No | Completo |
| Con descuento (30%, 50%…) | **No** | Completo |
| Fiado | Sí, el precio de lista | Sí, pero abona |
| Regalado (cupón "Torneo gratis") | Sí, el precio de lista | Sí, pero abona |
| Cupón del 100% | Sí, el precio de lista | Sí, pero abona |

**La regla en una frase: no importa si le hiciste un favor, importa si te debe
plata.**

Un descuento es un **precio**, no un préstamo. El que pagó $70.000 con un 30%
OFF pagó lo que le pediste; cobrarle después con la publicidad sería cambiarle
el precio a algo ya cerrado.

### Cuánto debe

> **Saldo = precio de lista actual del torneo − todo lo que ya abonó**

El "bono" que se le dio define si debe y cuánto:

| Bono que se le dio | Qué significa | Debe |
|---|---|---|
| **100%** | no tenía con qué pagar | **el total** |
| 30%, 50%… | fue una cortesía de verdad | **nada** |

### Si el torneo sube de plan, la deuda sube con él

Y **el upgrade se le deja gratis**, como está hoy. No es una fuga: esa plata se
cobra igual, por la deuda.

Ejemplo: debía **$70.000** y ya había abonado **$30.000** (saldo $40.000).
Agrega equipos y el torneo pasa a **$100.000**:

```
$100.000 − $30.000 = $70.000 de saldo
```

**Esto ya funciona solo.** Cuando un torneo con bono del 100% sube de plan,
`add-teams-dialog.tsx:273` le escribe el nuevo precio de lista a
`tournaments.price`. La deuda se recalcula sola desde ahí; no hay que congelar
nada ni llevar una cuenta aparte.

⚠️ **El descuento del referido sí se le queda pegado.** Un torneo con 30% OFF
paga el 70% de cada upgrade, para siempre. El descuento era por un torneo, no
por su crecimiento. No es grave —algo cobra— pero es plata que no pensabas
regalar, y el arreglo es el **cupón con tope de tier** de
`programa-de-referidos.md` §8.

### La deuda se marca a mano — verificado contra producción

Se dio vuelta dos veces. La conclusión final la fijaron los datos.

**Corrida del 2026-08-25.** 22 torneos con cupón. De los 16 con bono del 100%
vigente, el organizador revisó uno por uno: **solo uno es deuda real.**

| | |
|---|---|
| Deuda real | **1** — "MASCULINO 1 🏐🏆🔥 2edicion 2026" (Daniel Rodríguez), $70.000 |
| Regalos con bono del 100% | 15 |
| Fiados ya cobrados y resueltos | 4 — Duvan, Jesus, Omar, Marceliano |
| Descuentos en % (no deben nada) | 2 |

**El cupón encuentra la deuda, pero trae 15 regalos con ella.** Un cupón de
cortesía significa *"no pagó"*, que no es lo mismo que *"me debe"*. No hay
ninguna otra columna que los separe: los 16 son idénticos en la base.

⚠️ **Por eso la deuda se crea explícitamente, en el momento de fiar.** Es lo que
se había propuesto, después se sacó pensando que la regla del bono alcanzaba, y
los datos mostraron que no. No se deduce de nada.

Lo que **sí** se sigue derivando es el monto:
`saldo = tournaments.price − Σ abonos`, con la marca diciendo únicamente *este
torneo es fiado*.

### El backlog es de un solo torneo

No hay que limpiar nada ni tener conversaciones incómodas con nadie. Y los
cuatro fiados que ya se cobraron salieron los cuatro bien: la preocupación de
`pago-duvan.md` —que alguien se olvidara de correr los SQL y quedara
invisible— no se materializó ni una vez.

⚠️ **Pero el único deudor es Daniel, uno de los organizadores más grandes.** Va
a clasificar. Así que los abonos **tienen que estar antes de prender
`MONETIZAR_ENABLED`**, o entra y ve sus ganancias completas sin ninguna mención
de lo que debe.

---

## 3. Cómo se abona

**La deuda es por torneo, no por organizador.** Un organizador puede deber
varios torneos a la vez, cada uno con su propio saldo. Cada abono se imputa a
**un torneo concreto** — es lo que después se le muestra a él.

El monto **lo decide el dueño mes a mes**, caso por caso. No hay porcentaje
fijo, y puede ser distinto para cada organizador y para cada mes.

> 🔑 **La deuda se lleva por torneo; lo que la paga es lo que el organizador
> gana en total.** Nunca hace falta saber cuánto de la publicidad generó *ese*
> torneo — y es una suerte, porque no se puede saber: las personas-día se
> cuentan por organizador, y quien ve dos torneos suyos el mismo día vale 1.
> Ese 1 no se puede partir. Por eso el abono sale de lo que ganó el organizador
> en total, y al torneo solo se le **pone el nombre**.

### En el cierre

Al cerrar el mes, al lado de cada organizador con deuda aparece lo que ganó y
sus torneos pendientes:

| Torneo que debe | Saldo | ¿Cuánto le abonás? |
|---|---:|---|
| Copa Verano | $100.000 | ← se escribe acá |
| Torneo Relámpago | $60.000 | ← se escribe acá |

> Ganó este mes: $30.000 · Abonado: $15.000 · **Se le transfiere: $15.000**

**Un abono va a un solo torneo.** Para repartir lo del mes entre dos deudas se
cargan dos abonos. Así lo que ve el organizador nunca es ambiguo.

Viene precargado el torneo más viejo primero, que es el orden natural para
saldar.

### Lo que ve el organizador

En su corte del mes:

> **Agosto 2026**
> Ganaste **$30.000**
> − $15.000 abonados a **Copa Verano** — te quedan $85.000
> **Te transferimos $15.000**

Y en cada torneo que debe, el historial de abonos con fecha. Lo que lo mantiene
enganchado es ver el saldo bajar, no saber qué fracción se le tomó.

> **No guardar el nombre del torneo en el abono; resolverlo por `tournament_id`
> al mostrarlo.** Los organizadores les cambian el nombre — el único fiado real
> que hay hoy pasó de "SANTO COFFEE MASCULINO 🏐🏆🔥 SENIOR" a "MASCULINO 1
> 🏐🏆🔥 2edicion 2026". Un historial con el nombre viejo le muestra un torneo
> que él ya no reconoce.

⚠️ **No usar la palabra "bolsa" en esta pantalla.** En el reparto "bolsa"
significa la mitad de lo que pagó una campaña, no lo que ganó él. Si acá dice
"se descontó de tu bolsa", el mismo término quiere decir dos cosas distintas en
dos pantallas del mismo producto. Decir **"de lo que ganaste este mes"**.

### Los topes

- Un abono no puede pasar del **saldo de ese torneo**.
- La suma de los abonos del mes no puede pasar de **lo que ganó ese mes**.

Sin esos dos topes se termina transfiriendo en negativo o cobrando de más sin
notarlo.

### El número sugerido

Con libertad total la inconsistencia es cuestión de tiempo, y de ahí sale el
*"¿por qué a él le descontaste menos que a mí?"*. Que venga precargada **la
mitad de lo que ganó**, sobre el torneo más viejo, editable, y un campo para
anotar el motivo cuando se sale de lo normal. Rápido cuando da igual, flexible
cuando importa.

---

## 4. Los cuatro cuidados

### 4.1 La deuda no baja hasta que el organizador clasifique

El más importante. Si no cumple los ocho requisitos del mes y no tiene los datos
de pago aprobados, **gana $0 — y $0 no abona nada**. Hoy no clasifica casi
nadie.

⚠️ **El gancho no arranca solo.** La deuda puede pasar meses sin moverse.

Cómo decirlo sin prometer de más:

| ❌ No decir | ✅ Decir |
|---|---|
| "Te fío el torneo y la publicidad me lo va pagando" | "Cuando empieces a cobrar publicidad, eso te va bajando lo que debés" |

Y la consecuencia de negocio: **al organizador chico —justo al que se le fía— la
publicidad no le va a alcanzar en meses.** Esto sirve de gancho y de cobro
pasivo, **no reemplaza el cobro en efectivo.**

### 4.2 Los términos tienen que decirlo — ✅ hecho

Los términos prometían *"se te transfiere dentro de los primeros 15 días"* y
nada más. Descontar sin que esté escrito ahí es exactamente el *"cobrarle sin
avisarle contra una plata que ya considera suya"* que
`programa-de-referidos.md` §4 marcó como la forma rápida de dañar la relación.

El 2026-08-25 se agregó la sección **"Si empezaste sin pagar tu torneo"** y se
subió `MONETIZAR_TERMS_VERSION` a `2026-08-v3`.

⚠️ **Al desplegarlo, todos los que ya aceptaron van a tener que aceptar de
nuevo.** Es el comportamiento correcto —cambió lo que se paga— y hoy son pocos.
En seis meses la misma decisión cuesta mucho más.

Y avisarle igual **el día que se le fía**, no cuando ya vio plata en pantalla.
Que esté en los términos no reemplaza decírselo.

### 4.3 El mínimo de $50.000 no aplica al abono

Los términos no transfieren cortes menores a $50.000: se acumulan. Si el abono
dependiera de eso, el que gana poco quedaría estancado en los dos lados a la vez
—sin transferencia y sin que la deuda baje.

**El abono se hace igual, aunque ese mes no haya transferencia.**

### 4.4 El monto ganado está congelado: el abono va aparte

`ad_settlements.amount_cop` es inmutable por trigger. El abono **no** se le
resta ahí — va en su propio registro.

Así siempre se puede mostrar la cuenta completa:

> Ganaste $30.000 · Se abonaron $15.000 a tu torneo · Te transferimos $15.000

Y si el abono se puso mal, se corrige sin tocar lo que ganó.

---

## 5. Plan de implementación

### Ya hecho — 2026-08-25

- ✅ **Sección "Si empezaste sin pagar tu torneo"** en `monetizar-terms.ts`, con
  la versión subida a `2026-08-v3`. Al subir la versión, todos los que ya
  aceptaron van a tener que aceptar de nuevo. Es a propósito.
- ✅ **El cupón del 100% ya saltea el pago al crear** un torneo
  (`tournament-cost-dialog.tsx`). Antes salía a cobrar $0 y la creación fallaba
  con "Faltan campos requeridos".

---

### Fase 0 — Antes de escribir una línea de la deuda

**Nada de esto es construir; es correr y mirar.** Va primero porque *la
deducción no tiene de dónde descontar hasta que alguien gane plata*, y hoy no
gana nadie: nadie tiene los datos aprobados y los mínimos están sin calibrar.
Construir los abonos antes de esto es hacer una pantalla vacía.

| # | Qué | Quién |
|---|---|---|
| 0.1 | **Aprobar organizadores.** Están todos en `pending` desde que se activó la lista blanca. No hay botón: es un `UPDATE`. → `consultas/aprobar-organizadores.sql` ✅ escrita | la corre él |
| 0.2 | **Sacar los fiados que ya existen** con su saldo, y ver cuáles se cobraron por fuera sin soltar el cupón. → `consultas/deudas-de-torneos-fiados.sql` ✅ escrita | la corre y la revisa él |
| 0.3 | **Calibrar los mínimos** de `monetization_config` con agosto completo. Estaba apuntado para septiembre y agosto cierra ya. → `consultas/organizadores-vs-requisitos.sql`, que ya existía | los dos |
| 0.4 | **Cerrar agosto de verdad** el 1 de septiembre, sin la capa nueva. | él |

⚠️ **0.2 tiene un bloqueante adentro.** Si aparecen torneos que ya pagaron por
fuera y siguen colgados del cupón, hay que soltarlos **antes** de prender los
abonos: si no, el sistema les va a descontar plata a organizadores que ya
pagaron. Es el arreglo de `pago-duvan.md`, y ahora es prerrequisito.

⚠️ **0.4 importa más de lo que parece.** El cierre nunca se corrió en serio. Si
tiene un problema, hay que descubrirlo con el sistema simple y no con los
abonos encima.

---

### Fase 1 — La deuda y los abonos

> 🔑 **La deuda no se guarda: se deriva.**
> ```
> saldo(torneo) = tournaments.price − Σ abonos(torneo)
> ```
> Un torneo debe si tiene cupón `free_tournament` o `percentage = 100`, y su
> dueño no está en `revenue_share_excluded`.

De ahí salen tres propiedades gratis:

- **El upgrade sube la deuda solo.** `add-teams-dialog` ya reescribe
  `tournaments.price` con el nuevo precio de lista.
- **Pagar en efectivo la borra sola.** El proceso actual suelta el `coupon_id`,
  y sin cupón el torneo deja de estar en la lista de deudas.
- **No hay dos números que puedan desincronizarse**, que es el problema de
  guardar un saldo.

| # | Qué | Detalle |
|---|---|---|
| 1.1 | Tabla `tournament_debt_payments` | `tournament_id`, `organizer_id`, `period_month`, `amount_cop`, `note`, `created_by`, `created_at`. Solo abonos de publicidad; el pago en efectivo no va acá porque suelta el cupón. |
| 1.2 | Función `get_organizer_debts(p_user_id)` | Los torneos que debe y el saldo de cada uno. La usan el panel de cierre y la pantalla del organizador. |
| 1.3 | UI en el cierre del admin | Por cada organizador con saldo: lo que ganó, sus torneos pendientes, un campo de abono por torneo. Sugerido: la mitad de lo ganado sobre el torneo más viejo. |
| 1.4 | Los dos topes | Un abono ≤ saldo de ese torneo. La suma de abonos del mes ≤ lo ganado ese mes. |
| 1.5 | UI del organizador | En su corte: "− $15.000 abonados a Copa Verano — te quedan $85.000". Y el historial por torneo. |

**Dónde se guardan los abonos:** al cerrar el mes, junto con el corte. El monto
ganado (`ad_settlements.amount_cop`) **no se toca** — es inmutable por trigger y
tiene que seguir siéndolo. El abono va en su tabla, y la transferencia es la
resta de los dos. Así un abono mal puesto se corrige sin tocar lo que ganó.

---

### Fase 2 — Cobrar el saldo en efectivo

El botón de cobro que ya está especificado en `pago-duvan.md`
(`/api/payments/tournament-link`, la página `/pagar/torneo/[id]` y la rama
`type: "due"` en `fulfill.ts`).

⚠️ **Con la deuda encima cambia un detalle: el link tiene que cobrar el SALDO,
no el precio del torneo.** Si ya abonó $30.000 de publicidad y el link le cobra
los $100.000 completos, le cobraste dos veces lo mismo.

Sube de prioridad respecto a lo que decía `pago-duvan.md`: hoy olvidarse de
correr los dos SQL esconde un ingreso; con los abonos activos, además **le
sigue descontando plata a alguien que ya pagó**.

---

## 6. Lo que se descartó, y por qué

| Idea | Por qué no |
|---|---|
| **Que las vistas del torneo regalado no cuenten** | Se puede hacer, pero es un muro: el organizador no ve avance. Descontar es progreso y se explica mejor. |
| **Excluir el torneo regalado del reparto** | No hay forma limpia. Las personas-día se cuentan por organizador, no por torneo: quien ve dos torneos del mismo organizador el mismo día vale 1, y ese 1 no se puede partir entre uno regalado y uno pagado. Se esquiva llevando la deuda por torneo pero **pagándola con lo que el organizador gana en total**: nunca hace falta saber cuánto generó ese torneo en particular. Ver el recuadro de la sección 3. |
| **Bloquear el reparto hasta que pague su primer torneo** | Más simple, pero binario. No deja mostrar cuánto de la deuda cubrió su audiencia. |
| **Descontar un 50% fijo** | Queda solo como sugerencia. El dueño quiere decidir caso por caso. |
| **Distinguir regalo de fiado** | El sistema no puede: mismo cupón, mismo $0. Y con la deuda no hace falta. |

---

## 7. Relacionados

- `como-funciona-el-reparto.md` — cómo se calcula lo que gana cada organizador
- `pago-duvan.md` — el problema de cobrar un fiado, y el botón de cobro
- `programa-de-referidos.md` §4 — de dónde salió la idea del neteo
- `monetizacion-analitica-publicidad.md` — el detalle técnico del reparto
