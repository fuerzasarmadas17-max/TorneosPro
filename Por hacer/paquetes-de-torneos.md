# Paquetes de torneos (créditos prepagos)

---

# 🔴 POR DÓNDE VAMOS (retomar acá)

## ✅ EN PRODUCCIÓN Y ABIERTO A TODOS (2026-08-07)

`PACKS_TEST_MODE = false`. El paquete cuesta **$320.000** y la franja de compra
la ven todos los organizadores en `/tournaments/create`.

**Probado de punta a punta en producción:** compra por Wompi, acreditación de
los 5 créditos, y consumo al crear un torneo.

El interruptor queda en `src/lib/packs.ts` por si hay que volver a probar algo
del flujo de pago sin exponerlo: en `true` baja el precio a $5.000 y esconde la
franja a todos menos al admin, las dos cosas a la vez.

### 🧹 Pendiente de limpieza

Quedaron en la base los **créditos de la prueba**, comprados a $5.000 (o sea
`value_cop = 1000` cada uno). Conviene borrarlos:

```sql
-- Ver qué quedó de la prueba
select c.id, c.value_cop, c.consumed_at, c.tournament_id, p.reference
from tournament_credits c
join payments p on p.id = c.payment_id
where c.value_cop < 60000;
```

Dos razones para borrar los que sigan **sin consumir**:

1. Aparecen en "Crédito sin usar" de Negocios como deuda que no es real.
2. El diálogo de pago compara contra el precio del catálogo ($64.000), no
   contra lo que costó cada crédito. Con créditos de $1.000 daría el aviso de
   "te conviene pagarlo" cuando en realidad no aplica.

Los que ya se consumieron **no se tocan**: son el rastro de la prueba y ya
están atados a un torneo.


**Última sesión: 2026-08-07.** Todo lo construido está **en local, sin
commitear y sin desplegar**. El último commit en producción es `30a9652`, que
no tiene nada de paquetes.

## Lo que YA está hecho (en local)

| Archivo | Qué hace |
|---|---|
| `supabase/migrations/20260807_tournament_credits.sql` | Tabla `tournament_credits` + consumo atómico + saldo disponible |
| `src/lib/packs.ts` | Catálogo: 5 torneos, $320.000, hasta 24 equipos, 12 meses |
| `src/lib/auth/require-user.ts` | Valida el token en rutas de usuario (hermano de `requireAdmin`) |
| `src/app/api/payments/pack-reference/route.ts` | Crea el cobro del paquete. El precio sale del servidor, NO del cliente |
| `src/lib/payments/fulfill.ts` | Rama `type: "pack"` → crea los 5 créditos al aprobarse el pago |
| `src/app/api/payments/confirm/route.ts` | Devuelve `kind: "pack"` en vez de un `tournamentId` inexistente |
| `src/app/tournaments/payment-return/page.tsx` | Al volver de Wompi con un paquete, lleva a crear torneo |

Compila, pasa lint y build. **No está probado contra la base** porque la
migración todavía no se corrió.

## PASO 1 — Migraciones

- ✅ `20260807_tournament_credits.sql` — **corrida el 2026-08-07** y verificada
  contra la base: la tabla existe, RLS bloquea la lectura anónima, y las dos
  funciones responden.
- 🔴 `20260807b_tournament_credits_grants.sql` — **PENDIENTE. Correr esta.**

**Por qué hay una segunda:** al verificar la primera se encontró que
`available_tournament_credits` respondía a un llamado **anónimo**. Como es
SECURITY DEFINER y recibe el `user_id` por parámetro, cualquiera podía
preguntar cuántos créditos tiene una cuenta ajena.

El `REVOKE ... FROM PUBLIC` original no alcanzaba: Supabase le concede permiso
de ejecución al rol `anon` **directamente**, no a través de PUBLIC, así que hay
que nombrarlo. La segunda migración además hace que la función verifique por
dentro quién llama, para no depender solo de los permisos.

## PASO 2 — Probar la compra de punta a punta

Sin UI todavía, se prueba a mano:

1. Llamar a `POST /api/payments/pack-reference` con `{ "packId": "pack-5" }` y
   el `Authorization: Bearer <token>` de un organizador.
2. Debe devolver `paymentId`, `reference` (empieza con `PAQUETE-`), `amountInCents`
   e `integrity`.
3. Verificar que la fila quedó en `payments` con `tournament_data.type = 'pack'`
   y **sin** `tournament_id`.
4. Simular la aprobación y confirmar que aparecen **5 filas** en
   `tournament_credits` con el mismo `payment_id`.
5. Volver a aprobar el mismo pago: **NO deben duplicarse** (la guarda de
   idempotencia es que ya existan créditos de ese pago).

## PASO 3 — Lo que falta construir, en orden

| # | Qué | Notas |
|---|---|---|
| 1 | **Franja de créditos arriba de "Crear torneo"** | "Te quedan 3 torneos · vencen el 15/03/2027" + botón de comprar |
| 2 | **Opción de pagar con crédito en el diálogo de costo** | `tournament-cost-dialog.tsx`. Tres opciones: cupón / crédito / pagar. La que conviene, preseleccionada |
| 3 | **Consumir el crédito al crear** | Llamar a `consume_tournament_credit`; si devuelve NULL, **no crear el torneo** |
| 4 | ⚠️ **Contabilidad: Negocios y Finanzas** | **Antes de vender el primer paquete de verdad.** Ver la sección de contabilidad más abajo |
| 5 | Upsell personalizado en el dashboard + `/pricing` | No bloqueante |

## Decisiones que quedaron tomadas por defecto

Se pueden cambiar, pero están asumidas en el código:

- **Vigencia: 12 meses** (`months` en `packs.ts`).
- **Sin devolución de dinero**; el admin puede extender la vigencia a mano.
- **Los créditos no se transfieren** entre cuentas.
- El **ingreso se cuenta al cobrar**, no se reparte entre los 5 torneos.

## Lo que NO hay que olvidar

🔴 **No vender un paquete real hasta terminar el paso 4 (contabilidad).** El día
que entre el primer pago de paquete sin eso, Negocios va a mostrar dos cifras
distintas del mismo ingreso y no va a dar ningún error.

---

**Estado del diseño:** cerrado.
**Fecha:** 2026-08-07.
**Origen:** el organizador quiere vender torneos por adelantado en vez de uno
por uno. Nace de un caso real: Daniel compró **4 torneos en una sola sentada**,
pagando precio de lista las 4 veces, en transacciones separadas.

---

## La oferta

| | |
|---|---|
| **Paquete de 5 torneos** | **$320.000** |
| Por torneo | $64.000 |
| Cubre | torneos de **hasta 24 equipos** |
| Vigencia | 12 meses *(a confirmar, ver Decisiones abiertas)* |
| Si un torneo pasa de 24 equipos | paga la diferencia, como hoy |

**Solo se vende el de 5.** El de 10 se descartó por ahora: ver *Por qué no hay
paquete de 10*.

### El pitch

> **"$64.000 por torneo, tenga 8 equipos o 24. Nunca más pagás el ajuste por
> pasarte de equipos."**

Contra los precios sueltos (Básico $40.000 hasta 8, Medio $70.000 de 9 a 16,
Pro $100.000 de 17 a 24, Premium $130.000 de 25+):

| | Suelto | Con paquete | Descuento |
|---|---:|---:|---:|
| Torneo chico (9-16 equipos) | $70.000 | $64.000 | 9% |
| Torneo grande (17-24) | $100.000 | $64.000 | **36%** |

La asimetría es deliberada: **descuento chico al que hace torneos chicos,
descuento grande al que hace torneos grandes.** Al primero se le vende
tranquilidad (nunca más el ajuste de $30.000 por pasarse de 16); al segundo,
precio. Y el segundo es el cliente que más conviene amarrar.

---

## Por qué el techo es 24 y no 16

Un techo de 16 equipos (tier Medio) permitiría vender el paquete más barato,
pero rompe justo donde están los torneos reales: hoy pagan $70.000 y cuando se
les inscriben 18 equipos terminan pagando $30.000 más. Ese ajuste es una
fricción recurrente.

El techo alto cuesta plata solo en el caso raro:

| Cómo usa los 5 créditos | Suelto | Techo 16 · $290.000 | Techo 24 · $320.000 |
|---|---:|---:|---:|
| 5 torneos chicos (≤16) | $350.000 | $290.000 | **$320.000** |
| Mixto (3 chicos, 2 grandes) | $410.000 | $350.000 | $320.000 |
| 5 torneos grandes (17-24) | $500.000 | $440.000 | $320.000 |

**Con techo 24 se cobra MÁS en el caso probable** (primera fila) y menos en el
excepcional. Los torneos de más de 16 equipos existen pero son minoría, y de
más de 24 nunca ha habido uno.

---

## La economía

### Punto de equilibrio

$320.000 cobrados por adelantado. Cuántos torneos tiene que usar el cliente
para que deje de convenir:

| Si usa los créditos en… | Se paga solo con |
|---|---:|
| Torneos chicos (valen $70.000) | **4,6 torneos** |
| Torneos grandes (valen $100.000) | **3,2 torneos** |

**Contexto:** el promedio hoy es **1,6 torneos por organizador que paga**, y el
récord histórico son los **4 de Daniel**. Los dos umbrales están por encima de
lo que casi nadie consume.

### Por debajo de ~4 torneos, el paquete no es descuento: es sobreprecio

| Torneos que realmente usa | Le cobraste | Habría pagado suelto | Diferencia |
|---:|---:|---:|---:|
| 3 chicos | $320.000 | $210.000 | **+$110.000** |
| 4 chicos | $320.000 | $280.000 | **+$40.000** |
| 5 chicos | $320.000 | $350.000 | −$30.000 |

⚠️ **Ganar por créditos que se vencen sin usar es plata real pero es una mala
forma de ganar.** Si a alguien se le van a vencer créditos, conviene
extendérselos antes que dejarlos caer. La relación vale más que los $64.000.

### Lo que el paquete NO hace

**No escala el negocio.** No trae un solo cliente nuevo: le cambia la forma de
pagar a los que ya están.

Y el cuello de botella no es cobrar, **es el tiempo del organizador**: la
capacitación y el acompañamiento los hace él en persona. Un paquete de 5 son 5
torneos de soporte. El software se replica gratis; él no.

### Lo que sí aporta

1. **Cobra una vez, no cinco.** Cada cobro suelto es un checkout que puede
   fallar — ya se perdió un pago de $70.000 así (ver `wompi-dos-apps-una-cuenta.md`).
   Un torneo creado con crédito **no pasa por Wompi**: no hay webhook, no hay
   página de retorno, no hay pago que perder.
2. **Reemplaza el fiado.** En vez de regalar un torneo mientras el cliente
   consigue la plata (ver `pago-duvan.md`, que ya es un patrón comercial), se le
   vende el paquete y se arranca con la plata adentro.
3. **El crédito prepago empuja a usarlo.** Tener 5 torneos pagos sentados es un
   incentivo a armar el siguiente. Y **más torneos es más audiencia, que es el
   insumo del negocio de publicidad** (`monetizacion-analitica-publicidad.md`).
   Ahí está el efecto compuesto: el paquete no escala los torneos, pero alimenta
   lo que sí escala.

### Por qué no hay paquete de 10

Se evaluó a $500.000 y se descartó **por ahora**. El equilibrio queda en ~7
torneos y hoy nadie ha hecho 5. Vender 10 torneos a alguien que no ha
completado un ciclo es una promesa grande en las dos direcciones: si quema 2 y
se va, queda plata cobrada y un cliente incómodo.

Además la temporada real es de ~4 meses al año, así que 10 torneos podrían
tardar dos temporadas en gastarse.

**Cuándo retomarlo:** cuando algún organizador sostenga 5 o más torneos al año.

---

## Contabilidad: el punto que puede romper los reportes

Negocios (`src/app/admin/business/page.tsx`) lee los pagos **agrupados por
torneo** (`paymentMap` salta las filas con `tournament_id` nulo). Un pago de
paquete no tiene torneo: tiene cinco y todavía no existen.

**Si no se toca nada, la misma pantalla muestra dos cifras distintas de lo
mismo:**

| Dónde | Qué pasa con los $320.000 |
|---|---|
| Ingresos por mes / últimos 30 días | ✅ Aparecen (esa serie suma todos los pagos) |
| Ingreso por torneos (histórico) | ❌ **Desaparecen** |

No da error. Simplemente deja de cuadrar: la tarjeta de arriba y la de abajo
dicen números distintos del mismo ingreso.

**Ese es el arreglo obligatorio**: que "Ingreso por torneos" cuente también los
pagos sin torneo asociado. Es una línea —hoy `paymentMap` salta las filas con
`tournament_id` nulo— pero sin ella el primer paquete rompe el tablero.

### La regla (decidida 2026-08-07): el ingreso se cuenta al cobrar

**Los $320.000 son ingreso del mes en que entran.** No se reparten entre los 5
torneos ni se difieren. Es contabilidad de caja: la plata llegó, se cuenta.

Los torneos **se relacionan** con ese pago a medida que se van creando, pero esa
relación es para **rastrear**, no para repartir plata. Sirve para responder "¿de
qué paquete salió este torneo?" y "¿cuántos le quedan?".

La relación ya existe en el modelo: cada fila de `tournament_credits` tiene su
`payment_id` y su `tournament_id`. Es la tabla de enlace.

### Los indicadores en Negocios

| Indicador | Qué mide |
|---|---|
| **Ingreso del mes** | Paquetes + torneos sueltos + publicidad, al cobrarse |
| **Crédito sin usar** | Créditos vendidos − consumidos. **La deuda en servicio** |

El segundo es nuevo y **con contabilidad de caja importa más, no menos**: se
cuentan $320.000 como ingreso de agosto pero se deben 5 torneos. Con varios
paquetes vendidos es fácil gastar caja que en realidad es un pasivo. Ese número
es lo único que lo hace visible.

### La consecuencia que hay que aceptar (y etiquetar)

Los desgloses **por deporte, por tier y top organizadores** se calculan por
torneo, sumando lo que se pagó por cada uno. Un torneo creado con crédito no
tiene pago propio, así que **entra en $0 en esos tres cuadros**.

No es un error, es la consecuencia de contar el ingreso al cobrar. Pero hay que
**cambiarles el título** para que no se lean mal dentro de seis meses:

| Hoy dice | Debería decir |
|---|---|
| Ingreso por deporte | Ingreso por deporte *(torneos pagados uno a uno)* |
| Ingreso por tier | Ingreso por tier *(torneos pagados uno a uno)* |

Los torneos de paquete **sí siguen contando en "Mix de torneos por deporte"**,
que cuenta cantidad y no plata — ese cuadro ya existe y no hay que tocarlo.

Si algún día los paquetes son la mayoría de las ventas, esos tres cuadros dejan
de ser representativos y ahí sí habrá que repartir el monto. Mientras sean la
minoría, la etiqueta alcanza.

### La recompra hay que partirla en dos

Hoy `repeatRate` cuenta organizadores con ≥2 **torneos pagos**. Con créditos eso
miente: quien quema 5 créditos parece fiel cuando solo compró una vez.

| Indicador | Qué responde |
|---|---|
| **Recompra** | ¿Volvió a **comprar**? (paquete o torneo suelto) |
| **Torneos por organizador** | ¿Cuánto **usa** la plataforma? |

La pregunta que importa es: **¿volvió a comprar después de terminar su
paquete?** Eso solo se ve contando compras, no torneos.

### Finanzas

El torneo del paquete aparece con un sello **"Paquete"**, igual que hoy aparece
el de cortesía, y **sin sumar ingreso**.

⚠️ Esto es lo que evita **contar la misma plata dos veces**: los $320.000 ya se
contaron el día que entró el pago. Si además cada torneo del paquete sumara
$64.000, el mismo dinero aparecería dos veces y el año cerraría inflado.

El sello debe poder abrirse hasta la compra que lo originó, para responder "¿de
dónde salió este torneo?" sin salir de la pantalla.

---

## Dos trampas que hay que evitar

**1. No usar cupones para marcar los torneos del paquete.** Es tentador porque
el checkout ya sabe aplicarlos, pero un cupón `free_tournament` deja el torneo
como cortesía y **Finanzas lo muestra en $0** — exactamente el problema que se
arregla a mano en `pago-duvan.md`, multiplicado por cinco.

**2. No meter el valor en `tournaments.price`.** Ese campo ya significa tres
cosas distintas según cómo se creó el torneo (pago normal = lo cobrado,
cortesía = lista, post-upgrade = lista del tier nuevo). Una cuarta lo vuelve
inservible.

**3. El torneo creado con crédito tiene que quedar idéntico a uno pagado:**
`plan = 'paid'`, el tier según sus equipos, y sin cupón encima. Si queda como
gratis, el cliente pagó y aun así le faltan funciones limitadas por tier (por
ejemplo los enlaces de anotador, `MAX_SCORER_LINKS_BY_TIER`) y va a reclamar con
razón.

---

## Modelo de datos

```sql
CREATE TABLE tournament_credits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- De qué compra salió. Un paquete de 5 son 5 filas con el mismo payment_id.
  payment_id    UUID NOT NULL REFERENCES payments(id),
  -- Lo que costó este crédito ($64.000 = 320.000 / 5). NO se le suma al torneo
  -- como ingreso: la plata ya se contó al cobrar el paquete. Sirve para
  -- avisarle al cliente cuándo NO le conviene gastarlo (un torneo de $40.000),
  -- y para poder repartir el monto más adelante si los paquetes se vuelven la
  -- mayoría de las ventas.
  value_cop     INT  NOT NULL CHECK (value_cop >= 0),
  -- Techo de equipos, CONGELADO al comprar. Si mañana cambia la oferta, los
  -- créditos ya vendidos conservan sus condiciones.
  max_teams     INT  NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  consumed_at   TIMESTAMPTZ,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credits_available
  ON tournament_credits (user_id, expires_at)
  WHERE consumed_at IS NULL;
```

**Una fila por crédito y no un contador**, por tres razones: el consumo se puede
reclamar atómicamente, cada crédito deja rastro de en qué torneo se usó, y cada
uno carga su propio valor atribuido — que es lo que hace que la contabilidad
cuadre. Es el mismo criterio que ya usa la tabla `coupons`.

`max_teams` y `expires_at` se repiten en las 5 filas a propósito: son las
condiciones de esa compra, no del catálogo actual.

### Consumo atómico

Sin esto, dos pestañas abiertas gastan dos créditos en un torneo:

```sql
UPDATE tournament_credits
SET    consumed_at = now(), tournament_id = :tournament_id
WHERE  id = (
  SELECT id FROM tournament_credits
  WHERE  user_id = :user_id
    AND  consumed_at IS NULL
    AND  expires_at > now()
    AND  max_teams >= :team_count
  ORDER  BY expires_at ASC   -- se gasta primero el que vence antes
  LIMIT  1
  FOR UPDATE SKIP LOCKED
)
RETURNING id;
```

Devuelve 0 filas si no hay crédito disponible — el llamador tiene que tratar eso
como "no se pudo", nunca crear el torneo igual.

---

## Las pantallas

### 1. Arriba en "Crear torneo"

Lo primero que ve al entrar:

```
🎟️  Te quedan 3 torneos          [ Comprar más ]
    Vencen el 15/03/2027
```

Si no tiene ninguno, la misma franja ofrece el paquete. **La fecha de
vencimiento va siempre visible**: si no la ve cada vez que entra, el día que se
le venzan es una discusión.

### 2. En el diálogo de pago — tres formas

`src/components/forms/tournament-cost-dialog.tsx` hoy tiene cupón + pagar. Se le
suma el crédito, y **la opción que le conviene viene preseleccionada**:

**Torneo de 9 a 24 equipos, con créditos:**
```
● Usar 1 de tus 3 créditos          ← preseleccionado
  Te quedarían 2
○ Aplicar un cupón
○ Pagar $70.000
```

**Torneo chico (hasta 8 equipos, $40.000):**
```
● Pagar $40.000                     ← preseleccionado
○ Usar 1 crédito
  Este torneo cuesta menos que un crédito
```

**Sin créditos, si elige esa opción:** se le ofrece el paquete ahí mismo. Es el
mejor momento posible — ya decidió que quiere crear el torneo.

**Nunca automático.** Gastar un crédito es gastar plata; hacerlo en silencio es
lo que rompe la confianza. Y avisarle cuando le conviene *no* usarlo cuesta una
línea y es lo que hace que confíe en todo lo demás.

### 3. El upsell personalizado (dashboard)

El más fuerte, y no necesita datos nuevos:

> *"Ya compraste 3 torneos sueltos ($210.000). Con el paquete te habrían costado
> $192.000."*

Mostrarle lo que **ya pagó de más** convence más que cualquier tabla de precios.

### 4. `/pricing`

Para que el paquete sea parte de la oferta pública, no solo una venta a dedo.

---

## Cómo se compra el paquete

**Aparte del flujo de crear torneo.** El checkout de creación mete los datos del
torneo dentro del pago (`payments.tournament_data`) y es el sistema el que lo
crea al aprobarse: reusar ese camino generaría un torneo fantasma por cada
paquete.

Necesita:

- Página propia de pago, **calcada de `/pagar/publicidad/[id]`**. La página
  intermedia es obligatoria: el link directo a Wompi lo bloquea el WAF.
- Rama nueva en `src/lib/payments/fulfill.ts`, al lado de la de `upgrade`, que al
  aprobarse **cree los 5 créditos en vez de un torneo**. Idempotente, igual que
  las otras.

---

## Orden de construcción

| # | Qué | Notas |
|---|---|---|
| 1 | Tabla `tournament_credits` + RPC de consumo atómico | La base |
| 2 | Compra del paquete: página de pago + rama en `fulfill.ts` | Ya se puede vender a mano mientras tanto |
| 3 | Consumir el crédito al crear torneo (diálogo + franja de arriba) | Sin esto los créditos no sirven |
| 4 | **Contabilidad: Negocios y Finanzas** | ⚠️ Antes de vender el primer paquete de verdad |
| 5 | Upsell personalizado + `/pricing` | Crecimiento, no bloqueante |

⚠️ **El paso 4 no se puede dejar para después.** El día que entre el primer
paquete sin eso, Negocios empieza a mostrar dos cifras distintas del mismo
ingreso y no avisa.

---

## A quién venderle el primero

**A Daniel.** Ya compró 4 torneos de una sentada por $290.500, pagando lista las
4 veces. Ese señor **ya compró un paquete**, solo que sin descuento y sin quedar
amarrado. Es la prueba de que hay demanda y el cliente obvio para estrenarlo.

---

## Decisiones abiertas

1. **Vigencia de los créditos.** Propuesta: **12 meses**. La temporada real es de
   ~4 meses al año, así que 12 meses cubre una temporada completa con margen, y
   Daniel hizo 4 torneos en una sola. Falta confirmarlo.
2. **¿Se devuelve la plata?** Propuesta: no hay devolución, pero el admin puede
   extender la vigencia. Hay que escribirlo antes de la primera venta.
3. **¿Los créditos se transfieren entre cuentas?** Propuesta: no. Sin sub-usuarios
   en el modelo, un traspaso es un caso raro que se resuelve a mano.
4. **Cómo se cuenta la recompra** una vez partida en dos (ver arriba). Define qué
   número mira el negocio de acá en adelante.
