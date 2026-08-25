# Cómo funciona Monetizar

Documentación de producto: qué es el programa de monetización, cómo se genera
la plata, quién cobra y cómo se paga. Escrito en presente, como funciona de
punta a punta.

Para la matemática del reparto en detalle, ver `como-funciona-el-reparto.md`.
Para el detalle técnico y las decisiones, `monetizacion-analitica-publicidad.md`.

**Última actualización:** 2026-08-24

> ℹ️ **Qué de esto ya está desplegado.**
> Todo lo de las secciones 1 a 5, 7 y 8 funciona hoy. La **sección 6 (torneos
> fiados y regalados)** está decidida pero todavía no construida —su
> especificación es `deuda-contra-publicidad.md`—. Los umbrales de la sección 5
> están puestos sin datos y se recalibran con agosto completo. Los dos números
> de la sección 8 (mínimo para transferir y plazo) siguen sin confirmar, y los
> términos no los revisó un abogado.

---

## 1. Qué es

Torneos Pro le vende espacios de publicidad a negocios locales. Esos avisos se
muestran a la gente que entra a consultar los torneos.

**Cuando un aviso aparece en el torneo de un organizador, ese organizador gana
una parte de lo que pagó el anunciante.**

El organizador no tiene que hacer nada: no vende, no gestiona, no contacta a
nadie. Su audiencia se cuenta sola.

---

## 2. De dónde sale la plata

Un negocio contrata una campaña. Esa campaña queda **segmentada**: una campaña
de Córdoba solo se muestra en torneos de Córdoba.

Cada persona ve como máximo **7 avisos por torneo y por día**. El tope es por
torneo y no global, a propósito: con un tope global, quien gastaba sus avisos en
el torneo de un organizador ya no generaba ninguno en los torneos que abría
después, y esos organizadores perdían el crédito de una persona que sí los
visitó.

**Audiencia sin campaña que la cubra no genera un peso.** Si una zona concentra
mucho público y no hay campañas apuntando ahí, es inventario sin vender — sirve
para saber dónde buscar anunciantes.

---

## 3. Cómo se cuenta la audiencia

La métrica es **persona-día**: una persona vale **1 por día**.

Cuántas veces entró ese día no importa.

> **Volver otro día suma. Refrescar el mismo día no.**

Se cuenta por separado en cada campaña y en cada organizador. La misma persona,
el mismo día, en torneos de dos organizadores distintos, le cuenta 1 a cada uno.

El "día" es el **día colombiano**, no el día UTC. Antes el día se cortaba a las
7 de la noche y quien entraba a las 6pm y volvía a las 8pm contaba como dos
personas-día — justo en el horario en que la gente revisa resultados.

---

## 4. Cómo se reparte

De cada campaña, **la mitad es para los organizadores** donde se mostró,
repartida según la audiencia que puso cada uno. La otra mitad es de la
plataforma.

Tres cosas que definen todo:

- **Cada campaña reparte solo su propia plata.** No hay bolsa común. Una campaña
  de Montería no le paga a un organizador de otra ciudad, ni siquiera si es el
  más grande de la plataforma.
- **Solo cuenta lo que el anunciante realmente pagó**, no el precio de lista. Si
  no pagó, no hay nada que repartir.
- **Se prorratea por los días al aire.** Una campaña del 15 de julio al 14 de
  agosto deja su parte en cada mes, no el total en los dos.

Las campañas **sin ánimo de lucro** (causas sociales, salud, avisos de la
comunidad) no se cobran, así que no reparten. No le quitan nada a nadie —cada
campaña reparte lo suyo— pero sí gastan uno de los 7 avisos del día. El
organizador las ve marcadas, para que no las confunda con un anunciante que
todavía no pagó.

Los montos cierran exactos con la bolsa: cada uno recibe su parte entera y los
pesos sobrantes se reparten de a uno. Si al multiplicar a mano da $1 de
diferencia, no es un error.

---

## 5. Quién puede cobrar

**Nadie cobra hasta que un admin lo apruebe.** Es lista blanca, no lista negra:
cuando hay plata de por medio, el que se equivoca por omisión no puede ser el
que paga.

Además, cada mes hay que cumplir ocho mínimos:

| Requisito | Mínimo |
|---|---|
| Personas que entraron a sus torneos | 300 |
| Días con audiencia | 8 |
| Partidos con resultado cargado | 10 |
| Equipos en su torneo más grande | 6 |
| Torneos en curso | 1 |
| Días desde que creó la cuenta | 30 |
| Perfil con nombre y logo | sí |
| Datos de pago aprobados | sí |

Se miden **mes a mes y arrancan de cero**. Cumplir en agosto no asegura
septiembre.

El organizador ve su progreso en pantalla. El porcentaje que ve es el **mínimo**
de los requisitos, no el promedio: como hay que cumplirlos todos, lo que importa
es el que va más atrás. Un promedio diría "vas al 85%" con un requisito en cero.

**Si un mes no clasifica, su audiencia igual cuenta para dividir la bolsa, pero
su parte queda con la plataforma.** No se reparte entre los demás. Es
deliberado: si el denominador fueran solo los que clasifican, ellos cobrarían
más que su aporte real.

Aparte de los requisitos, una cuenta puede quedar **excluida permanentemente**
por política —cuentas de prueba, demos, socios—. "Todavía no aprobado" y "no
participa nunca" son estados distintos: al primero se le dice qué le falta, al
segundo no.

---

## 6. Torneos fiados y regalados

Cuando se le regala o se le fía un torneo a un organizador, ese torneo queda
como **deuda** por su precio de lista. Lo que el organizador gana con la
publicidad le va abonando esa deuda, y se le transfiere la diferencia.

| Cómo se creó el torneo | ¿Queda debiendo? | ¿Cobra publicidad? |
|---|---|---|
| Pagado normal | No | Completo |
| Pagado con crédito de paquete | No | Completo |
| Con descuento (30%, 50%…) | **No** | Completo |
| Fiado | Sí, el precio de lista | Sí, pero abona |
| Regalado | Sí, el precio de lista | Sí, pero abona |
| Cupón del 100% | Sí, el precio de lista | Sí, pero abona |

**La regla: no importa si se le hizo un favor, importa si debe plata.** Un
descuento es un precio, no un préstamo — el que pagó $70.000 con 30% OFF pagó lo
que se le pidió, y entra al reparto completo desde el primer día.

### Cuánto debe

> **Saldo = precio de lista actual del torneo − todo lo que ya abonó**

El bono que se le dio define si debe: un **100%** significa que no tenía con qué pagar
y debe el total; un 30% o un 50% fue una cortesía de verdad y no debe nada.

Si el torneo **sube de plan**, el upgrade se le deja gratis y la deuda sube con
él — esa plata se cobra igual. Si debía $70.000, ya abonó $30.000 y el torneo
pasa a $100.000, el saldo queda en $70.000.

Los **premios de referidos** se entregan como descuento en %, así que no generan
deuda. Las cuentas de prueba, demos y socios tampoco acumulan: nunca ganan
publicidad, así que una deuda ahí no bajaría nunca.

### Cuánto se abona

**La deuda es por torneo.** Un organizador puede deber varios a la vez, cada uno
con su propio saldo, y cada abono se imputa a un torneo concreto.

Cuánto abonar lo decide el dueño **mes a mes, caso por caso**, viendo el saldo y
los abonos anteriores. No hay porcentaje fijo: viene sugerida la mitad sobre el
torneo más viejo y se puede cambiar.

El organizador lo ve así en su corte del mes:

> **Agosto 2026**
> Ganaste **$30.000**
> − $15.000 abonados a **Copa Verano** — te quedan $85.000
> **Te transferimos $15.000**

Y en cada torneo que debe tiene el historial de abonos con fecha. Lo que lo
mantiene enganchado es ver el saldo bajar.

Un abono nunca pasa del saldo de ese torneo, y la suma de los abonos del mes
nunca pasa de lo que ganó. **Y no dependen del mínimo para transferir:** aunque
ese mes no haya transferencia, la deuda baja igual.

### Lo que hay que tener claro al ofrecerlo

⚠️ **La deuda no baja hasta que el organizador clasifique.** Si no cumple los
ocho requisitos, gana $0, y $0 no abona nada. Al organizador chico —justo al que
se le fía— la publicidad no le alcanza en meses.

Por eso se promete así:

| ❌ No decir | ✅ Decir |
|---|---|
| "Te fío el torneo y la publicidad me lo va pagando" | "Cuando empieces a cobrar publicidad, eso te va bajando lo que debés" |

Sirve de gancho y de cobro pasivo. **No reemplaza el cobro en efectivo.**

---

## 7. Qué ve el organizador, y qué no

| Momento | Qué ve |
|---|---|
| **Durante el mes** | Cuánta gente entró a sus torneos. Nada de plata. |
| **Mes cerrado** | El monto, congelado, que ya no cambia. |

Durante el mes no se le muestra un monto porque **el monto todavía no existe**:
lo que paga cada campaña se reparte entre todos los organizadores donde se
mostró, así que cualquier cifra bajaría sola cuando otro sume audiencia. Un
número que se lee como promesa y después baja es la conversación que este diseño
evita.

**Lo que nunca ve:** cuánto pagó el anunciante, ni qué porcentaje de la campaña
le tocó. Se le muestra una **tarifa** ("esta campaña paga $85 por persona"), que
explica igual de bien de dónde salió su plata pero no se puede invertir. Con el
porcentaje sí: monto ÷ porcentaje ÷ 50% da exactamente lo que pagó el
anunciante — y acá los anunciantes son negocios de la misma ciudad que el
organizador.

---

## 8. Cuándo y cómo se paga

Cuando el mes termina, el admin cierra el corte. Ahí se calcula, **se congela** y
aparece en el histórico del organizador. Ese número no cambia más.

El corte es inmutable por regla de la base de datos, no por intención: solo se
puede mover el estado de cobro. Para corregir un corte hay que anularlo y cerrar
el mes de nuevo.

- Se transfiere dentro de los **primeros 15 días** del mes siguiente.
- Si el corte es menor a **$50.000**, no se transfiere: se acumula para el
  siguiente que llegue al mínimo.
- Solo a la cuenta que el organizador registró, a su nombre o al de su
  organización. Nunca a terceros.
- Si cambia su cuenta bancaria, los datos nuevos **vuelven a revisión**.

Lo que recibe es un ingreso suyo y responde por sus impuestos. Si por ley
corresponde una retención, se aplica y se le informa junto con el corte.

---

## 9. Qué deja a alguien afuera

- Inflar la audiencia artificialmente: recargar sus propios torneos, pedirle a
  gente que entre solo para sumar, usar programas automáticos.
- Cargar torneos, equipos o resultados falsos.

Se anula el corte del mes y puede salir del programa. La cuenta de torneos sigue
funcionando normal: lo que se pierde es la monetización. **Antes de anular nada
se le escribe y se le da la oportunidad de explicar.**

---

## 10. Las reglas que siempre se cumplen

Si alguna no cuadra, es un bug:

| Regla | |
|---|---|
| `a transferir + retenido = la bolsa` | por campaña y en total |
| `bolsa = cobrado × 50%` | redondeado hacia abajo |
| La suma de los meses de una campaña nunca excede lo cobrado | por el prorrateo |
| Una persona aporta como máximo 1 por día, campaña y organizador | |
| Suma de aportes ≥ personas-día distintas de la campaña | nunca al revés |
| El abono nunca supera lo ganado en el mes ni el saldo de la deuda | |
| Lo que ganó no cambia nunca; lo que se abonó es lo único editable | |
