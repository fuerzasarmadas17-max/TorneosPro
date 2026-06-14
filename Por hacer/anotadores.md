# Plan: anotadores cargando resultados vía link compartible

**Estado:** planeación. No implementado todavía.
**Última actualización:** 2026-06-13

## Contexto

Los organizadores tienen árbitros / anotadores que llenan resultados y
stats por ellos. Hoy solo el creador del torneo puede tocar partidos (RLS
`created_by = auth.uid()`). El organizador necesita **delegar** la carga
sin abrirle el panel completo.

**Caso de uso real:** el organizador, media hora antes del partido,
escribe por WhatsApp al árbitro de turno: "hola Juan, anotá estos dos
partidos del sábado". Le manda un link. Juan tap, abre el celu, carga
resultados.

## Decisión central

**Link compartible sin cuenta.** El organizador elige uno o varios
partidos programados, genera un link, lo comparte por WhatsApp. El
anotador abre el link, escribe su nombre, y carga el resultado de cada
partido. La tabla pública del torneo se actualiza en tiempo real.

**Defaults clave** (decididos en la planeación):

- **Expiración:** 24h después del **último** partido cubierto. Pasado eso,
  el link no funciona aunque exista.
- **Permisos del anotador:** SOLO cargar resultado + sets + eventos/stats
  de los partidos incluidos. NO puede cambiar fecha, hora, lugar, equipos,
  ni acceder a otros partidos.
- **Identidad:** al abrir el link, el anotador escribe su nombre. Se
  persiste en `localStorage` del navegador y se envía en cada request al
  endpoint → queda guardado en DB como `entered_by_name`.
- **Alcance:** un solo torneo por link (cada link cubre N partidos del
  mismo torneo).

## Cap por tier

Cantidad máxima de **links activos** por torneo (donde "activo" = no
expirado ni revocado):

| Tier     | Equipos  | Precio    | **Links activos máx por torneo** |
|----------|----------|-----------|----------------------------------|
| Free     | hasta 10 | $0        | **1**                            |
| Básico   | 1-8      | $40.000   | **3**                            |
| Medio    | 9-16     | $70.000   | **5**                            |
| Pro      | 17-24    | $100.000  | **10**                           |
| Premium  | 25+      | $130.000  | **ilimitado**                    |

**Por qué tiene sentido este cap:**

- Un organizador con 3 canchas en paralelo necesita ~3 links simultáneos
  (un árbitro por cancha). Eso lo empuja a Básico.
- Un torneo grande con 5+ canchas → Medio o Pro.
- Premium es para ligas con varias jornadas de árbitros distintos por día.

El cap se mide al CREAR un link nuevo. Links expirados o revocados no
cuentan (liberan slot).

## Schema

```sql
-- 1. Tabla principal de links
CREATE TABLE scorer_links (
  token TEXT PRIMARY KEY,                    -- 32 chars random, va en la URL
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_ids UUID[] NOT NULL,                 -- partidos cubiertos
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,           -- MAX(match.date+time) + 24h
  revoked_at TIMESTAMPTZ,                    -- NULL = activo
  last_used_at TIMESTAMPTZ,
  usage_count INT NOT NULL DEFAULT 0,
  CONSTRAINT match_ids_not_empty CHECK (array_length(match_ids, 1) > 0)
);
CREATE INDEX idx_scorer_links_tournament ON scorer_links(tournament_id)
  WHERE revoked_at IS NULL;
CREATE INDEX idx_scorer_links_expires ON scorer_links(expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE scorer_links ENABLE ROW LEVEL SECURITY;

-- El organizador del torneo gestiona los links.
CREATE POLICY "Organizer manages own tournament's scorer links"
  ON scorer_links FOR ALL
  USING (
    tournament_id IN (
      SELECT id FROM tournaments WHERE created_by = auth.uid()
    )
  );

-- 2. Trazabilidad en matches y match_events
ALTER TABLE matches
  ADD COLUMN result_entered_by_name TEXT,        -- nombre del anotador
  ADD COLUMN result_entered_via_token TEXT;      -- token usado (NULL si fue organizador)

ALTER TABLE match_events
  ADD COLUMN entered_by_name TEXT,
  ADD COLUMN entered_via_token TEXT;

-- volleyball_sets: si interesa trackear, idem
ALTER TABLE volleyball_sets
  ADD COLUMN entered_by_name TEXT,
  ADD COLUMN entered_via_token TEXT;
```

**NO se modifican** las policies RLS existentes de `matches` /
`match_events` / `volleyball_sets`. El cliente del anotador NO usa el
cliente Supabase directo — usa endpoints custom server-side (ver siguiente
sección). Por eso la RLS del anotador no es necesaria.

## Endpoints server-side

Toda la lógica del anotador pasa por endpoints custom en `/api/scorer/...`.
Cada uno valida el token antes de hacer cualquier cosa. Usan el cliente
**admin** de Supabase (`supabaseAdmin`, service role) para hacer los
updates, porque ya validamos manualmente y RLS los bloquearía si fuera
solo anon.

### `POST /api/scorer/link` (organizador crea link)

**Auth:** session de usuario logueado, requiere `created_by = user.id` del
torneo.

**Request body:**
```ts
{
  tournamentId: string;
  matchIds: string[];  // 1+ partidos
}
```

**Validaciones:**
1. Caller es el organizador del torneo.
2. Todos los `matchIds` pertenecen a ese torneo.
3. Todos los partidos están en `scheduled` (no `completed`, no `unscheduled`
   sin fecha).
4. Cap por tier: contar `scorer_links` activos (NO revoked, NOT expired)
   del torneo. Si `count >= cap` → `403 { error: "tier-limit", current, max, nextTier }`.

**Acción:**
1. Generar token: `crypto.randomBytes(24).toString('base64url')` (~32 chars).
2. Calcular `expires_at`: `MAX(match.date + match.time)` de los partidos
   + 24 horas.
3. INSERT en `scorer_links`.
4. Devolver `{ token, url, expires_at }`.

### `GET /api/scorer/[token]` (anotador abre el link)

**Auth:** ninguna (público).

**Validaciones:**
1. Token existe.
2. `revoked_at IS NULL`.
3. `expires_at > now()`.

**Acción:**
1. UPDATE `last_used_at = now()`.
2. Devolver los datos del link:
```ts
{
  tournament: { id, name, sport },
  matches: Match[],  // con teams + status + result si ya cargado
  expiresAt: string,
}
```

Si está expirado o revocado → `404 { error: "link-not-found" }`
(intencional: no revelar si existió o no).

### `POST /api/scorer/[token]/match/[matchId]/result` (anotador guarda)

**Auth:** ninguna (token en URL es la credencial).

**Request body:**
```ts
{
  scorerName: string;          // nombre del anotador
  homeScore: number;
  awayScore: number;
  sets?: { homePoints: number; awayPoints: number }[];  // vóley
  events?: { teamId: string; playerName: string; type: MatchEventType; ... }[];
}
```

**Validaciones:**
1. Token válido (no expirado, no revocado, existe).
2. `matchId` está en `scorer_links.match_ids` de ese token.
3. `scorerName.trim().length >= 1` (mínimo).

**Acción:**
1. UPDATE `matches`:
   - `home_score`, `away_score`, `winner_id`, `status='completed'`.
   - `result_entered_by_name = scorerName`.
   - `result_entered_via_token = token`.
2. Si hay `sets`: DELETE viejos + INSERT nuevos en `volleyball_sets` con
   `entered_by_name` y `entered_via_token`.
3. Si hay `events`: DELETE viejos del match + INSERT nuevos en
   `match_events` con trazabilidad.
4. UPDATE `scorer_links`:
   - `usage_count = usage_count + 1`.
   - `last_used_at = now()`.
5. Devolver el match actualizado.

**Importante:** este endpoint sigue el mismo patrón "borrar todo y
reinsertar" para eventos que usa el form actual del organizador. Si en
el futuro se cambia a UPDATE individual, ajustar.

### `POST /api/scorer/link/[token]/revoke` (organizador revoca)

**Auth:** session, `created_by` del torneo.

**Acción:** UPDATE `revoked_at = now()`.

## Flujo organizador

### A) Crear un link

En el tab **Calendario** del detalle del torneo, botón nuevo en el header:
**"📲 Compartir con anotador"**.

Modal:

```
┌────────────────────────────────────────────┐
│  Compartir partidos con anotador       [×] │
├────────────────────────────────────────────┤
│  Seleccioná los partidos:                  │
│                                            │
│  ☑ J3  Equipo A vs Equipo B   Sáb 16:00    │
│  ☑ J3  Equipo C vs Equipo D   Sáb 18:00    │
│  ☐ J3  Equipo E vs Equipo F   Dom 10:00    │
│                                            │
│  El link expirará: Dom 16/06 18:00         │
│  (24h después del último partido)          │
│                                            │
│  Tu plan permite hasta 3 links activos.    │
│  Tenés 1 activo.                           │
├────────────────────────────────────────────┤
│                       [Cancelar] [Generar] │
└────────────────────────────────────────────┘
```

- Solo lista partidos `scheduled` del torneo, ordenados por fecha + hora.
- Si el organizador está al tope del cap: deshabilitar "Generar" + CTA
  "Subí a [tier+1] para crear más links" + link al upgrade.

Al generar:

```
┌────────────────────────────────────────────┐
│  ✓ Link creado                         [×] │
├────────────────────────────────────────────┤
│  https://misurl.com/score/abc123XYZ…       │
│                                            │
│  [📋 Copiar link]  [📱 Enviar por WhatsApp]│
│                                            │
│  Cubre 2 partidos · Expira Dom 18:00       │
└────────────────────────────────────────────┘
```

WhatsApp share usa `https://wa.me/?text=Hola%20Juan!%20Anot%C3%A1...<URL>`.

### B) Gestionar links activos

Debajo del botón "Compartir", sub-sección **"Links activos"**:

```
┌─────────────────────────────────────────────┐
│ Links activos (1 de 3)                      │
├─────────────────────────────────────────────┤
│ 🟢 abc123XYZ… · 2 partidos · creado hace 2h │
│    Usado 1 vez · última carga hace 30min    │
│    [Copiar] [Enviar WhatsApp] [Revocar]     │
├─────────────────────────────────────────────┤
│ ⚪ xyz789ABC… · 3 partidos · expira en 18h  │
│    Nunca usado                              │
│    [Copiar] [Enviar WhatsApp] [Revocar]     │
└─────────────────────────────────────────────┘
```

Filtros opcionales: "Activos" / "Expirados (últimos 30 días)" / "Todos".

## Flujo anotador

### Pantalla 1 — Primer load

```
🏆 Torneo Apertura 2026

¿Cómo te llamás?
┌─────────────────────────┐
│                         │
└─────────────────────────┘
       [Continuar]
```

Al continuar:
- Validar `name.trim().length >= 2`.
- Guardar en `localStorage` con key `scorer_name_<token>` → siguiente
  visita al mismo link no vuelve a preguntar.
- Pasar a Pantalla 2.

### Pantalla 2 — Lista de partidos

```
🏆 Torneo Apertura 2026
Hola Juan 👋

Tus partidos:

┌────────────────────────────────┐
│ Equipo A      vs      Equipo B │
│ Sáb 16:00 · Cancha 1           │
│ ⚪ Pendiente                →   │
├────────────────────────────────┤
│ Equipo C      vs      Equipo D │
│ Sáb 18:00 · Cancha 1           │
│ ✓ Completado: 3-2              │
│ Cargado por vos hace 30 min   →│
└────────────────────────────────┘

Este link expira: Dom 16/06 18:00
```

- Estado por partido: ⚪ pendiente / ✓ completado.
- Tap en una card → Pantalla 3.

### Pantalla 3 — Scoresheet

Reusamos el componente `match-result-form.tsx` existente, en modo
"scorer link":
- Solo permite editar score + sets + eventos.
- Esconde campos de fecha, hora, lugar, equipos.
- El "Guardar" llama al endpoint `/api/scorer/[token]/match/[matchId]/result`
  en lugar de la mutation directa al supabase client.

Al guardar:
- Toast "Resultado guardado".
- Vuelve a la Pantalla 2.
- El partido aparece como ✓ completado.

### Layout

- `/score/[token]` es una ruta separada con su propio layout (sin sidebar,
  sin nav del dashboard).
- Mobile-first: las cards son grandes y "tap-friendly" para usar con un
  dedo en cancha.

## Realtime

Cuando el endpoint del anotador guarda un cambio, la tabla pública del
torneo lo refleja sin reload:

```ts
// En tournament-detail.tsx
useEffect(() => {
  const channel = supabase
    .channel(`tournament-${tournament.id}`)
    .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches',
          filter: `tournament_id=eq.${tournament.id}` },
        (payload) => {
          // Actualizar el estado local con el match nuevo
        })
    .subscribe();
  return () => supabase.removeChannel(channel);
}, [tournament.id]);
```

Idem para `match_events`.

**Importante:** Realtime no es exclusivo de este feature — sirve para que
TODA la app sea más responsiva. Si se implementa, beneficia a la tab
pública, dashboards del organizador, y a la pantalla del anotador (por si
otro anotador cargó algo en paralelo).

## Fases de implementación

1. **Schema (migration SQL):** `scorer_links` + columnas de trazabilidad
   en `matches`, `match_events`, `volleyball_sets`.
2. **`pricing.ts`:** `MAX_SCORER_LINKS_BY_TIER` con los caps.
3. **Endpoints:**
   - `POST /api/scorer/link` (crear).
   - `GET /api/scorer/[token]` (leer).
   - `POST /api/scorer/[token]/match/[matchId]/result` (guardar).
   - `POST /api/scorer/link/[token]/revoke` (revocar).
4. **UI organizador A — Crear link:** modal en Calendario con selector de
   partidos + cálculo de expires_at + botón "Generar" → modal de share
   con WhatsApp button.
5. **UI organizador B — Lista de links activos:** debajo del botón
   "Compartir" o en sección aparte. Estado, last_used, acciones.
6. **Página `/score/[token]`:** layout mobile-first sin nav. Pantalla 1
   (nombre) + Pantalla 2 (lista de partidos).
7. **Scoresheet del anotador:** reusar `match-result-form.tsx` con flag
   "scorerMode" que cambia el endpoint de save + esconde campos no
   editables. Tirar el `next/link` interno por `router.push` a
   `/score/[token]/match/[matchId]`.
8. **Realtime:** subscripción en `tournament-detail.tsx` para `matches`,
   `match_events`, `volleyball_sets`. Beneficia esta feature pero también
   toda la app.
9. **Verificación end-to-end** (ver siguiente sección).

## Verificación

- Organizador crea link de 2 partidos → recibe URL y botón WhatsApp.
- WhatsApp share abre con texto pre-formado: "Hola! Anotá estos partidos:
  https://...".
- Anotador abre URL en móvil → pantalla nombre → pone "Juan" → ve los
  2 partidos.
- Carga score del partido 1 → status pasa a `completed` + columnas de
  trazabilidad con name + token.
- En otra pestaña con la tabla pública del torneo → ve el resultado
  aparecer sin reload (realtime).
- Anotador intenta abrir un partido del torneo que NO está en el link
  (via devtools, URL): 403.
- Pasadas 24h después del último partido del link, abrir URL → 404
  "link no encontrado".
- Organizador revoca un link activo → la URL deja de funcionar inmediato.
- Organizador en Free (cap 1) intenta crear un 2º link → 403 con CTA
  upgrade.
- Anotador en otro dispositivo (sin localStorage) abre el mismo link →
  vuelve a pedir nombre. Distintos `entered_by_name` quedan en DB.

## Soporte por deporte (v1)

| Deporte | Soportado en /score | Notas |
|---|---|---|
| Fútbol / Futsal / Microfútbol | ✅ Score + goles + tarjetas + asistencias | Funciona |
| Vóley | ✅ Score + sets (1-9) + aces/dobles faltas | Funciona |
| Basketball | ✅ Score + puntos/asistencias/bloqueos/rebotes | Funciona |
| Ping-pong / Tenis / Pádel | ✅ Solo score | Estos deportes no tienen stats en el catálogo |
| Béisbol / Softball / Wiffleball | ❌ Bloqueado en v1 | Mensaje pidiendo que el organizer cargue |

**Por qué béisbol queda fuera v1:** el scoresheet de béisbol es una planilla
~9×10 celdas (jugadores × stats: at_bats, hits, dobles, triples, HR, RBI,
errores, walks, ponches, runs). En pantalla de 360px ese layout se rompe —
o las celdas quedan ilegibles, o hay que hacer scroll horizontal. El
`baseball-scoresheet.tsx` actual está pensado para tablet/desktop (donde
el organizer suele estar). Para llevarlo a mobile habría que re-diseñar
con un patrón "tap un jugador → modal con sus stats" en lugar de la grilla.
Trabajo no trivial; aparte de momento no hay caso de uso real demandándolo.

**Cuándo retomarlo:** cuando aparezca un torneo de béisbol/softball cuyo
organizer quiera delegar la carga. Ahí evaluamos el re-diseño mobile vs.
seguir asumiendo que el organizer carga desde su compu/tablet.

## Open questions / decisiones pendientes

- **Compartir entre anotadores:** si Juan reenvía el link a Pedro y Pedro
  carga, queda como "cargado por Pedro vía link XYZ". Aceptable. Si el
  organizador no quiere eso, debe gestionar a quién manda el link.
- **Conflicto de carga simultánea:** dos anotadores cargan el mismo
  partido al mismo tiempo → último gana. Aceptable para v1; en v2 se podría
  detectar con un `updated_at` y mostrar "alguien más cargó hace 5
  segundos, ¿pisar?".
- **Anotador que pierde el link:** debe pedirle al organizador que lo
  reenvíe. No hay self-service de recuperación.
- **Edición post-guardado:** ¿el anotador puede volver a abrir un partido
  ya `completed` y corregir? **Recomendación:** sí, si el link sigue
  activo. Eso permite corregir errores en cancha. Cada update sobrescribe
  trazabilidad.
- **Notificaciones al organizador:** cuando el anotador guarda, ¿el
  organizador recibe push/email? Fuera de scope v1; se agrega después si
  hace falta.
- **WhatsApp share fallback:** `wa.me` requiere que el usuario tenga
  WhatsApp instalado. Si no, ofrecer "Copiar link" como fallback es
  suficiente. Si querés soportar SMS también, agregar un `sms:?body=`.

## Estimación de esfuerzo

| Fase | Esfuerzo |
|---|---|
| Schema + migration | 20 min |
| `pricing.ts` + tipo | 5 min |
| 4 endpoints | 60 min |
| UI organizador (modal crear + lista activos) | 90 min |
| Página `/score/[token]` (Pantalla 1 + 2) | 60 min |
| Scoresheet en modo scorer | 45 min (mayormente reuso) |
| Realtime | 30 min |
| Tests + verificación e2e | 30 min |
| **Total** | **~5h-6h** de codeo limpio |

## Análisis de seguridad

**TL;DR:** el modelo NO genera inseguridad significativa si la implementación
respeta 4 puntos concretos. Es el mismo patrón que usan Google Forms con
share link, Strava, Calendly o Slido.

### Por qué NO es inseguro

1. **Los resultados son públicos**. La tab del torneo ya los muestra a
   todo el mundo. El "secreto" del link es el **derecho a escribir**, no
   a leer información privada — no se filtra data nueva.
2. **Blast radius chico**. Quien se haga del link solo puede cargar mal
   el resultado de N partidos puntuales. No accede a otros torneos, no
   toca configuración, no entra al panel del organizador, no ve pagos.
   El organizador puede pisar cualquier resultado mal cargado en 30 seg.
3. **Expiración + revocación**. 24h después del último partido el link
   muere solo. El organizador puede revocarlo manualmente cuando quiera.
4. **Entropía suficiente**. Token de 32 chars (`crypto.randomBytes(24)`)
   = 192 bits. Adivinar uno por fuerza bruta es computacionalmente
   imposible.

### Riesgos reales y cómo se mitigan

| Riesgo | Mitigación |
|---|---|
| **DoS / spam:** alguien con el token bombardea el endpoint | Rate limit en `/api/scorer/*` (ej. 30 req/min por IP+token). Middleware de Next.js o Vercel KV |
| **Inyección de stats absurdas** ("Juan metió 500 goles") | Validar rangos en el endpoint (score 0-99, etc.). Badge "verificar" en UI organizador si hay cambios bruscos |
| **Race condition:** dos anotadores cargan a la vez el mismo partido | v1: "último gana" (lo que ya hace toda la app). v2: comparar `updated_at` antes de pisar |
| **`SUPABASE_SERVICE_ROLE_KEY` filtrada** | Estándar: solo en env vars, nunca en cliente, nunca commiteada. No es nuevo del feature |
| **Token filtrado por screenshot/reenvío** | Aceptado. Organizador revoca si ve abuso. `last_used_at` / `usage_count` para detectar uso anormal |

### Limitaciones aceptadas (trade-offs del modelo)

- **No sabés quién físicamente cargó.** Solo el nombre que escribió + el
  token. Si Juan le da el celu a Pedro, sigue siendo "Juan" en DB.
- **Anotador puede pisarse a sí mismo** mientras el link esté activo. OK
  porque permite arreglar errores en cancha, pero no hay historial de
  ediciones.

### 4 cosas que NO podés olvidar al implementar

1. **Rate limiting** en endpoints `/api/scorer/*`.
2. **Validar TODOS los inputs**: token existe + matchId pertenece al token
   + scoreboard en rangos cuerdos + nombre no vacío.
3. **`SERVICE_ROLE_KEY` solo server-side**, nunca cliente, nunca git.
4. **Logs de uso por token** (`last_used_at`, `usage_count`) para detectar
   abuso temprano.

Con eso, el feature es seguro y profesional. Si en algún momento aparece
una federación que exige auditoría persona-por-persona, ahí sí se vuelve
al plan original con cuentas (ver sección final).

## Roadmap de implementación

Se ataca en este orden, una fase = un commit:

1. **A1 — Schema (~20 min):** migration SQL + RLS.
2. **A2 — Pricing (~5 min):** `MAX_SCORER_LINKS_BY_TIER` en `pricing.ts`.
3. **A3 — Endpoints (~1h):** los 4 routes en `/api/scorer/*` con rate
   limit + validación.
4. **A4 — UI organizador (~1.5h):** botón en Calendario + modal crear
   + lista activos.
5. **A5 — Página anotador (~1.5h):** `/score/[token]` con Pantallas 1/2
   + reuso del `match-result-form.tsx` en modo scorer.
6. **A6 — Realtime (~30 min):** channel sobre `matches` y `match_events`
   en `tournament-detail.tsx`.
7. **A7 — Verificación + push prod (~30 min):** casos del e2e + correr
   SQL en Supabase Dashboard + push a `main`.

---

## Alternativa descartada: cuentas + cap por tier

El plan original (anterior a esta versión) proponía:
- Rol nuevo `scorer` con cuenta de usuario real.
- Magic link a email del anotador.
- Pool de anotadores por torneo (`tournament_scorers` many-to-many).
- Asignación por partido (`matches.assigned_scorer_id`).
- Cap por tier: 1-5 anotadores en el pool.

**Por qué se descartó:**

1. **Fricción para el anotador:** requiere email, recibir magic link,
   esperar que llegue, abrirlo del email. Con WhatsApp es 1 tap.
2. **Email no es el canal real:** en Latam los árbitros se coordinan por
   WhatsApp, no por email. Pedir email es una barrera artificial.
3. **Caso real es efímero:** el organizador delega "estos 2 partidos del
   sábado" y listo. No necesita un anotador "permanente" del torneo.
4. **Trazabilidad por nombre+token es suficiente:** no necesitamos cuenta
   para saber "lo cargó Juan". El nombre que pone el anotador + el token
   da la auditoría que necesitamos.

**Cosas rescatadas del plan original:**

- Cap por tier (acá es sobre **links activos**, antes era sobre **personas
  en el pool**).
- Trazabilidad (acá es por nombre + token, antes era por user_id).
- Realtime (igual en ambos enfoques).
- 6 de las 9 fases técnicas son equivalentes con cambios menores.

**Cuándo retomar el plan original (modo enterprise):** si en algún momento
aparece una organización formal (ej. federación) que exige cuentas
auditadas + permisos finos por persona, ese plan sigue válido. Sería una
feature paga premium "anotadores profesionales" arriba del actual.
