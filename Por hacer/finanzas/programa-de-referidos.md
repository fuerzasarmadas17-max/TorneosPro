# Programa de referidos

**Estado:** reglas definidas, **no implementado**. Hoy se opera a mano.
**Fecha:** 2026-08-19.
**Origen:** Daniel, el organizador de vóley más grande de Sincelejo, propuso
cambiar recomendaciones por torneos. La idea es buena, pero tiene que quedar
como **programa abierto**, no como acuerdo personal con él — ver la sección 6.

---

## 1. Por qué existe

Un torneo vendido es un torneo. **Un organizador conseguido son 20 o 25 torneos
al año.**

Daniel solo mueve del orden de **$1,200,000 al año**. Si un recomendado se le
parece aunque sea a la mitad, pagar $70,000 una vez por conseguirlo es la
adquisición más barata que hay disponible. No es un descuento: es compra de
clientes.

Y hay algo que ninguna pauta compra: los organizadores se conocen entre ellos.
Daniel está conectado en otros municipios de Sucre. Esa red es el canal.

---

## 2. Las reglas — esto es lo que se le dice al organizador

> **Recomienda y gánate un torneo.**
>
> Si alguien que nunca ha comprado hace su primer torneo pago por
> recomendación tuya, **te regalamos un torneo de hasta 16 equipos** y **a él
> le hacemos 20% de descuento** en ese primer torneo.

Así de corto. Lo demás es letra menuda que se aplica, no que se pregona.

### Los números

| Concepto | Valor |
|---|---:|
| Premio al que recomienda | un torneo **Medio**, hasta 16 equipos — **$70,000** |
| Descuento al recomendado | **20%** sobre su primer torneo pago |
| Tope por organizador | **4 premios al año** |
| Vigencia del premio | **6 meses** desde que se gana |

> **La primera venta queda casi en cero y eso es a propósito.** Un Medio con
> 20% deja $56,000 y el premio cuesta $70,000. Se pierden $14,000 en la
> transacción para ganar un organizador que vale cientos de miles al año. Es
> el trato que queremos hacer.

---

## 3. La letra menuda

**Quién puede recomendar:** cualquier organizador que tenga al menos un torneo
pago. No es privilegio de nadie.

**Qué cuenta como recomendado válido:**

- Es un organizador **nuevo** — nunca ha pagado un torneo antes
- **Paga** su primer torneo. No cuenta registrarse, ni crear un torneo gratis,
  ni prometer
- Menciona quién lo recomendó **antes o durante** su compra, no después

**Cuándo se gana el premio:** el día que el recomendado **paga**. Ni antes.

**El premio no es plata.** No se cambia por efectivo, no se transfiere a otro
organizador, no se acumula para armar un tier más alto.

**El premio es hasta 16 equipos.** Si ese torneo crece a 17 o más, el
organizador **paga la diferencia** al tier que corresponda. Ver el ⚠️ de la
sección 5, porque hoy el sistema no cobra esa diferencia solo.

### 🔑 Si el que recomienda debe plata, el premio abona primero

Esta es la regla que hace que todo funcione.

Mientras un organizador tenga un torneo fiado sin pagar, **el premio se abona a
lo que debe** en vez de darle un torneo gratis. Cuando ya no deba nada, ahí sí
recibe torneos.

Con eso el que recomienda tiene motivo para traer gente **y** para saldar, en
vez de acumular regalos mientras la deuda queda quieta.

---

## 4. Cobrar contra la publicidad

Para organizadores con volumen —Daniel puede tener hasta 12 torneos activos—
el reparto de publicidad les genera ingreso propio. Ver
`como-funciona-el-reparto.md`.

**Ahí está la forma más limpia de cobrar una deuda: netearla contra lo que el
organizador gane de publicidad.** Sin perseguirlo, sin cuotas cada 15 días, sin
acordarse de correr SQL por cada abono. La deuda se paga con lo que él mismo
produce.

Y de paso lo engancha al lado de la plataforma que le da plata a él, que es lo
que la vuelve difícil de reemplazar.

**Falta definir:** si el neteo es automático o si se le propone y él acepta.
Cobrarle sin avisarle contra una plata que ya considera suya es una forma
rápida de dañar la relación.

---

## 5. Cómo se opera hoy, a mano

No hay nada construido. Por ahora:

1. Anotar en una hoja: **quién recomienda, a quién, fecha, si ya pagó, si ya se
   entregó el premio**
2. Al crear el torneo premio, crearlo con **cupón de cortesía**
3. Cuando el organizador use su premio, **verificar que no pase de 16 equipos**

### ⚠️ La fuga que hay que vigilar

El cupón de cortesía arrastra dos cosas conocidas (ver `pago-duvan.md`):

- **Finanzas muestra el torneo en $0.** Para un torneo premio eso está bien —
  de verdad fue gratis.
- **Los upgrades salen gratis para siempre.** Para un torneo premio esto **está
  mal**: el premio es hasta 16 equipos, pero si crece a 17 el sistema no cobra
  la diferencia.

> 🚨 **El sistema de cupones no sabe expresar "gratis hasta el tier Medio, y de
> ahí para arriba paga la diferencia".** Solo sabe "100% de descuento en todo".
> Mientras eso no se construya, hay que revisar a mano cada torneo premio que
> se acerque a 16 equipos.

Es el mismo problema de fondo de `pago-duvan.md`: el cupón significa cosas
distintas según el caso, y nadie puede distinguirlas mirando.

---

## 6. 🚩 El riesgo de verdad no es la plata

Es el precedente.

En Sincelejo los organizadores se conocen. El día que se sepa que a Daniel le
fiaron un torneo y le regalaron otro, esa conversación llega con todos los
demás. Y va a llegar — Daniel mismo la va a contar, porque es su argumento para
recomendar.

**Por eso esto tiene que llamarse programa desde el primer día, y cualquiera
tiene que poder ganárselo.** Si queda como el arreglo especial de Daniel, cada
organizador va a llegar a pedir el suyo y no hay respuesta buena. Si es un
programa con reglas escritas, la respuesta es "claro, aplica igual para ti".

### Lo otro que hay que vigilar

- **Auto-referidos.** Que alguien cree una cuenta nueva, se recomiende solo y
  pague un Básico de $40,000 para ganarse un Medio de $70,000. El tope de 4 al
  año lo limita, pero conviene mirar los nombres y las cédulas.
- **Canibalización.** Cada torneo premio es uno que probablemente iba a
  comprar. Con tope de 4 está acotado; sin tope es una fuga abierta.

---

## 7. El caso de Daniel — el primero, para dejarlo por escrito

**Lo acordado:**

| | |
|---|---|
| Torneo de **7 equipos** (Básico, $40,000) | **lo paga ahora** |
| Torneo de **13 equipos** (Medio, $70,000) | **se le fía** |
| Si cuaja un recomendado | ese torneo de 13 equipos **queda gratis** |

**Exposición real: $70,000.** No amerita cuotas cada 15 días — el enredo de
administrarlas cuesta más que la plata.

**Pendientes concretos:**

- [ ] Confirmar que pagó el Básico de $40,000
- [ ] **Soltar el `coupon_id` del torneo de 13 equipos apenas quede saldado**,
      sea con plata o con un recomendado
- [ ] Vigilar si ese torneo pasa de 16 equipos antes de saldarse — ahí el
      upgrade sale gratis y los $70,000 fiados se vuelven $100,000 regalados
- [ ] Proponerle el neteo contra sus ingresos de publicidad
- [ ] Decirle que esto es un programa, no un arreglo suyo, para que lo cuente
      así cuando recomiende

---

## 8. Qué habría que construir

Nada de esto bloquea arrancar a mano, pero con volumen se justifica.

| Pieza | Para qué |
|---|---|
| Tabla `referrals` | quién recomendó a quién, estado, si ya se entregó el premio |
| Código de referido por organizador | lo más simple es reusar su `slug` |
| **Cupón con tope de tier** | expresar "gratis hasta Medio, de ahí paga la diferencia" — arregla la fuga de la sección 5 |
| Panel de referidos del organizador | que vea cuántos lleva y cuántos premios tiene |
| Neteo contra publicidad | descontar deuda de lo que gane en el reparto |

El **cupón con tope de tier** es el que más importa: sin eso, cada torneo
premio hay que vigilarlo a mano y la fuga es invisible.
