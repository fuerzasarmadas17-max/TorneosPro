# Plan: analítica de publicidad y reparto con organizadores

**Estado:** todo desplegado hasta la evaluación de umbrales. Falta la **sección
que ve el organizador** (especificada abajo en el Paso 3) y **calibrar los
umbrales** con agosto completo.
**Última actualización:** 2026-07-30

> **Revisado el 2026-08-06.** Confirmado contra el código: los Pasos 0, 1 y 2
> están hechos, las 9 migraciones existen y el tope de frecuencia también.
> **Del Paso 3 sigue sin construirse todo lo del lado del organizador**: no
> existe `get_my_ad_earnings`, ni la policy de lectura en `ad_settlements`, ni
> pantalla de datos de pago, ni sección "Monetizar" — `organizer_payout_info`
> solo aparece mencionado en la migración, sin UI. El documento queda tal cual
> porque es la especificación de lo que falta.
>
> 🔴 **El ensayo del 1 de agosto NO se corrió.** Verificado el 2026-08-06:
> `ad_settlements` está vacía, sin una sola fila. **El camino de cierre sigue
> sin ejecutarse ni una vez** — que era justo lo que el ensayo venía a evitar.
> Ver *Estado del ensayo* más abajo.

### Fechas que importan

| Cuándo | Qué |
|---|---|
| ~~1 de agosto 2026~~ | Cerrar julio como **ensayo**. ❌ **No se hizo.** Ver abajo. |
| **Septiembre 2026** | Calibrar `monetization_config` con agosto, el primer mes limpio. Los números actuales se pusieron sin datos. **Y cerrar agosto — que ahora sería el primer cierre real, sin ensayo previo, salvo que se haga el de julio antes.** |

### Estado del ensayo (2026-08-06)

`ad_settlements` está **vacía**: `close_ad_period` nunca se ejecutó. La fecha
del 1 de agosto pasó sin que se corriera.

**El ensayo sigue valiendo la pena, y se puede hacer con julio cuando sea** —
`close_ad_period` acepta cualquier mes ya terminado, no solo el recién pasado.
No es una ventana que se cerró.

Cómo: `/admin/ads` → pestaña **Reparto** → período **"Mes pasado"** → botón
**"Cerrar el mes"**. Después anular lo que haya quedado (`status = 'void'`).

**Qué esperar:** probablemente **cero cortes**. `visitor_id` en
`analytics_events` existe desde el 29 de julio, así que julio tiene ~2 días de
dato contra un umbral de 300 personas-día — no va a clasificar nadie, y solo se
mandan los organizadores elegibles con monto mayor que cero. Eso **no lo hace
inútil**: ejercita las cuatro validaciones de la función (mes terminado, no
cerrar dos veces, la bolsa como techo, y las personas-día re-derivadas contra
las que manda el panel). Si algo de eso está roto, es mucho mejor descubrirlo
ahora que en septiembre con plata real de por medio.

⚠️ **Si el cierre sí genera cortes, anularlos el mismo día.** Un corte en
`issued` que quede olvidado le aparece al organizador como plata que se le debe
el día que se prenda su sección.

### Todo lo desplegado

| Migración | Qué agregó |
|---|---|
| `20260729` | `visitor_id` en `analytics_events` |
| `20260729b` | `get_ad_analytics` — agrega en Postgres, no en el navegador |
| `20260729c` | corte campaña × organizador y `by_organizer` |
| `20260729d` | `is_authenticated` en `page_views` |
| `20260729e` | reparto **por campaña** + `revenue_share_excluded` |
| `20260729f` | corte congelado (`ad_settlements`) y estado de cobro |
| `20260729g` | `record_view_duration` — arregla el tiempo promedio |
| `20260730` | `get_monetization_status` + `monetization_config` |
| `20260730b` | `organizer_payout_info` + requisito (apagado) |

Más, sin migración: tope de 7 avisos por persona/torneo/día, panel en dos
pestañas, reparto sobre lo **cobrado** y prorrateado, y personas-día en las
tarjetas de analítica.

---

## Para qué es esto

Repartir con los organizadores el 50% de lo que se cobra por publicidad, de
forma proporcional a la audiencia que cada uno aporta. Para eso hacen falta
tres cosas que hoy no existen: una métrica que no se pueda inflar, una vista
de admin que muestre la verdad, y una sección donde el organizador vea lo suyo
y cobre.

Este documento cubre la parte técnica. El modelo comercial (planes, precios,
requisitos para monetizar) se decide aparte.

📖 **Para entender cómo se calcula el reparto sin entrar al detalle técnico, ver
`como-funciona-el-reparto.md`** — la métrica, la cuenta paso a paso y un ejemplo
completo, con tablas.

---

## La métrica: PERSONA-DÍA

**Definición:** visitantes distintos que vieron la publicidad cada día,
sumados a lo largo del mes.

Se llegó a ella descartando dos alternativas:

| Métrica | Por qué no |
|---|---|
| **Impresiones crudas** | Quien refresca genera una impresión por carga. Pagar por eso es invitar a inflarlo. El tope de 7 por torneo y día (ver más abajo) acota el abuso, pero no cambia el fondo del problema: la impresión mide cargas, no gente. |
| **Personas únicas del mes** | Se estanca. Un torneo de 20 equipos tiene ~200 personas el primer fin de semana y las mismas 200 al final, aunque hayan vuelto 15 veces. Subestima el valor real entregado al anunciante. |

**Persona-día resuelve las dos.** 200 personas × 15 fechas = 3.000, o sea crece
con la actividad real del torneo. Pero quien recarga 50 veces el sábado aporta
1, porque el `visitor_id` vive en `localStorage` y no se mueve durante esa
sentada.

Además se explica en una frase de los dos lados: al organizador "te pago por
persona que vuelve cada día", al anunciante "tu marca llegó a 3.000
personas-día".

### Precisión del visitor_id

Vive en `localStorage` (`lib/analytics.ts:16`), así que **no cambia** entre
pestañas, ni al cerrar el navegador, ni al reiniciar el teléfono.

Cambia cuando: otro navegador en el mismo celular, el navegador interno de
WhatsApp/Instagram (relevante — así se comparten los links), incógnito, borrar
datos, o iOS Safari tras 7 días sin visitar.

**Nada de eso afecta la métrica**, porque persona-día solo necesita que el ID
sea estable *dentro del mismo día*, y todos esos casos ocurren entre días.

El sesgo que queda es hacia **contar de más** (la misma persona desde WhatsApp
y desde Chrome son dos), estimado en 10-20% y parejo entre organizadores. Como
el reparto es proporcional, un sesgo parejo se cancela. Comunicar siempre como
"personas-día estimadas", nunca como cifra exacta.

---

## Paso 0 — visitor_id en los eventos ✅ desplegado

`page_views` ya tenía `visitor_id` desde `20260720_analytics_visitor_id.sql`,
pero `analytics_events` se quedó solo con `session_id` — que caduca a los 30
min, así que alguien entrando mañana, tarde y noche contaba como tres personas.

**Hecho:**
- Migración `20260729_analytics_events_visitor_id.sql`: columna + dos índices
  (uno por `event_type, created_at, visitor_id` para el corte mensual, otro
  incluyendo `tournament_id` para el desglose por organizador).
- `trackEvent` (`lib/analytics.ts`) ahora manda `visitor_id`.
- Migración corrida y código desplegado.

**Por qué fue primero:** aplica solo hacia adelante. Las impresiones ya
registradas no tienen persona y no se pueden reconstruir. Cada día sin
desplegar es un día de datos que no vas a poder liquidar.

⚠️ **Al desplegar:** la migración ya está aplicada, así que no hay ventana de
riesgo. Pero ojo que `trackEvent` falla en silencio a propósito
(`ad-modal.tsx:107`), así que un error acá no se ve — se pierden datos sin
aviso.

---

## Paso 1 — RPC de agregación + vista de admin ✅ desplegado

**Hecho:**
- Migración `20260729b_get_ad_analytics.sql`: RPC `get_ad_analytics(p_from,
  p_to)`, admin-only vía `SECURITY DEFINER` + chequeo contra `users.role`
  (mismo patrón que `get_global_analytics`). Devuelve cuatro cortes ya
  agregados — `by_campaign`, `by_tournament`, `detail`, `totals` — porque
  personas-día no es aditivo y cada nivel necesita su propio `COUNT(DISTINCT)`.
  **Ya corrida en la base** (verificado el 2026-07-29: responde `null` a un
  anónimo, no `PGRST202`).
- `admin/ads/page.tsx`: reemplazado el `.select()` sin paginar por la RPC,
  filtro de período (mes en curso / mes pasado / histórico), columna y tarjeta
  de personas-día, aviso de error de métricas y aviso de cobertura parcial
  mientras el histórico no tenga `visitor_id`.

El corte por organizador quedó para el Paso 2: agruparlo en el cliente desde
`by_tournament` vuelve a ser una suma y cuenta doble a quien ve dos torneos del
mismo organizador el mismo día.

<details>
<summary>Notas de diseño del paso (por qué se hizo así)</summary>

### El problema que arregla

`admin/ads/page.tsx:221` se trae **todos** los eventos de publicidad al
navegador y los cuenta en JavaScript, sin `.range()`:

```js
supabase.from("analytics_events")
  .select("target_id, event_type")
  .in("event_type", ["ad_impression", "ad_click"])
```

PostgREST corta en 1000 filas por defecto. Es el mismo problema que el propio
código ya resuelve en `fetchMatchEventsByMatchIds` (`db/tournaments.ts:121`).

**Estado medido el 2026-07-29:** 796 eventos históricos, de los cuales 770
impresiones son solo de julio. Todavía por debajo del corte, o sea los números
del panel hoy son correctos — pero a ese ritmo se cruza en una semana y a
partir de ahí el contador se congela sin avisar.

### Qué se construye

**Una RPC `get_ad_analytics(desde, hasta)`** que agrupa por campaña × torneo y
devuelve impresiones, clics y personas-día. Postgres cuenta y devuelve decenas
de filas en vez de mandar decenas de miles al navegador. Mismo patrón que
`get_organizer_tournament_views` y `get_global_analytics`, que ya existen.

De esa única función salen todos los cortes sumando en el cliente sobre pocas
filas: por campaña, por torneo, por organizador. El corte por organizador sale
solo, porque cada torneo tiene `created_by`.

Índices: los del Paso 0.
Migración de datos: ninguna. El histórico ya tiene `tournament_id` y
`target_id` desde `ad-modal.tsx:101` y `:176`.

**En la UI de `/admin/publicidad`:**
- Reemplazar el conteo roto por la llamada a la RPC.
- Filtro de fechas: mes en curso / mes pasado / rango. Sin esto no hay corte
  mensual, y hoy el panel muestra el histórico completo mezclado.
- Columna de personas-día junto a impresiones, clics y CTR.

### Cuidado con sumar personas-día por campaña

**No se suman.** La misma persona en el mismo día puede ver dos campañas
distintas, porque el modal rota ponderado por monto. Por eso esa columna sirve
para el informe a cada anunciante, no para totalizar.

Para la liquidación se cuenta distinto: personas-día del **torneo**, sin
importar qué campaña vieron. Ahí sí suma y da el 100%.

</details>

---

## Paso 2 — Detalle por campaña y reparto por organizador ✅ hecho

**Hecho:**
- Migración `20260729c_ad_analytics_by_organizer.sql`: agrega el corte
  `by_organizer` a `get_ad_analytics`, calculado en la base, y `organizer_name`
  a `by_tournament` y `detail`. Ya corrida.
- `lib/ad-analytics.ts`: tipos de la RPC y `computeRevenueShare`, fuera del
  componente para que el cálculo de plata se pueda leer y probar solo.
- `components/ads/ad-campaign-detail.tsx`: desglose de una campaña por torneo
  y organizador — el informe al anunciante.
- `components/ads/ad-revenue-share.tsx`: tabla de reparto con personas-día,
  porcentaje y monto por organizador.

**El cobro de cada campaña se precarga de `monthly_price` y se puede corregir.**
Lo que queda por decidir es si la fuente definitiva es lo facturado o lo
efectivamente recaudado (`ad_payments`), y cómo prorratear una campaña que cruza
dos meses. Mientras eso se decida, el admin ajusta a mano.

### El reparto es POR CAMPAÑA, no por fondo único

Corregido el 2026-07-29, después de que el organizador preguntara qué pasa con
una campaña dirigida a Córdoba que solo sale en torneos de dos organizadores
nuevos de Montería.

**El hueco:** con fondo único, la plata se repartía según las personas-día
totales de cada organizador en la plataforma. Pero las campañas están
segmentadas. Esa campaña de $600.000 le habría pagado ~$147.000 al organizador
más grande —que aportó CERO audiencia a esa campaña— mientras los dos que
entregaron el 100% recibían migajas. El anunciante de Montería financiando a un
organizador de otro departamento.

**La corrección:** cada campaña reparte su propia plata entre quienes le
entregaron audiencia a ELLA. El pago de un organizador es la suma de sus
tajadas. En el ejemplo, Pedro (400 personas-día) cobra $200.000 y Luisa (200)
cobra $100.000; los demás, cero.

Eso exige el cruce campaña × organizador (`by_campaign_organizer`), que no se
puede armar en el cliente agrupando `detail`: sería una suma, y quien vio la
misma campaña en dos torneos del mismo organizador el mismo día contaría dos
veces.

**Cada campaña tiene su propia tarifa por persona-día**, y es correcto: una
campaña departamental chica paga más por persona que una nacional grande,
porque su bolsa se divide entre menos audiencia.

**Beneficio lateral:** con reparto por campaña, el monto sale de
`ad_campaigns.monthly_price` en vez de ser un número escrito a mano. El panel lo
precarga desde ahí y deja corregirlo (una campaña que arrancó a mitad de mes
cobra menos).

### El denominador incluye a los que no cobran

El porcentaje de un organizador que no participa del reparto —cuenta excluida o
que no llegó al umbral— **se queda con la plataforma y no se redistribuye**.

Por eso el denominador de cada campaña son todos los que aportaron, no solo los
elegibles: si fueran solo los elegibles, absorberían esa parte y cobrarían más
que su aporte real. Se cumple siempre `payableCop + retainedCop === poolCop`.

### Cuentas excluidas

`users.revenue_share_excluded` marca cuentas que no cobran. Se marca explícito y
no se adivina por rol ni por nombre, para poder excluir una cuenta de demo o un
socio sin tocar código.

La cuenta de pruebas de la plataforma ("Torneos Pro") quedó marcada en la
migración `20260729e`: hasta entonces habría entrado a cobrar como cualquier
organizador.

### Los montos se reparten por residuo mayor

Redondear cada fila por separado descuadra contra el fondo (con 5
organizadores, hasta $2-3 de más o de menos). Cada fila recibe su piso entero
y los pesos sobrantes van de a uno a las fracciones más grandes, así la suma da
el fondo exacto. Verificado contra el ejemplo de abajo: reproduce los cinco
montos al peso.

### Ejemplo validado con el modelo comercial

Fondo $600.000 → 50% tuyo ($300.000) → quedan $300.000 entre 10.000
personas-día = **$30 por persona-día**.

| Organizador | Personas-día | % | A transferir |
|---|---:|---:|---:|
| Carlos M. | 5.000 | 50,0% | $150.000 |
| Andrea R. | 2.200 | 22,0% | $66.000 |
| Julián P. | 1.400 | 14,0% | $42.000 |
| Marta L. | 900 | 9,0% | $27.000 |
| Luis G. | 500 | 5,0% | $15.000 |

**Nota de operación:** con 5 organizadores y uno dominante, el primero se
lleva la mitad del fondo siempre. Es justo, pero el de abajo recibe $15.000 y
puede sentir que no vale la pena. El mensaje "entre más compartas, más te
llega" tiene que ser explícito desde el arranque.

**El CTR no sirve para repartir.** Sale parejo entre torneos (1,3%-1,9%)
porque el modal es el mismo. Sirve para comparar campañas entre sí, no para
premiar organizadores.

---

## Paso 3 — Sección "Monetizar" del organizador

**La plomería está lista; falta la pantalla.**

### Hecho

- ✅ **Corte mensual congelado y estado de cobro** (`20260729f`) — ver abajo.
- ✅ **Evaluación de los umbrales.** `get_monetization_status(mes)`
  (`20260730`, ampliada en `20260730b`) calcula los requisitos por organizador,
  con los umbrales en `monetization_config` para poder moverlos con un `UPDATE`.

  Sirve a los dos lados: el admin ve todos, un organizador ve solo el suyo. Así
  el panel y esta sección usan **la misma cuenta** y no puede haber dos
  versiones de "quién clasifica" que discrepen.

  Si la consulta falla, el reparto cae a un fallback **permisivo** y el panel lo
  avisa en rojo. Es deliberado: un fallo de red se debe ver como "no sé", no
  como "nadie clasificó" —que dejaría el reparto en cero y parecería un mes malo.
- ✅ **Datos de pago** (`20260730b`). `organizer_payout_info`: nombre completo,
  tipo y número de documento, banco, tipo de cuenta y número. Tabla aparte del
  perfil, que es público. El dueño escribe lo suyo; el admin **solo lee**.

### Falta — el orden de trabajo (definido 2026-08-06)

El criterio del orden: **primero lo que no depende de nadie ni de ninguna
fecha, y dentro de eso, lo que desbloquea a lo demás.** Los pasos 1 a 3 son la
plomería que se puede hacer hoy mismo; el 4 y el 5 son decisiones tuyas que hay
que tomar antes de que el organizador vea una cifra; el 6 es la pantalla, que
necesita todo lo anterior; el 7 y el 8 vienen después de que exista.

| # | Qué | Depende de | Se puede hacer ya |
|---|---|---|---|
| **1** | **RPC `get_my_ad_earnings(mes)`** — le devuelve al organizador sus personas-día por campaña y por torneo, y su participación. No puede reusar `get_ad_analytics`, que es admin-only. | nada | ✅ sí |
| **2** | **Policy de lectura en `ad_settlements`** (`organizer_id = auth.uid()`, solo cortes no anulados). | va junto con la 1 | ✅ sí |
| **3** | **Pintar el desglose por campaña.** Ya se calcula y ya se guarda en `ad_settlements.breakdown`, pero hoy no se muestra en ningún lado — se quitó al simplificar el panel de admin. Hace falta en los dos lados. | nada | ✅ sí |
| **4** | **Términos y condiciones del programa** — cómo se calcula, cuándo se paga, y que el estimado del mes puede bajar. Más las columnas para guardar **cuándo** aceptó y **qué versión**. | decisión + redacción tuya | 🟡 depende de vos |
| **5** | **Decidir cómo se entera de que tiene plata.** No hay correo transaccional ni notificaciones de ningún tipo en la app. Al arranque puede vivir solo adentro, pero hay que decidirlo. | decisión tuya | 🟡 depende de vos |
| **6** | **La pantalla "Monetizar"** — las tres etapas del flujo de más abajo: datos y términos → qué le falta para clasificar → cuánto ganó y por qué. | 1, 2, 3, 4 | ❌ |
| **7** | **Prender `require_payout_info`** (un `UPDATE` en `monetization_config`). | que exista la pantalla (6) | ❌ |
| **8** | **Calibrar los umbrales** con agosto completo. | agosto cerrado → septiembre | ❌ hasta septiembre |

**En paralelo, cuando quieras:** el **ensayo de cierre** con julio (ver
*Estado del ensayo* arriba). No bloquea nada de esta lista, pero conviene
hacerlo antes de septiembre, que es el primer cierre que cuenta.

**Por qué la policy de lectura (2) no se hizo antes:** mostrarle cifras al
organizador sin la sección armada es filtrar plata a medias. Ahora entra
temprano a propósito — es plomería sin UI, no expone nada mientras la pantalla
no exista, y se puede probar sola.

⚠️ **Un requisito previo a todo esto que no es código:** el reparto sale de lo
**cobrado** (`ad_payments` aprobados), no del precio de lista. Si los pagos de
publicidad quedaron atascados en `pending` —pasó con los de julio, cuando el
webhook apuntaba a la app de la finca— la bolsa da **cero** y no hay nada que
repartir por más audiencia que haya. Se rescata con la escoba
(`/api/admin/payments/sweep`, botón en Finanzas), que barre `payments` y
`ad_payments`. Conviene verificarlo antes de prometerle plata a nadie.

---

### El flujo del organizador

Tres etapas, en orden. **No se puede saltar ninguna.**

#### Etapa 1 — Antes de ver nada: datos y términos

Al entrar por primera vez a "Monetizar" no ve cifras. Ve un formulario:

1. **Datos para transferirle** — nombre completo, cédula, banco, tipo de cuenta
   y número. Van a `organizer_payout_info`.
2. **Aceptar términos y condiciones** del programa.

**Por qué los datos van primero y no al final:** si le mostramos "ganaste
$240.000" y después le pedimos la cédula, el dato de pago se vuelve un trámite
molesto que puede dejar a medias — y quedan cortes emitidos que no se pueden
pagar. Pidiéndolo antes, todo corte que se emite es cobrable.

**Por qué los términos son bloqueantes:** hay plata de por medio. Tiene que
haber aceptado por escrito cómo se calcula, cuándo se paga y que el estimado del
mes puede bajar, ANTES de ver un número que va a interpretar como una promesa.

Hace falta guardar **cuándo** aceptó y **qué versión** — si los términos cambian,
se vuelve a pedir. Eso es una tabla o un par de columnas todavía por definir.

#### Etapa 2 — Qué le falta para clasificar este mes

Una vez con los datos y los términos, ve su progreso. Sale entero de
`get_monetization_status`, que ya devuelve los umbrales junto a sus números:

| Requisito | Cómo se ve |
|---|---|
| Personas-día | `180 / 300` con barra |
| Días con audiencia | `6 / 8` |
| Partidos con resultado | `14 / 10` ✓ |
| Equipos | `18 / 6` ✓ |
| Antigüedad de la cuenta | `45 / 30 días` ✓ |
| Perfil con nombre y logo | ✓ |

Lo importante es que **sea accionable**: no "no clasificás", sino "te faltan 120
personas-día y 2 días con audiencia". El requisito deja de ser un muro y pasa a
ser una explicación.

Si ya clasifica, esta vista se muestra igual pero toda en verde: sirve para que
sepa que sigue cumpliendo y no se sorprenda el mes que deje de hacerlo.

#### Etapa 3 — Cuánto ganó, y por qué

Dos pestañas.

**Pestaña "Este mes"** — cuánto lleva ganado **por campaña**, y al lado la
audiencia que lo generó:

| Campaña | Personas-día que aportó | Su % | Ganado |
|---|---:|---:|---:|
| Ferretería | 300 | 60% | $120.000 |
| Panadería | 800 | 80% | $120.000 |
| | | | **$240.000** |

Y cada campaña se puede abrir para ver **en qué torneos** salió y cuánta
audiencia puso cada uno. Eso es lo que responde "¿de dónde salió este número?"
sin que tenga que preguntarnos.

⚠️ **Etiquetar como PROYECCIÓN.** Mientras el mes corra, el número puede **bajar**:
si otro organizador suma audiencia a la misma campaña, el porcentaje propio baja.
Decirlo antes de que pase, no después.

**Pestaña "Histórico"** — los cortes ya cerrados, uno por mes:

| Mes | Personas-día | Monto | Estado |
|---|---:|---:|---|
| Julio 2026 | 1.240 | $240.000 | Pagada |
| Junio 2026 | 980 | $185.000 | Pagada |
| | | **$425.000** | acumulado |

Estos salen de `ad_settlements` y son **congelados**: el número que vio el día
que se cerró el mes es el que sigue viendo. Cada uno abre a su desglose por
campaña, que ya está guardado en `breakdown`.

Acá el estado sí importa: **Emitida / Aprobada / Pagada** le dice si ya le
transferimos o si está en camino.

---

### Lo que hace falta construir para eso

- **RPC `get_my_ad_earnings(mes)`** — el organizador no puede leer
  `analytics_events` (es admin-only), así que necesita su propia función que le
  devuelva sus personas-día por campaña y por torneo, y su participación. No
  puede reusar `get_ad_analytics`.
- **Policy de lectura en `ad_settlements`** (`organizer_id = auth.uid()`), solo
  para cortes no anulados.
- **Mostrar el desglose por campaña.** Ya se calcula y ya se guarda en
  `ad_settlements.breakdown`, pero hoy no se pinta en ninguna parte — se quitó al
  simplificar el panel de admin. Hace falta en los dos lados.
- **Guardar la aceptación de términos** con fecha y versión.
- **Cómo se entera de que tiene plata.** No hay email transaccional ni push. Al
  arranque puede vivir solo dentro de la app, pero es una decisión.

### Corte mensual congelado ✅ hecho

Migración `20260729f_ad_settlements.sql`. Dos tablas:

- **`ad_period_revenue`** — qué se le cobró a cada campaña ese mes. El panel
  precarga `monthly_price` y guarda la corrección al salir del campo. Antes esa
  corrección vivía en la memoria del componente y se perdía al recargar;
  congelar sin esto habría tomado el precio de lista y perdido los ajustes (una
  campaña que arrancó el día 20 cobra un tercio). Es además el lugar donde
  después se conecta `ad_payments`.
- **`ad_settlements`** — el corte cerrado por organizador y mes: personas-día,
  monto, desglose por campaña en JSON, y estado emitida / aprobada / pagada /
  anulada.

**La inmutabilidad es un trigger, no una intención.** `ad_settlements_freeze`
rechaza cualquier `UPDATE` que toque período, organizador, personas-día, monto,
desglose o fecha de cierre. Solo se mueven `status`, `paid_at` y `notes`. Para
corregir un corte hay que anularlo (`void`) y cerrar el mes de nuevo — así queda
rastro en vez de que una cifra que el organizador ya vio cambie sin aviso.

#### El cliente calcula, la base valida

`close_ad_period(mes, filas)` no recalcula el reparto: lo recibe y lo verifica.

La razón es evitar dos implementaciones de la misma matemática de plata. El
reparto por residuo mayor ya vive en `lib/ad-analytics.ts`, probado contra el
ejemplo de este plan y contra montos que descuadran con redondeo ingenuo.
Reescribirlo en PL/pgSQL habría creado dos versiones que tendrían que coincidir
para siempre.

Para que "el cliente calcula" no signifique "el cliente manda lo que quiera", la
función:

- **re-deriva las personas-día** desde `analytics_events` y rechaza el cierre si
  no coinciden con lo recibido (ataja también el panel con datos viejos),
- **verifica que el total no exceda la bolsa** que sale de `ad_period_revenue`,
- **rechaza cerrar un mes que todavía corre** — congelarlo antes dejaría el
  corte por debajo de lo real,
- **rechaza cerrar dos veces** el mismo mes si hay cortes no anulados.

Solo se mandan los organizadores elegibles con monto mayor que cero. El no
elegible no genera corte: su parte queda con la plataforma, y la función la
devuelve como `retained_cop`.

### Requisitos para desbloquear (aprobados 2026-07-29)

Dos niveles, no una sola puerta. Con una sola, el que no califica no ve nada y
no sabe por qué; con dos, el requisito se vuelve la explicación de qué le falta.

- **Nivel 1 — ve la sección.** Barra baja. Adentro ve la lista de requisitos
  con su progreso ("vas 180 de 300 personas-día").
- **Nivel 2 — liquidable este mes.** Solo acá se genera la cuenta de cobro.

| Requisito | Nivel | Umbral |
|---|---|---|
| Torneo en curso (`status = 'in-progress'`) | 1 | ≥ 1 |
| Equipos en ese torneo | 1 | ≥ 6 |
| Partidos con resultado en el mes | 2 | ≥ 10 |
| Personas-día en el mes (`page_views`) | 2 | ≥ 300 |
| Días distintos con audiencia | 2 | ≥ 8 |
| Antigüedad de la cuenta | 2 | ≥ 30 días |
| Perfil con nombre y logo | 2 | sí |

**Los umbrales van en configuración, no hardcodeados**, para poder moverlos sin
desplegar.

**Los números están sin validar contra datos reales.** Ya se evalúan vía
`get_monetization_status`; la consulta manual
`Por hacer/consultas/organizadores-vs-requisitos.sql` queda solo como
herramienta de diagnóstico suelta.

### Primera medición (2026-07-29): no concluyente

Corrió sobre 6 organizadores pero **la ventana estaba truncada**:
`page_views.visitor_id` existe desde el 20 de julio, así que solo había 9 días
de dato contra un umbral mensual. Cuatro organizadores mostraban `dias = 9` —el
techo del dato, no su comportamiento— y `f_pers_dia` salía X para 5 de 6 por
eso, no porque 300 estuviera alto.

Extrapolando por 31/9, calificarían 2 o 3 de 6, o sea **el umbral de 300
probablemente está bien**. Queda por confirmar con un mes entero limpio:
**re-medir en septiembre, sobre agosto.** La consulta ahora trae una columna
`dias_del_mes_con_datos` para que esta trampa se vea de entrada.

Lo que sí quedó claro:

- **Los umbrales de equipos y partidos no filtran.** Todos los activos tienen
  16-22 equipos (barra: 6) y 39-157 partidos (barra: 10). Cumplen su función de
  piso —dejaron fuera a uno con 0 torneos y a uno con 4 partidos— pero no son
  los que deciden.
- **La audiencia es diaria, no en ráfagas.** Los cinco activos tuvieron 8 o 9
  días de 9 posibles. Valida la regla de días distintos: el único con `dias = 1`
  cayó solo.
- **La concentración del Paso 2 ya es real, no hipótesis.** El organizador más
  grande tiene el 49% de las personas-día. Con un fondo de $600.000, el
  penúltimo se llevaría ~$23.000 y el último ~$13.000. Si hay que suavizarlo,
  es con un mínimo garantizado o un techo, no con la puerta.
- **El volumen es ~5x menor que el ejemplo de este plan.** ~2.100 personas-día
  al mes en toda la plataforma, contra las 10.000 del ejemplo del Paso 2, y una
  tasa de retorno de ~1,5 días por persona en 9 días, no los 15 que asumía la
  sección de la métrica. El $/persona-día simplemente sube (~$140 en vez de
  $30), pero **no armar el pitch comercial sobre las cifras del ejemplo**.

#### Por qué la audiencia se mide de `page_views` y no de impresiones

Las impresiones dependen de que el admin le haya asignado una campaña al
torneo. Un organizador con audiencia real pero sin campaña marcaría cero y
**nunca podría desbloquear la sección**: la puerta dependería de una decisión
del admin, no de su mérito.

Así que la audiencia de la puerta sale de `page_views` (audiencia entregada, la
vea o no un aviso) y la del pago sigue saliendo de impresiones.

#### Partidos con resultado, no solo "torneo en curso"

El estado `in-progress` lo pone el organizador a mano y puede llevar meses
abandonado. Contar partidos con resultado **cargado en el mes** prueba que lo
está operando. Se mira `matches.updated_at` (cuándo se cargó) y no
`matches.date` (cuándo se jugó, que puede ser de otro mes).

#### Días distintos con audiencia: el antifraude que más rinde

Es más difícil de simular que cualquier total. Quien arma tráfico falso lo hace
en una o dos sentadas; quien tiene un torneo real recibe gente cada fin de
semana. Y no le cuesta nada a quien es legítimo.

Contra el que sí tenga la paciencia de entrar todos los días desde varios
dispositivos, la defensa es el volumen del umbral: con un navegador el techo es
un punto por día, así que 300 personas-día exigen ~10 dispositivos durante todo
el mes.

#### Las visitas del organizador contaban para su propio umbral

`page_views` incluye TODAS las visitas, también las del propio organizador
revisando su torneo — hasta ~30 personas-día propias al mes, ~10% de ruido
sobre un umbral de 300, y para alguien justo en la línea eso decide si cobra.

No se podía descontar porque la tabla no guardaba si había sesión iniciada. Lo
arregla `20260729d_page_views_is_authenticated.sql` (columna nullable: NULL =
visita anterior, no se sabe; nunca `false` por defecto, que mentiría sobre el
histórico). Aplica solo hacia adelante.

Para el **pago** este problema no existía: el modal no se le muestra a nadie
logueado, así que el organizador nunca se cuenta a sí mismo en lo que cobra.

---

## Tope de frecuencia del modal ✅ hecho

**7 impresiones por persona, por torneo y por día** (`AD_DAILY_CAP` en
`lib/ad-frequency.ts`), reemplazando el "en cada carga, sin tope" del
2026-07-03. Esa decisión tenía sentido cuando las impresiones eran la única
métrica; con personas-día liquidando, inflarlas solo empeora el informe al
anunciante.

El contador vive en `localStorage`, con la misma noción de persona que el
`visitor_id`, y sube junto con la impresión que se registra — no al entrar al
componente, así una petición fallida no gasta cuota.

### Por qué la cuota es por torneo y no global

El primer intento usó cuota global por día y **rompía el reparto**.

El crédito de personas-día se registra solo cuando hay un `ad_impression`. Con
cuota global, quien la quemaba en el torneo de un organizador y después abría
los de otros tres no generaba impresión en esos tres, así que esos
organizadores no recibían crédito por una persona que sí visitó su torneo.

Lo grave no era perder el dato sino que **el sesgo no era parejo**: favorecía
al torneo que la persona abre primero, que suele ser el principal. Los
secundarios —normalmente los organizadores más chicos— perdían crédito. Todo el
razonamiento de este plan se apoya en que los sesgos golpeen a todos por igual,
porque en un reparto proporcional un sesgo parejo se cancela. Ese no lo era, y
empujaba justo en la dirección contraria a la nota de operación del Paso 2.

Con cuota por torneo cada organizador siempre captura la persona-día de quien
lo visitó. El techo total sube (alguien que abre 4 torneos podría ver hasta 28
avisos en un día) y es el precio de que el reparto sea correcto.

**No cambia la liquidación dentro de un torneo.** Personas-día cuenta personas
distintas por día, así que quien entra 20 veces aporta 1 con tope o sin él.

Falla abierto a propósito: si `localStorage` no está disponible (modo privado)
o lo guardado no se puede interpretar, se muestra el aviso igual. La
publicidad no puede romper la vista del torneo.

El día del tope es **local**; el de personas-día es UTC (`created_at::date`).
En Colombia (UTC-5) no cortan a la misma hora. No importa: son cosas distintas
y el tope no alimenta la liquidación.

Se eligió 7 y no los 2-3 que estimaba este plan (decisión del organizador,
2026-07-29). Corta el caso que más ensucia —quien refresca decenas de veces en
una sentada— pero deja las impresiones más altas de lo que el argumento de
venta al anunciante querría.

---

## Lo que este plan NO cubre

- Los planes comerciales Bronce/Oro. Requieren agregar **placements** a las
  campañas: hoy una campaña es una imagen en el modal, no hay noción de
  ubicaciones distintas. El banner fijo en pestañas de estadísticas no existe
  para campañas de la app (`SponsorBanner` es solo del organizador).
- **Notificaciones push.** No hay nada: ni service worker, ni Firebase, ni
  web-push. Es lo más caro de todo el modelo, y en web la aceptación es baja
  (en iOS solo funciona si instalaron la app en pantalla de inicio). **No
  vender un plan que prometa pushes hasta que exista.**
- **Pantalla de carga con logo.** Esto es web, no app nativa, no hay splash.
  Lo más cercano ya existe: el `ad-modal` aparece al abrir el torneo y ocupa
  la pantalla.

---

## Lo que ya existía y no hay que construir

- **Medición de vistas por torneo:** `page_views` + RPC
  `get_organizer_tournament_views(user_id, days)`.
- **Espacio del organizador (gratis):** sube sus propios logos por torneo
  (`SponsorBanner`, `tournament-detail.tsx:975`), con biblioteca reutilizable.
  Se queda con el 100%.
- **Espacio de la app:** `ad_campaigns` con precio mensual, vigencia, panel en
  `/admin/publicidad`, targeting por deporte/estado/alcance/departamento, y
  **rotación ponderada por monto**. Se muestra vía `ad-modal.tsx` solo a
  anónimos — los organizadores logueados no ven publicidad.
- **Eventos de publicidad:** `ad_impression` y `ad_click` con `tournament_id`
  y `id` de campaña. El dato lleva meses acumulándose.
- **Cobro:** `ad_payments` con estado por campaña.

---

## Decisiones tomadas

| Fecha | Decisión |
|---|---|
| 2026-07-29 | Repartir por **persona-día**, no por impresiones ni por personas únicas. |
| 2026-07-29 | `visitor_id` en `analytics_events` va primero, aunque el resto tarde: el dato perdido no se recupera. |
| 2026-07-29 | Impresiones y CTR se usan para el **informe al anunciante**; persona-día para **liquidar**. |
| 2026-07-29 | La unidad monetizable es el **organizador** (`organization_profiles.user_id` es UNIQUE, no hay sub-usuarios). Se le paga a la cuenta; si hay varias personas detrás, reparten por fuera. |
| 2026-07-29 | El reparto es **por campaña**, no con un fondo único: las campañas están segmentadas y un fondo único le paga a organizadores que no aportaron audiencia a esa campaña. |
| 2026-07-29 | El **denominador de cada campaña incluye a los no elegibles**; su parte se queda con la plataforma y no se redistribuye. |
| 2026-07-29 | **Sin mínimo garantizado** por organizador: el reparto es puramente proporcional. |
| 2026-07-29 | La cuenta de pruebas "Torneos Pro" queda **excluida** del reparto vía `users.revenue_share_excluded`. |
| 2026-07-29 | El corte congelado lo **calcula el cliente y lo valida la base**, para no tener dos implementaciones de la matemática de plata. |
| 2026-07-29 | Cerrar el mes es una **acción explícita del admin**, no automática por fecha, y solo se permite con el mes terminado. |
| 2026-07-29 | Un corte no se edita: se **anula y se vuelve a cerrar**. La inmutabilidad la impone un trigger. |
| 2026-07-29 | La base del reparto es **lo cobrado** (pagos aprobados), no lo facturado, y se prorratea entre los meses que la campaña estuvo al aire. |
| 2026-07-30 | **Sin mínimo garantizado** ni techo por organizador: el reparto es puramente proporcional. |
| 2026-07-30 | Los umbrales viven en **`monetization_config`**, no en el código, para moverlos sin desplegar. |
| 2026-07-30 | Datos de pago: **nombre completo, cédula, banco, tipo de cuenta y número**, provistos por el organizador y obligatorios para clasificar. |
| 2026-07-30 | En la sección del organizador, **datos de pago y términos van ANTES** de mostrarle cualquier cifra. |
| 2026-07-29 | Los montos se reparten por **residuo mayor**, para que la suma cuadre al peso con el fondo. |
| 2026-07-29 | El **fondo se escribe a mano** hasta que se decida de dónde sale (facturado vs. recaudado, y cómo prorratear campañas que cruzan meses). |
| 2026-07-29 | Tope del modal en **7 por persona, torneo y día**, reemplazando el "sin tope" del 2026-07-03. Por torneo y no global: con cuota global el organizador que la persona abría primero se quedaba con todo el crédito de personas-día. |
| 2026-07-29 | Requisitos de "Monetizar" en **dos niveles** (ve la sección / liquida), con los umbrales de la tabla del Paso 3. Pendiente validarlos contra datos reales. |
| 2026-07-29 | La audiencia de la **puerta** se mide de `page_views`; la del **pago**, de impresiones. Si la puerta usara impresiones, dependería de que el admin le asignara campaña. |
