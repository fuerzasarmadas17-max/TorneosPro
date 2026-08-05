# Wompi: dos apps compartiendo una sola cuenta

> Escrito el 2026-08-04, después de perder un pago real de $70.000.
> **Este documento tiene dos partes.** La primera explica la situación actual y
> por qué se hizo el cambio. La segunda son las instrucciones para cuando se
> cree la cuenta de Wompi de la finca — esa parte está escrita para que otra
> sesión de Claude la pueda ejecutar sin contexto previo.

---

## TL;DR

- Una sola cuenta de Wompi está siendo usada por **dos apps**: TorneosPro y la app de la finca.
- Wompi permite **una sola URL de eventos por comercio**. La tenía la finca.
- Consecuencia: **el webhook de TorneosPro nunca se ejecutó ni una vez** desde que existe.
- Se cambió la URL de eventos a TorneosPro. **Ahora la que quedó ciega es la finca.**
- Esto es una solución temporal a propósito. La solución real es que cada app tenga su propia cuenta de Wompi (parte 2).

---

# PARTE 1 — Qué pasaba y qué se cambió

## Cómo se descubrió

Un organizador (Marceliano, club-vietnam, Corozal) pagó $70.000 por un torneo de softball el 2026-08-04 a las 21:43 hora Colombia. Volvió a la app y el torneo no existía. Su registro en `payments` quedó así:

```
reference:             TORNEO-377df36a-1785897830794
status:                pending
wompi_transaction_id:  null      <- nunca supimos de ninguna transacción
wompi_status:          null
tournament_id:         null      <- el torneo nunca se creó
```

Buscando por qué, aparecieron **dos fallas independientes**:

1. **La página de retorno exigía sesión** (arreglado, commit `3ee8aba`). Estaba envuelta en `AuthGuard`, que devuelve `null` sin sesión, así que el componente no se montaba y nunca llamaba a `/api/payments/confirm`. Quien volvía desde el webview de Nequi o del banco —sin la sesión en ese navegador— perdía el pago.

2. **El webhook nunca fue nuestro** (esta es la falla de fondo, la que documenta este archivo).

## La evidencia del webhook

En el panel de Wompi, la URL de eventos apuntaba a:

```
https://werrhqbnqcpozefmythv.supabase.co/functions/v1/wompi-webhook
```

Comparando los identificadores de proyecto de Supabase:

| | Proyecto |
|---|---|
| Base de datos de TorneosPro | `wqjfeupschfhjouirfcb` |
| A dónde apuntaban los eventos | `werrhqbnqcpozefmythv` |

**Son dos proyectos distintos.** El segundo es la app de la finca.

Tres cosas lo confirmaron:

- Ese endpoint **está vivo**: un POST vacío responde `{"error":"Firma invalida"}` con HTTP 401. Hay una Edge Function corriendo ahí, validando firmas.
- El identificador `werrhqbnqcpozefmythv` **no aparece en ningún lado de este repositorio ni en todo el historial de git**. Nunca fue de TorneosPro.
- Los pagos de publicidad (tabla `ad_payments`, referencias `PUB-…`) **solo se pueden actualizar por el webhook** — no tienen página de retorno que los rescate. Los dos que existen siguen sin transacción de Wompi, desde julio.

## Por qué los otros pagos sí funcionaron

Porque hay un segundo camino que no depende del webhook: cuando el cliente vuelve del checkout, el navegador llama a `/api/payments/confirm`, que verifica contra la API de Wompi y crea el torneo.

Los 5 pagos aprobados que hay en la base entraron **todos por ahí**. Nunca hubo red de seguridad. La noche del 4 de agosto ese único camino se rompió (falla 1) y el pago se cayó al vacío.

Hay además un pago viejo que quedó a mitad de camino, prueba de que esto ya había fallado antes:

```
TORNEO-363ced1a-1780024042  ·  29 may 2026  ·  $5.000  ·  BANCOLOMBIA_TRANSFER
status: approved   wompi_status: APPROVED   tournament_id: null
```

Aprobado en Wompi, sin torneo creado.

## Un detalle importante del funcionamiento

El "secreto de eventos" pertenece **al comercio, no a cada app**. Como las dos comparten comercio, comparten secreto. Eso significa que la función de la finca **validaba correctamente** los eventos de TorneosPro, buscaba la referencia en su propia base, no la encontraba, y los descartaba.

Los pagos de torneos llegaban allá y morían ahí. No es que Wompi no avisara: avisaba a la dirección equivocada.

Vale la pena tenerlo presente por otro motivo: mientras compartan comercio, **el backend de cada app recibe los datos de las transacciones de la otra** (montos, referencias, método de pago).

## El cambio que se hizo

En el panel de Wompi, la URL de eventos pasó a ser:

```
https://www.torneospro.co/api/payments/webhook
```

**Esto deja a la app de la finca sin recibir eventos.** Fue una decisión consciente: TorneosPro tiene pagos de clientes reales cayéndose hoy, así que se le dio prioridad. La finca queda a la espera de su propia cuenta (parte 2).

⚠️ **Si la finca está cobrando plata de gente real, esto no puede quedar así mucho tiempo.** Es un intercambio temporal, no una solución.

### Cómo verificar que quedó funcionando

El webhook de TorneosPro escribe `wompi_transaction_id` y `wompi_status` en la tabla correspondiente. Después del próximo pago real:

```sql
-- Pagos de torneos
select reference, status, wompi_status, wompi_transaction_id, tournament_id
from   payments
order  by created_at desc
limit  5;

-- Pagos de publicidad (estos SOLO los toca el webhook)
select reference, status, wompi_status, wompi_transaction_id
from   ad_payments
order  by created_at desc
limit  5;
```

Si `wompi_transaction_id` aparece lleno sin que nadie haya vuelto a la app, el webhook está andando.

### Si el webhook devuelve 401

Significa que el `WOMPI_EVENT_SECRET` cargado en Vercel **no coincide** con el "Secreto de eventos" del panel de Wompi. El webhook recibe el aviso, la firma no cuadra y lo rechaza en `src/app/api/payments/webhook/route.ts:47`. Desde afuera se ve idéntico a no tener webhook. Hay que copiar el secreto del panel a Vercel y volver a desplegar.

---

# PARTE 2 — Migrar la finca a su propia cuenta de Wompi

> **Instrucciones para una sesión futura de Claude (o para quien lo haga a mano).**
> Asumen que ya existe una cuenta de Wompi nueva, a nombre de la finca, y que
> quien ejecuta tiene acceso a su panel.
>
> **Importante: el código de la app de la finca NO está en este repositorio.**
> Vive en el proyecto de Supabase `werrhqbnqcpozefmythv`, como una Edge Function
> llamada `wompi-webhook`. Hay que abrir ese proyecto aparte.

## Objetivo

Que la finca deje de usar la cuenta de Wompi compartida y pase a la suya. Cuando termine, TorneosPro se queda con la cuenta actual —sin tocar nada— y la finca queda apuntando a la nueva.

## Qué hay que cambiar en la finca

Una cuenta de Wompi tiene **cuatro credenciales** y hay que reemplazar las cuatro. Cambiar solo algunas deja el sistema roto de formas difíciles de diagnosticar:

| Credencial | Formato | Para qué sirve | Dónde va |
|---|---|---|---|
| Llave pública | `pub_prod_…` | Abrir el checkout desde el navegador | Frontend de la finca |
| Llave privada | `prv_prod_…` | Consultar transacciones desde el servidor | Backend, si lo usa |
| Secreto de integridad | texto largo | Firmar cada link de pago | Donde se arma el checkout |
| Secreto de eventos | texto largo | Validar los avisos entrantes | La Edge Function |

En Supabase, los secretos de una Edge Function se cargan así:

```bash
supabase secrets set WOMPI_EVENT_SECRET=xxx --project-ref werrhqbnqcpozefmythv
```

(Los nombres exactos de las variables hay que leerlos del código de esa función — pueden no llamarse igual que acá.)

## Pasos, en orden

**1. Sacar las cuatro credenciales** del panel de la cuenta nueva. Ojo con la pestaña: **Producción**, no Pruebas. Son juegos distintos y mezclarlos hace que los pagos fallen sin explicación clara.

**2. Cargar la URL de eventos** en la cuenta nueva, apuntando a la función de la finca:

```
https://werrhqbnqcpozefmythv.supabase.co/functions/v1/wompi-webhook
```

**3. Reemplazar las credenciales en la app de la finca.** Las cuatro. Volver a desplegar la función después de cambiar sus secretos.

**4. Probar con un pago real chico** antes de dar por terminado. Un monto mínimo, pagado de verdad, verificando que:
   - El checkout abre sin error de firma (si el secreto de integridad quedó mal, Wompi rechaza el link).
   - La plata cae en la cuenta nueva.
   - La función recibe el evento y actualiza lo que tenga que actualizar.

**5. Recién ahí, revisar que TorneosPro sigue intacto.** No debería haber cambiado nada, pero conviene confirmar que la URL de eventos de la cuenta vieja sigue siendo `https://www.torneospro.co/api/payments/webhook`.

## Cuidados

**Los pagos en vuelo durante el cambio.** Una transacción arrancada con las credenciales viejas pertenece a la cuenta vieja, y su aviso va a llegar a la URL vieja (TorneosPro), que no va a saber qué hacer con ella. Conviene hacer el cambio en un horario muerto y revisar después si quedó alguna referencia de la finca sin procesar.

**No borrar la cuenta vieja.** Los reportes históricos de la finca viven ahí. Si algún día hay que reclamar o conciliar un pago de antes del cambio, es el único lugar donde está.

**La contabilidad queda partida en dos.** Todo lo cobrado hasta el cambio está en la cuenta compartida, mezclado con lo de TorneosPro; lo de después está en la nueva. Vale la pena anotar la fecha exacta del corte.

---

# Contexto del código de TorneosPro

Por si la sesión futura necesita entender cómo funcionan los pagos de este lado.

## Los archivos

| Archivo | Qué hace |
|---|---|
| `src/app/api/payments/create-reference/route.ts` | Crea la fila en `payments` y firma el link. Referencias `TORNEO-…` |
| `src/app/api/ads/payment-link/route.ts` | Lo mismo para publicidad. Referencias `PUB-…` |
| `src/lib/payments/wompi-redirect.ts` | Manda el navegador al checkout de Wompi |
| `src/app/tournaments/payment-return/page.tsx` | Página de retorno. **No envolver en AuthGuard** (ver más abajo) |
| `src/app/api/payments/confirm/route.ts` | Verifica contra la API de Wompi y crea el torneo |
| `src/app/api/payments/webhook/route.ts` | Recibe los avisos de Wompi. Atiende `TORNEO-…` y `PUB-…` |
| `src/lib/payments/fulfill.ts` | Crea el torneo a partir de un pago aprobado. Idempotente |

## Los dos caminos de activación

Un pago aprobado puede llegar a crear el torneo por dos vías, y las dos terminan en `fulfillTournamentPayment`:

1. **El navegador** — la página de retorno llama a `/api/payments/confirm`, que le pregunta a Wompi por la transacción y activa. Depende de que el cliente vuelva.
2. **El webhook** — Wompi le avisa al servidor directo. No depende de nadie.

`fulfillTournamentPayment` es idempotente: la primera línea corta si el pago ya tiene `tournament_id`, y hay un *claim* atómico en `payments` para que si los dos caminos corren a la vez, solo uno cree el torneo y el otro borre su duplicado.

## Dos cosas que NO hay que "arreglar"

**La página de retorno no lleva `AuthGuard`.** Confirmar un pago no necesita sesión: el endpoint busca por `reference` con la service key. Ponerle el guard fue exactamente lo que perdió el pago del 4 de agosto. Hay un comentario largo en el archivo explicándolo.

**El reloj de seguridad del auth no baja `isLoading` a ciegas.** En `src/context/auth-context.tsx`, a los 4 segundos le pregunta a Supabase si hay sesión antes de darse por vencido. Sin eso, una restauración lenta quedaba indistinguible de "no hay sesión" y `AuthGuard` mandaba a `/login` a gente que sí estaba logueada.

## Lo que quedó pendiente

**La escoba.** Un repaso automático que agarre los pagos en `pending`, le pregunte a Wompi si se aprobaron y active los que sí. Es la tercera red, la que atrapa lo que se les escapa al navegador y al webhook.

Necesita la **llave privada** de Wompi (`prv_prod_…`) cargada en Vercel: se comprobó que buscar una transacción por referencia con la llave pública devuelve `401 INVALID_ACCESS_TOKEN`. Con la llave pública solo se puede consultar por id de transacción, que es justo lo que no tenemos cuando un pago se pierde.

Ojo con el plan de Vercel: en el gratuito las tareas programadas corren una vez al día. Si es ese el caso, la alternativa es disparar el chequeo cuando el organizador entra a su dashboard.

**Torneos en borrador.** Idea del dueño, y encaja con lo anterior: crear el torneo apenas se le da a "pagar", en estado no pagado —invisible para espectadores, bloqueado para el organizador, con botones de "ir a pagar" y "eliminar"—, y que el pago solo lo active.

No reemplaza al webhook (la activación sigue necesitando enterarse de que se pagó), pero convierte una falla invisible en una recuperable: el organizador vuelve y **ve** su torneo ahí esperando. Si además se le agrega que al abrirlo consulte solo si el pago se aprobó, se cierra el círculo para todos los casos salvo el de quien paga y no vuelve nunca.

Tiene un beneficio extra grande: hoy hay **dos programas distintos que crean torneos** —`create-tournament-form.tsx` y una copia en `fulfill.ts` que el propio código admite que "imita" al primero—. El borrador elimina una de las dos. Ese tipo de duplicación ya causó un bug real: el esqueleto del bracket de playoffs estaba copiado en tres lugares y uno se quedó atrás.

Cuidados si se implementa: que el botón "ir a pagar" verifique primero si ya hay un pago aprobado (o la gente paga dos veces), que los borradores no se filtren en las vistas públicas (las consultas están centralizadas en `src/lib/db/tournaments.ts` y `tournaments-server.ts`), y que se borren solos después de unos días.
