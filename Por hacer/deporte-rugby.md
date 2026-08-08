# Agregar rugby como deporte

**Estado:** diseño cerrado, **no implementado**. Falta decidir dos cosas (ver
*Decisiones abiertas* al final) — ninguna bloquea empezar.
**Fecha:** 2026-08-08.
**Origen:** el organizador quiere ofrecer rugby. El pedido textual fue *"algo
sencillo, pero lo más pegado al rugby posible, teniendo en cuenta solo lo que
en los torneos amateurs se contabiliza"*.

---

## La decisión de fondo

**Se hace con puntos bonus.** Es lo que separa una tabla de rugby de una tabla
de fútbol con otro nombre, y es el sistema que usan las ligas amateur de 15s.

Igual queda un selector al crear el torneo, porque el bonus tiene un requisito
que no todos los torneos van a cumplir (ver *El problema del bonus*):

| Opción | Sistema | Cuándo |
|---|---|---|
| **Con bonus** *(por defecto)* | 4 victoria · 2 empate · 0 derrota, + los dos bonus | Liga donde sí van a anotar los tries |
| **Sin bonus** | 3 victoria · 2 empate · 1 derrota | Torneo rápido, estilo Seven, donde solo se mete el marcador |

El precedente de este selector es el "al mejor de 3 o 5" de volleyball
(`best_of`): una columna propia del deporte en `tournaments`, elegida al crear.

---

## Qué se registra por jugador

| Jugada | Vale | Por qué está |
|---|---:|---|
| **Try** | 5 | *La* estadística del rugby. Es el "goleador" — toda liga amateur publica su tabla de tries |
| **Conversión** | 2 | La patada después del try |
| **Penal** | 3 | |
| **Drop** | 3 | Raro en amateur, pero no cuesta nada tenerlo |
| **Tarjeta amarilla** | — | Existe en rugby (10 minutos afuera) |
| **Tarjeta roja** | — | |

No se incluyen tackles, metros ganados ni posesión: nadie los anota a mano en
un torneo amateur, y una estadística que queda siempre en cero es peor que no
tenerla.

---

## La tabla de posiciones

**Puntos por partido:**

- **4** por victoria
- **2** por empate
- **0** por derrota
- **+1 bonus ofensivo** — marcar **4 tries o más**, se gane o se pierda
- **+1 bonus defensivo** — perder por **7 puntos o menos**

**Orden de desempate:**

1. Puntos
2. Diferencia de puntos
3. Tries marcados
4. Enfrentamiento directo

Los primeros dos criterios y el head-to-head ya están resueltos en
`use-standings.ts`; lo nuevo es el tercero y los bonus.

**Columnas de la tabla:** PJ · G · E · P · PF · PC · Dif · **T** (tries) ·
**BO** · **BD** · Pts.

---

## ⚠️ El problema del bonus, y el guardarraíl

El bonus ofensivo necesita saber **cuántos tries marcó cada equipo en cada
partido**. Eso sale de los eventos por jugador, que ya es como funciona todo lo
demás (`match_events`).

**El riesgo:** si el organizador mete solo el marcador final (24-17 y listo) y
no anota los tries, el sistema cuenta **cero tries** y le quita un bonus que sí
se ganó. Sin error, sin aviso: la tabla queda mintiendo en silencio. Es
exactamente el tipo de falla que ya nos pasó con los ingresos de Negocios —
dos números del mismo hecho, ninguno rojo.

**Dos defensas:**

1. **El selector de arriba.** El que no va a anotar tries elige "sin bonus" y
   la tabla no promete algo que no puede calcular.
2. **Aviso en la tabla.** Si un partido está terminado, tiene marcador y
   **cero tries registrados**, la tabla lo dice arriba: *"3 partidos sin tries
   anotados — los bonus ofensivos de esos partidos no se están contando."*
   Molde a seguir: `walkover-rule-note.tsx`, que ya explica una regla al
   público en la misma superficie.

---

## Los pasos

### PASO 1 — La migración (la corre el organizador)

Un solo archivo, `supabase/migrations/20260808_rugby.sql`:

```sql
-- 1. El deporte
ALTER TYPE sport ADD VALUE IF NOT EXISTS 'rugby';

-- 2. Las jugadas nuevas
ALTER TYPE match_event_type ADD VALUE IF NOT EXISTS 'try_scored';
ALTER TYPE match_event_type ADD VALUE IF NOT EXISTS 'conversion';
ALTER TYPE match_event_type ADD VALUE IF NOT EXISTS 'penalty_kick';
ALTER TYPE match_event_type ADD VALUE IF NOT EXISTS 'drop_goal';

-- 3. El sistema de puntos del torneo
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS rugby_bonus BOOLEAN;
```

⚠️ **`try_scored`, no `try`.** `try` es palabra reservada en varios lenguajes y
se vuelve incómoda del lado del código; la etiqueta que ve el usuario sí dice
"Try".

⚠️ **`ALTER TYPE ... ADD VALUE` no corre dentro de una transacción** en
Postgres. En el editor SQL de Supabase hay que correr los `ALTER TYPE` **uno
por uno**, o separados del resto. Si se pega todo junto y falla, es por esto.

⚠️ **`rugby_bonus` queda nullable a propósito.** `NULL` = no es un torneo de
rugby. El valor por defecto (`true`) se pone al crear desde la app, no en la
base, para que un torneo viejo no quede marcado como si fuera de rugby.

### PASO 2 — El catálogo (donde vive el deporte)

| Archivo | Qué se agrega |
|---|---|
| `src/types/index.ts` | `"rugby"` al tipo `Sport`; `"rugby"` a `SportCategory` y a `getSportCategory`; las 4 jugadas nuevas a `STAT_CATALOG` con `sportDefaults: ["rugby"]`; sumar `"rugby"` a los `sportDefaults` de amarilla y roja; `rugbyBonus?: boolean` en `Tournament`; interfaz `RugbyStandingsEntry` |
| `src/data/sports.ts` | `{ key: "rugby", label: "Rugby", emoji: "🏉", scoringUnit: "puntos" }` |
| `src/data/sport-images.ts` | `rugby: []` en `SPORT_IMAGES` + su degradado en el mapa de gradientes |
| `src/components/tournaments/tournament-card.tsx` | El color de la tarjeta |
| `src/lib/db/mappers.ts` | Leer y escribir `rugby_bonus` ↔ `rugbyBonus` |

### PASO 3 — La tabla de posiciones

- **`src/hooks/use-rugby-standings.ts`** (nuevo). Molde:
  `use-basketball-standings.ts`, que es el más parecido y el más corto (142
  líneas). Necesita algo que los otros no: leer `match_events` de tipo
  `try_scored` para contar tries por equipo y por partido.
- **`src/components/standings/rugby-standings-table.tsx`** (nuevo). Molde:
  `basketball-standings-table.tsx`.
- Engancharla en **`group-stage-view.tsx`** y en **`tournament-detail.tsx`**,
  en los mismos dos `switch` donde ya se elige entre vóley, básquet y el resto.

### PASO 4 — El formulario de crear torneo

En `create-tournament-form.tsx`, el selector de sistema de puntos, visible solo
cuando el deporte es rugby. Copiar el patrón de `bestOf`, que aparece en el
mismo archivo en cuatro lugares (estado, envío, y dos bloques de UI).

⚠️ **No olvidar `src/lib/payments/fulfill.ts`.** El torneo también se crea
desde ahí cuando entra un pago, y ahí se vuelve a armar el objeto a mano — es
donde vive la línea `bestOf: data.sport === "volleyball" ? ... : undefined`.
Si el selector se agrega solo en el formulario, **todo torneo de rugby pagado
nace sin sistema de puntos.**

### PASO 5 — Las reglas sueltas

- **`src/lib/walkover.ts`** — hoy rugby caería en el `3 - 0` genérico del
  final, que en rugby no significa nada. Ver *Decisiones abiertas*.
- **`src/lib/admin/auto-advance.ts`** — verificar qué hace con un empate en
  fase de playoffs. En rugby amateur se define por tiempo extra, así que lo más
  probable es que el organizador cargue el resultado final a mano y no haga
  falta tocar nada. **Confirmar antes de asumirlo.**

---

## Decisiones abiertas

### 1. El walkover (W) en rugby

Hoy todo lo que no es vóley ni béisbol se da por ganado **3-0**, que en rugby
es un marcador imposible (no hay forma de hacer 3 puntos y que el rival haga 0
sin que sea un penal solitario... que sí existe, pero como marcador
reglamentario no dice nada).

**Propuesta: 28-0.** Es el marcador reglamentario de World Rugby para un
partido no presentado, y equivale a 5 tries convertidos.

⚠️ **Con el 28-0 aparece un enredo:** un walkover no tiene eventos, así que no
tiene tries anotados, así que **no dispararía el bonus ofensivo** — pero el
marcador dice 28-0, que son 5 tries. La tabla se contradiría sola. Hay que
elegir: o el walkover otorga el bonus explícitamente (sin pasar por los
eventos), o se usa un marcador que no llegue a 4 tries. **Se decide al
implementar el Paso 5, no antes.**

### 2. El bonus defensivo

Quedó incluido, pero es lo que más varía entre ligas amateur. Si en los
torneos que se tienen en mente no se usa, se saca y listo — es una línea del
cálculo y una columna de la tabla.

---

## Cuánto es

**Unos 2 días.** Casi todo es copiar moldes que ya existen: vóley y básquet ya
tienen su propia tabla de posiciones y su propio bloque en el formulario, así
que no hay ninguna pieza que haya que diseñar desde cero. Lo único realmente
nuevo es contar tries por equipo para los bonus.

**Lo que NO hace falta:** fotos. `public/sports/` está vacío para los 11
deportes que ya existen, así que rugby va a caer al degradado como todos los
demás — no es una regresión ni algo que rugby estrene. Ver
`fotos-de-tarjetas.md`.
