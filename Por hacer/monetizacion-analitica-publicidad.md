# Plan: analítica de publicidad y reparto con organizadores

**Estado:** pasos 0, 1 y 2 desplegados, con sus migraciones corridas. Falta el
Paso 3, que depende de decisiones comerciales aún abiertas.
**Última actualización:** 2026-07-29

---

## Para qué es esto

Repartir con los organizadores el 50% de lo que se cobra por publicidad, de
forma proporcional a la audiencia que cada uno aporta. Para eso hacen falta
tres cosas que hoy no existen: una métrica que no se pueda inflar, una vista
de admin que muestre la verdad, y una sección donde el organizador vea lo suyo
y cobre.

Este documento cubre la parte técnica. El modelo comercial (planes, precios,
requisitos para monetizar) se decide aparte.

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

## Paso 0 — visitor_id en los eventos ✅ hecho, sin desplegar

`page_views` ya tenía `visitor_id` desde `20260720_analytics_visitor_id.sql`,
pero `analytics_events` se quedó solo con `session_id` — que caduca a los 30
min, así que alguien entrando mañana, tarde y noche contaba como tres personas.

**Hecho:**
- Migración `20260729_analytics_events_visitor_id.sql`: columna + dos índices
  (uno por `event_type, created_at, visitor_id` para el corte mensual, otro
  incluyendo `tournament_id` para el desglose por organizador).
- `trackEvent` (`lib/analytics.ts`) ahora manda `visitor_id`.
- Migración **ya corrida en la base**. El código está en local sin commitear.

**Por qué fue primero:** aplica solo hacia adelante. Las impresiones ya
registradas no tienen persona y no se pueden reconstruir. Cada día sin
desplegar es un día de datos que no vas a poder liquidar.

⚠️ **Al desplegar:** la migración ya está aplicada, así que no hay ventana de
riesgo. Pero ojo que `trackEvent` falla en silencio a propósito
(`ad-modal.tsx:107`), así que un error acá no se ve — se pierden datos sin
aviso.

---

## Paso 1 — RPC de agregación + vista de admin ✅ hecho, sin desplegar

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

Queda pendiente de este paso solo el `by_organizer` calculado en la base;
agrupar `by_tournament` por organizador en el cliente vuelve a ser una suma y
cuenta doble a quien ve dos torneos del mismo organizador el mismo día. Va con
el Paso 2.

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

**El fondo se escribe a mano.** De dónde sale (lo facturado, lo efectivamente
recaudado, cómo se prorratea una campaña que cruza dos meses) es decisión
comercial abierta, y cablearla a `ad_payments` habría sido adivinar. Cuando se
decida, el input se reemplaza por el cálculo y el resto no se toca.

### El denominador del reparto no es el total global

El porcentaje de cada organizador se calcula sobre la **suma de las filas de
`by_organizer`**, no sobre `totals.person_days`. No son lo mismo: quien el
mismo día ve torneos de dos organizadores aporta 1 al total global pero 1 a
cada uno, así que la suma de filas es siempre >= el global. Hay que usar la
suma porque es la única que da 100% exacto — con el global los porcentajes
pasarían de 100% y el reparto excedería el fondo.

El panel muestra las dos cifras con la explicación al lado, porque ver dos
"personas-día" distintas en la misma pantalla se lee como un error.

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

**Sin estimar.** Depende de decisiones comerciales aún abiertas.

Lo que se sabe que necesita:

- **Panel:** campañas corriendo en sus torneos, personas-día aportadas, su
  participación, estimado del mes, acumulado histórico.
- **Corte mensual congelado.** Crítico: si se calcula en vivo, el número que
  el organizador vio el día 12 no será el que vea el admin el 20. Con plata de
  por medio eso es una discusión asegurada. Guardar el corte cerrado
  (personas-día, tarifa, monto) como fila inmutable, y que la cuenta de cobro
  apunte a ese registro.
- **Estado de la cuenta de cobro:** emitida / aprobada / pagada. Sin esto no
  se sabe a quién ya se le pagó.
- El estimado del mes debe etiquetarse como **proyección**: mientras el fondo
  dependa de lo que se venda ese mes, ese número puede bajar.

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

**Los números están sin validar contra datos reales.** La consulta está en
`Por hacer/consultas/organizadores-vs-requisitos.sql`.

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
| 2026-07-29 | El reparto se calcula sobre la **suma de `by_organizer`**, no sobre `totals.person_days`: es la única base que da 100% exacto. |
| 2026-07-29 | Los montos se reparten por **residuo mayor**, para que la suma cuadre al peso con el fondo. |
| 2026-07-29 | El **fondo se escribe a mano** hasta que se decida de dónde sale (facturado vs. recaudado, y cómo prorratear campañas que cruzan meses). |
| 2026-07-29 | Tope del modal en **7 por persona, torneo y día**, reemplazando el "sin tope" del 2026-07-03. Por torneo y no global: con cuota global el organizador que la persona abría primero se quedaba con todo el crédito de personas-día. |
| 2026-07-29 | Requisitos de "Monetizar" en **dos niveles** (ve la sección / liquida), con los umbrales de la tabla del Paso 3. Pendiente validarlos contra datos reales. |
| 2026-07-29 | La audiencia de la **puerta** se mide de `page_views`; la del **pago**, de impresiones. Si la puerta usara impresiones, dependería de que el admin le asignara campaña. |
