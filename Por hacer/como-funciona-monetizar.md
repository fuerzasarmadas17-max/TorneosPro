# Cómo funciona Monetizar

Documentación de producto: qué es el programa de monetización, cómo se genera
la plata, quién cobra y cómo se paga. Escrito en presente, como funciona de
punta a punta.

Para la matemática del reparto en detalle, ver `como-funciona-el-reparto.md`.
Para el detalle técnico y las decisiones, `monetizacion-analitica-publicidad.md`.

**Última actualización:** 2026-08-25

> ℹ️ **Todo lo que dice este documento está en producción.** La sección se abrió
> a los organizadores el 2026-08-25 (`MONETIZAR_ENABLED`).
>
> Tres cosas siguen abiertas y conviene tenerlas a la vista:
> **(1)** los umbrales de la sección 5 se pusieron sin datos y se calibran con
> agosto completo — mientras tanto es normal que casi nadie clasifique;
> **(2)** el punto de impuestos y retenciones de los términos no lo revisó un
> contador; **(3)** el mínimo de $50.000 y el plazo de 15 días de la sección 8
> siguen siendo una propuesta, y cambiarlos ahora obliga a que todos vuelvan a
> aceptar los términos.

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

De cada campaña, una parte es para los organizadores donde se mostró,
repartida según la audiencia que puso cada uno. El resto es de la plataforma.

**El porcentaje es un piso, no un número fijo.** Los términos garantizan **al
menos el 30%**; por encima de eso lo define cada campaña y puede cambiar de una
a otra. Hoy se reparte el **50%**.

Está escrito así a propósito, y resuelve dos cosas de una:

1. **Bajarlo no es un recorte.** Con un 50% fijo en los términos, moverlo
   obligaba a que todos volvieran a aceptar y se leía como que les quitaron
   algo. Con un piso, ir bajando hacia el 30% a medida que crezcan las pautas
   es simplemente cómo funciona.
2. **Deja lugar para la comisión.** Como el porcentaje de cada campaña puede
   variar, descontar la comisión del que trajo al anunciante antes de repartir
   no le exige explicación a nadie: los otros organizadores no ven un recorte,
   ven la tarifa de esa campaña, que siempre fue propia de cada una.

Se decidió el 2026-08-25, cuando todavía no lo había aceptado casi nadie: era
la única semana en que el cambio salía gratis.

### Si el organizador consigue al anunciante, cobra aparte

Una comisión de **al menos el 15%** de todo lo que ese anunciante pague durante
sus **primeros 6 meses**, contados desde su primera campaña, **además** de lo
que le toque por audiencia.

Sale **antes del reparto**: una campaña de $100.000 deja $15.000 de comisión y
se reparte sobre los $85.000 restantes.

Es deliberado que la comisión pese tanto frente al reparto por audiencia: la
audiencia es abundante —viene gratis con el producto que ya se les vendió— y
los anunciantes son el cuello de botella. Pagar más por lo que falta que por lo
que sobra.

Y los 6 meses en vez de un año: suficiente para que le convenga traer un
anunciante que se quede, sin dejar una obligación abierta para siempre.

⚠️ **Todavía no está construido**, pero se puede operar hoy sin tocar código:
al cargar lo que cobró la campaña en el panel, se registra el monto **ya sin la
comisión** ($85.000 en vez de $100.000), y esa plata se le transfiere aparte al
organizador que la trajo. El reparto calcula bien sobre el resto.

El costo de hacerlo así es que Finanzas registra $85.000 donde el anunciante
pagó $100.000. Con pocas campañas es asumible; cuando sean varias, la comisión
tiene que ser su propio registro para que los libros digan la verdad.

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

### Un mes puede dar cero, y no es un error

Lo que se reparte es lo que pagaron los anunciantes, **no las vistas**. Si en un
mes no hubo ninguna campaña paga que llegara a los torneos de un organizador
—porque no había anunciantes buscando su zona, o porque las que se mostraron
eran sociales— su corte es cero por más audiencia que haya tenido.

No se acumula para el mes siguiente: cada mes se liquida por su cuenta. Pero su
audiencia **sí cuenta para los mínimos**, así que no pierde el mes: cuando
aparezca un anunciante en su zona ya va a estar listo para cobrar.

Está escrito en los términos, sección "Puede que un mes no ganes nada, y no es
un error". Importa decirlo: con poca publicidad vendida, el primer mes en cero
es el caso normal, y sin avisarlo se lee como que el sistema falló.

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
los abonos anteriores. No hay porcentaje fijo. Los términos también dejan
abierto **acordarlo con el organizador** si prefiere otro ritmo; lo que no se
negocia son los dos límites: nunca más de lo que ganó ese mes, nunca más de lo
que queda del saldo.

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

### Cómo se opera, mes a mes

1. Se **cierra el mes** como siempre. El cierre no sabe nada de deudas: calcula
   y congela lo que ganó cada uno, y ahí termina su trabajo.
2. Debajo del corte aparece **"Abonos a torneos fiados"**, con cada organizador
   que ganó algo y además debe: lo que ganó, sus torneos pendientes y un campo
   por torneo.
3. Se cargan los abonos. Si alguno pagó en efectivo, el botón **"Pagó en
   efectivo"** salda el resto de una.
4. El **archivo para el banco** se genera con lo que ganó **menos lo abonado**.
   Los que quedaron en cero no salen en el archivo.

**Lo que ganó no se toca nunca.** Es inmutable por regla de la base, y es la
cifra que el organizador ve en su histórico. El abono vive aparte y la
transferencia es la resta de los dos, así un abono mal cargado se corrige sin
tocar el número que él ya vio.

### La deuda se marca a mano, no se deduce del cupón

Un cupón de cortesía significa *"no pagó"*, que **no** es lo mismo que
*"me debe"*. Se verificó contra producción el 2026-08-25: de 16 torneos con bono
del 100% vigente, 15 eran regalos y solo uno era deuda real.

Desde esa fecha, **todo torneo creado con un bono del 100% registra su deuda
automáticamente** (`/api/tournaments/debt`, al crearse). Los 15 regalos
anteriores quedaron como estaban.

⚠️ Ese registro es *best effort*: si la llamada falla, el organizador se queda
con su torneo igual y la deuda **no se crea, sin avisar a nadie**. La columna
`deuda_registrada` de `consultas/deudas-de-torneos-fiados.sql` es la red que lo
caza. Conviene correrla de vez en cuando.

⚠️ **Y pagar en efectivo no borra la deuda solo.** Hay que usar el botón. El día
que exista el link de cobro (`pago-duvan.md`), tiene que cobrar el **saldo** y
no el precio del torneo, o se le cobra dos veces lo que ya abonó con publicidad.

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

---

## 11. Por qué no se hizo de otra forma

Decisiones ya tomadas sobre la deuda de los torneos fiados, con el motivo, para
no volver a discutirlas.

| Idea | Por qué no |
|---|---|
| **Que las vistas de un torneo fiado no cuenten** | Se puede, pero es un muro: el organizador no ve avance. Descontar es progreso y se explica mejor. |
| **Excluir el torneo fiado del reparto** | No hay forma limpia. Las personas-día se cuentan por organizador, no por torneo: quien ve dos torneos del mismo organizador el mismo día vale 1, y ese 1 no se puede partir entre uno fiado y uno pagado. |
| **Deducir la deuda del cupón de cortesía** | Probado contra producción: 15 de 16 cortesías eran regalos. El cupón dice "no pagó", no "me debe". |
| **Bloquear el reparto hasta que pague su primer torneo** | Más simple, pero binario: no deja mostrarle cuánto de la deuda cubrió su audiencia. |
| **Descontar un 50% fijo** | Quedó solo como sugerencia editable. El monto se decide caso por caso. |
| **Guardar el monto de la deuda** | Se deriva de `tournaments.price` menos los abonos. Guardarlo crearía dos números que tendrían que coincidir para siempre — y así la deuda sube sola cuando el torneo sube de plan. |
| **Una columna `es_fiado` en `tournaments`** | La policy "Creador edita torneo" deja que el organizador actualice su propio torneo: la deuda sería editable por el deudor. Va en tabla aparte. |
| **Cargar los abonos durante el cierre** | No se puede decidir cuánto abonarle hasta saber cuánto ganó, y eso lo produce el cierre. Además obligaba a tocar `close_ad_period`, que es la función que valida y congela la plata. |
| **Borrar la deuda al pagar en efectivo** | Se llevaría por delante el historial de lo que ya se le había descontado de su publicidad. Se registra un abono por el saldo restante. |
