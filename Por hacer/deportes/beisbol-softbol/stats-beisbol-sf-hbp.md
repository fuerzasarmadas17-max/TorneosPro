# Agregar sacrifice fly (SF) y hit by pitch (HBP) al béisbol

**Estado:** planeado, no implementado. **Verificado el 2026-08-06: nada de
esto se hizo** — `sacrifice_fly` y `hit_by_pitch` no aparecen ni en `src/`
ni en `supabase/`. El plan de abajo sigue siendo válido tal cual.
**Fecha:** 2026-06-14.

## Contexto

Hoy el catálogo de béisbol cubre AB, H (sencillos), 2B, 3B, HR, BB, RBI,
R, E, K y EXP. Falta:

- **SF** — Sacrifice Fly. Fly que avanza al corredor a anotar carrera. No
  cuenta como AB pero **sí cuenta en el denominador del OBP**.
- **HBP** — Hit By Pitch. El bateador es golpeado por el pitcher. No
  cuenta como AB, **sí cuenta en el numerador y denominador del OBP**.

Sin estas dos stats, el OBP que computa la app (`(H + BB) / (AB + BB)`)
queda **levemente inflado** respecto al OBP real de MLB. Para uso amateur
no es bloqueante; para alguien que llega de planilla "seria" o un torneo
con stats publicadas, es notorio.

## Fórmulas que cambian

| Stat | Hoy (app) | Después del fix |
|---|---|---|
| **AVG** | `H / AB` | Igual: `H / AB` |
| **OBP** | `(H + BB) / (AB + BB)` | `(H + BB + HBP) / (AB + BB + HBP + SF)` |
| **SLG** | `TB / AB` | Igual: `TB / AB` |
| **OPS** | `OBP + SLG` | Igual |

Notar que el SF resta al OBP (suma denominador, no numerador). Y el HBP
suma a ambos (te da on-base sin contar como AB).

## Cambios en el código

### 1. Schema (migration SQL)

`match_event_type` es un enum de Postgres. Hay que agregar los dos values
nuevos:

```sql
-- 20260614_baseball_sf_hbp.sql
ALTER TYPE match_event_type ADD VALUE IF NOT EXISTS 'sacrifice_fly';
ALTER TYPE match_event_type ADD VALUE IF NOT EXISTS 'hit_by_pitch';
```

Notas:
- `ADD VALUE` no rompe nada existente. Los matches ya cargados siguen
  funcionando — simplemente no tienen events con esos tipos.
- Hay que correrlo fuera de una transacción (Postgres no permite
  `ALTER TYPE ... ADD VALUE` dentro de `BEGIN`). Si lo corrés desde el
  SQL Editor de Supabase, eso ya es por fuera.

Sync en `supabase/schema.sql`:

```sql
CREATE TYPE match_event_type AS ENUM (
  'goal', 'assist', 'yellow_card', 'red_card', 'goals_against',
  'hit', 'double', 'triple', 'home_run', 'error',
  'ace', 'double_fault', 'winner',
  'block', 'point', 'steal', 'rebound',
  'strikeout', 'ejection',
  'blue_card',
  'at_bat', 'walk', 'rbi', 'run_scored',
  'sacrifice_fly', 'hit_by_pitch'  -- agregados
);
```

### 2. Catálogo de stats (`src/types/index.ts`)

Agregar el tipo unión:

```ts
export type MatchEventType =
  ...
  | "sacrifice_fly"
  | "hit_by_pitch";
```

Agregar al `STAT_CATALOG`:

```ts
{
  key: "sacrifice_fly",
  label: "Fly de sacrificio",
  pluralLabel: "Flys de sacrificio",
  sportDefaults: ["beisbol", "softball", "wiffleball"],
},
{
  key: "hit_by_pitch",
  label: "Golpeado",
  pluralLabel: "Golpeados por lanzamiento",
  sportDefaults: ["beisbol", "softball", "wiffleball"],
},
```

### 3. Scoresheet (`src/components/forms/baseball-scoresheet.tsx`)

Agregar al orden visual:

```ts
const BASEBALL_STAT_ORDER: MatchEventType[] = [
  "at_bat", "hit", "double", "triple", "home_run",
  "walk", "hit_by_pitch", "rbi", "run_scored",
  "sacrifice_fly", "error", "strikeout", "ejection",
];
```

Y al map de short labels:

```ts
const labels = {
  ...
  sacrifice_fly: "SF",
  hit_by_pitch: "HBP",
};
```

### 4. Cálculo de stats (`src/hooks/use-tournament-stats.ts`)

Extender el `entry`:

```ts
entry = {
  ...
  sf: 0,
  hbp: 0,
  ...
};
```

Switch del evento:

```ts
case "sacrifice_fly": entry.sf++; break;
case "hit_by_pitch":  entry.hbp++; break;
```

Fórmulas actualizadas:

```ts
e.avg = e.ab > 0 ? e.h / e.ab : 0;
const obpNum = e.h + e.bb + e.hbp;
const obpDen = e.ab + e.bb + e.hbp + e.sf;
e.obp = obpDen > 0 ? obpNum / obpDen : 0;
const totalBases = e.singles + 2 * e.doubles + 3 * e.triples + 4 * e.hr;
e.slg = e.ab > 0 ? totalBases / e.ab : 0;
e.ops = e.obp + e.slg;
```

### 5. Filtro de jugadores "con stats"

Hoy filtramos jugadores con `ab > 0 || bb > 0 || h > 0`. Después del fix,
extender por si alguien solo tiene SF o HBP:

```ts
.filter((e) => e.ab > 0 || e.bb > 0 || e.h > 0 || e.sf > 0 || e.hbp > 0)
```

### 6. Tabla individual (`src/components/standings/tournament-stats.tsx`)

Opcional: agregar columnas SF y HBP al `<Table>` de stats individuales
de béisbol. No es estrictamente necesario (los promedios ya quedan bien
sin mostrarlos), pero sirve para que el bateador vea el detalle.

Si se agregan, sumar entre BB y RBI para mantener orden lógico de la
planilla.

## Backwards compatibility

- Los matches ya cargados **no tienen** eventos de tipo `sacrifice_fly`
  ni `hit_by_pitch`. Eso significa que `sf = 0` y `hbp = 0` para todos
  los jugadores anteriores → las fórmulas nuevas dan exactamente el
  mismo resultado que hoy para esos jugadores. Cero regresión.
- Los enum values nuevos no afectan a otros deportes (no aparecen como
  default en `sportDefaults` excepto en béisbol/softball/wiffleball).

## Estimación

| Tarea | Esfuerzo |
|---|---|
| Migration SQL + schema sync | 10 min |
| Tipos + catálogo | 10 min |
| Scoresheet (orden + labels) | 10 min |
| Stats hook (entry + switch + fórmulas + filtro) | 20 min |
| Tabla individual (columnas SF/HBP opcional) | 15 min |
| Smoke test e2e | 15 min |
| **Total** | **~1.5h** |

## Cuándo retomar

Cuando aparezca un torneo de béisbol con stats publicadas / requerimiento
de OBP "oficial", o cuando el organizador lo pida explícitamente. Hasta
entonces el OBP simplificado es aceptable para el use case actual.

## Verificación

Caso de prueba para el hook:

- Jugador con 4 AB, 1 H, 1 BB, 1 HBP, 1 SF.
- Carrera al plato = 4 + 1 + 1 + 1 = 7 PA.
- AVG = 1/4 = .250 ✓
- OBP = (1 + 1 + 1) / (4 + 1 + 1 + 1) = 3/7 = .429 ✓
- SLG = 1/4 = .250 (asume single)
- OPS = .429 + .250 = .679

Caso sin SF/HBP (matches viejos):
- Jugador con 4 AB, 1 H, 1 BB → AVG = .250, OBP = 2/5 = .400 — mismo
  resultado que hoy.
