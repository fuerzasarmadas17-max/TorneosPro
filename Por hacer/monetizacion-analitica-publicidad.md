# Plan: analítica de publicidad y reparto con organizadores

**Estado:** pasos 0 y 1 desplegados. Paso 2 en local, **falta correr su
migración** (`20260729c_ad_analytics_by_organizer.sql`) antes de desplegarlo.
Paso 3 planeado.
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
| **Impresiones crudas** | El modal se muestra en cada carga, sin tope (decisión 2026-07-03). Quien refresca 50 veces genera 50 impresiones. Pagar por esto es invitar a inflarlo. |
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

## Paso 2 — Detalle por campaña y reparto por organizador ✅ hecho, sin desplegar

**Hecho:**
- Migración `20260729c_ad_analytics_by_organizer.sql`: agrega el corte
  `by_organizer` a `get_ad_analytics`, calculado en la base, y `organizer_name`
  a `by_tournament` y `detail`. **Falta correrla.**
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

- **Requisitos evaluables por el sistema** para desbloquearla (torneos
  activos, partidos con resultado, mínimo de audiencia real). Si son
  automáticos, se desbloquea sola y no hay que negociar caso por caso.
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

---

## Pendiente aparte: tope de frecuencia del modal

No bloquea nada de lo anterior, pero conviene.

Hoy el modal se muestra en **cada carga**, sin tope por sesión (decisión
2026-07-03, documentada en `ad-modal.tsx`). Un tope de 2-3 por persona y día:

- Mejora la experiencia del espectador, que no ve el mismo anuncio en cada
  refresh.
- Limpia las impresiones que se le reportan al anunciante. "Llegué a 3.000
  personas" vende mejor que "me mostré 40.000 veces a 200 personas aburridas".

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
