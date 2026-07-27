# Cobrar un torneo de cortesía después de que el cliente paga

**Estado:** solución definida, pendiente de ejecutar.
**Fecha:** 2026-07-22.
**Origen:** caso real — se creó un torneo con cupón de cortesía porque el
organizador no tenía cómo pagarlo ese día, y quedó en pagar dos días después.

## El problema

Un torneo creado con cupón (cortesía o 100% OFF) arrastra dos consecuencias que
no se arreglan solas cuando el cliente finalmente paga:

1. **Finanzas lo muestra en $0.** La página lee `tournaments.price` y le resta el
   cupón; mientras el `coupon_id` siga puesto, el ingreso se muestra como cero.
2. **Los equipos extra le salen gratis para siempre.** `computeUpgradeQuote`
   (`src/lib/payments/upgrade.ts:73`) calcula
   `cobro = (lista_nuevo − lista_actual) × (1 − d)`, y saca `d` del cupón del
   torneo. Con cortesía `d = 1`, así que todo upgrade da 0.

Y no existe ningún flujo en la app para cobrar un torneo **que ya existe**: el
checkout de creación mete los datos del torneo dentro de `payments.tournament_data`
y es el webhook el que lo **crea** al aprobarse, así que reusarlo generaría un
torneo duplicado. `upgrade-reference` solo sabe cobrar diferencias de tier.

## Dato clave: los dos reportes leen fuentes distintas

| Reporte | De dónde saca el ingreso |
|---|---|
| **Finanzas** (`src/app/admin/finances/page.tsx`) | `tournaments.price` menos el cupón. **No mira `payments`.** |
| **Negocios** (`src/app/admin/business/page.tsx:214`) | `payments` con `status = 'approved'`, sumando `amount_cop` agrupado por `tournament_id`. Un torneo sin pago aprobado ni siquiera entra en la lista de "pagos". |

Por eso hay que tocar las dos cosas: la fila en `payments` arregla Negocios, y
soltar el `coupon_id` arregla Finanzas y los upgrades.

## Solución (dos updates, sin código nuevo)

### 1. Cobrar

Link de pago desde el panel de Wompi, o transferencia. Da igual el medio.

### 2. Registrar el pago → arregla Negocios

```sql
INSERT INTO payments (
  reference, user_id, tournament_id, amount_cop, amount_in_cents,
  status, integrity_signature, tournament_data
) VALUES (
  'MANUAL-<referencia-de-wompi>',   -- la real de Wompi, para poder trazarla
  '<user_id del organizador>',
  '<tournament_id>',
  70000,                             -- debe coincidir con tournaments.price
  7000000,                           -- amount_cop × 100
  'approved',
  'manual',                          -- NOT NULL, no se valida al leer
  '{"type":"manual","nota":"cortesia pagada despues"}'::jsonb
);
```

`integrity_signature` y `tournament_data` son `NOT NULL` en el esquema
(`supabase/schema.sql:657`) pero solo se usan al **crear** el cobro, nunca al
leerlo, así que un placeholder alcanza.

Setear `tournament_id` desde el insert además vuelve inofensivo cualquier webhook
que llegue con esa referencia: `fulfillTournamentPayment` corta al principio si el
pago ya tiene torneo (`src/lib/payments/fulfill.ts:47`).

### 3. Soltar el cupón → arregla Finanzas y los upgrades

```sql
UPDATE tournaments SET coupon_id = NULL WHERE id = '<tournament_id>';
```

`price` **no se toca**: en los torneos de cortesía el cliente ya lo guarda con el
precio de lista (`src/components/forms/create-tournament-form.tsx:583`), así que
al soltar el cupón queda contado correcto.

`plan` tampoco: ya está en `"paid"`. Esto **importa** — `hasPaidBaseline`
(`upgrade.ts:50`) usa `coupon_id || plan === 'paid'`. Si el plan quedara en
`"free"`, al sacarle el cupón el sistema pensaría que no hay baseline pagado y le
cobraría el **precio completo del tier nuevo** en vez de la diferencia.

## Resultado

- **Finanzas**: el torneo pasa de $0 al precio real, sin el badge de cortesía.
- **Negocios**: aparece el pago aprobado, suma al LTV del organizador, al ingreso
  del mes y al tier correspondiente.
- **Upgrades**: `d = 0`. Si estaba en 16 equipos (Medio, 70.000) y sube a 17+,
  le cobra 100.000 − 70.000 = 30.000 por el flujo normal de Wompi.
- El cupón queda en `coupons` marcado como usado por él. Historial intacto,
  simplemente ya no cuelga del torneo.

## Precauciones

- Hacer el paso 2 y el 3 **juntos, y solo después de que la plata caiga**. Si se
  suelta el cupón antes, Finanzas muestra un ingreso que todavía no existe.
- `amount_cop` debe coincidir con `tournaments.price`, si no los dos reportes dan
  números distintos.

## Si se vuelve costumbre

Para un caso aislado, dos updates. Si empieza a repetirse (fiar un torneo y
cobrarlo después es un patrón comercial, no un accidente), la versión limpia es
copiar el molde de publicidad, que ya está probado:

- `POST /api/payments/tournament-link`, calcado de
  `src/app/api/ads/payment-link/route.ts`: solo admin, lee `tournaments.price`
  server-side, cancela links pendientes previos, inserta el `payments` y devuelve
  una URL propia.
- Página `/pagar/torneo/[id]`, copia de `/pagar/publicidad/[id]`. Es obligatoria:
  el link directo a Wompi lo bloquea el WAF, por eso existe la página intermedia
  que rebota con el form.
- Rama `data.type === "due"` en `fulfill.ts`, al lado de la de `upgrade`, que al
  aprobarse hace `plan = 'paid'` y `coupon_id = NULL`.
- Botón "Generar link de cobro" en la card del torneo en Finanzas, visible solo
  cuando tiene cupón.

Ventaja sobre el SQL manual: el cupón se suelta solo al entrar la plata, sin
depender de que alguien se acuerde.

## Pendiente relacionado

`upgradeTournamentFromPayment` (`fulfill.ts:267`) hace `price = data.newPrice`, o
sea **pisa el precio con el de lista del tier nuevo**, no con lo acumulado que se
pagó. Eso le da a `price` un tercer significado según cómo se creó el torneo
(pago normal = lo cobrado, cortesía = lista, post-upgrade = lista del tier nuevo)
y choca con el cálculo de Finanzas: un torneo con cupón % que después haga upgrade
va a mostrar el precio tachado inflado. Conviene unificar qué significa `price`.
