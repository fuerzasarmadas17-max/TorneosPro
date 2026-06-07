# Auditoría de performance — Landing y vistas públicas

**Fecha:** 2026-06-07
**Reporte original:** "La landing y las páginas para usuarios no logueados se sienten lentas. Hago click en 'Explorar torneo' / 'Iniciar sesión' / íconos de deportes / nombre del organizador / 'Ver torneo' y se queda ahí mismo, parece que no hace nada."

---

## Resumen ejecutivo

Se identificaron **6 cuellos de botella** que explican la sensación de lentitud. La causa raíz (#1) es un Provider global que carga todos los torneos + todos los equipos del país (con jugadores anidados) antes de mostrar **nada**, incluso para usuarios anónimos que solo quieren ver la landing. Los otros 5 son amplificadores.

**Recomendación:** atacar en 3 fases priorizadas (ver [Plan de acción](#plan-de-acción)).

---

## Problemas identificados

### 🔴 #1 — `TournamentProvider` carga todos los torneos y equipos al montar la app

**Impacto:** CRÍTICO. Afecta a landing + cualquier navegación inicial.

**Ubicación:**
- `src/context/tournament-context.tsx:120-158` — `loadData()`
- `src/app/providers.tsx:5` — donde se monta el provider (root)

**Causa raíz:**
- `loadData()` ejecuta `Promise.all([fetchTournaments(), fetchAllTeams()])` apenas se monta.
- `fetchTournaments()` (`src/lib/db/tournaments.ts:15`) hace un `select` con **7 JOINs anidados**: `tournament_teams`, `tournament_groups`, `playoff_configs`, `matches`, `match_events`, `volleyball_sets`, `sponsors`.
- `fetchAllTeams()` (`src/lib/db/teams.ts:16`) trae **todos los equipos del sistema con todos sus jugadores** (`select("*, players(*)")`).
- Esto bloquea el rendering de cualquier ruta hasta que ambas queries terminen.
- Hay un timeout de 6 segundos; si la DB tarda más, falla en silencio.

**Síntoma usuario:** Click en "Explorar torneo" / "Iniciar sesión" → la página congela mientras el provider termina de cargar datos que el usuario anónimo ni siquiera necesita.

**Sugerencia:**
1. Hacer el provider consciente de auth: para `!isAuthenticated` cargar solo `fetchTournaments()` (sin `fetchAllTeams`).
2. O dividir en dos providers (`PublicTournamentProvider` vs `AuthenticatedProvider`).
3. O lazy-load: marcar `isLoading=true` pero **permitir que el child renderee mientras carga** (no bloquear root).

---

### 🟠 #2 — Filtros de deporte usan `router.replace()` sin `useTransition`

**Impacto:** ALTO. Cada click en un ícono de deporte se siente "freezeado".

**Ubicación:** `src/components/tournaments/tournament-filters.tsx:26-34`

**Causa raíz:**
- `onChange` del Select dispara `router.replace()` directamente.
- React 19 + Next 16: sin `useTransition`, la navegación bloquea el thread principal hasta que termina el re-render del server component.
- Además, cada `router.replace()` requiere que `TournamentContext` esté listo (depende del #1).

**Síntoma usuario:** Tap en un deporte → varios segundos sin feedback → al final aparece el filtro aplicado.

**Sugerencia:**
- Envolver `router.replace(...)` en `startTransition(() => ...)` para que React priorice la interacción.
- Bonus: agregar un `isPending` visual (opacity, spinner) mientras transitiona.

---

### 🔴 #3 — Login dispara `loadData()` doble vía `SIGNED_IN`

**Impacto:** MEDIO-ALTO. "Iniciar sesión" se ve trabado mientras Provider re-carga.

**Ubicación:**
- `src/components/forms/login-form.tsx:43` — `router.push("/dashboard")`
- `src/context/auth-context.tsx:153-176` — listener `onAuthStateChange`
- `src/context/tournament-context.tsx:144-147` — listener que dispara `loadData()` en `SIGNED_IN`
- `src/components/layout/app-shell.tsx:63` — bloquea navegación con LoadingScreen mientras `dataLoading`

**Causa raíz:**
- Al hacer login:
  1. Auth endpoint tarda (red).
  2. `onAuthStateChange` dispara `SIGNED_IN`.
  3. `TournamentProvider` escucha ese evento y vuelve a llamar `loadData()` (¡aunque ya cargó al inicio!).
  4. `AppShell` ve `dataLoading=true` → bloquea con LoadingScreen.
  5. `router.push("/dashboard")` queda esperando.

**Síntoma usuario:** Botón "Iniciar sesión" → ~3-5 segundos sin feedback → recién después aparece el dashboard.

**Sugerencia:**
- Que `TournamentProvider` no dispare `loadData()` en `SIGNED_IN`, solo en mount inicial y `TOKEN_REFRESHED`.
- Usar `useTransition` en el `handleSubmit` del login para feedback visual inmediato.
- `AppShell`: revisar la condición `dataLoading && needsTournamentData && isAuthenticated` — si el dashboard ya tiene sus propios Suspense boundaries, no debería bloquear el root.

---

### 🟠 #4 — `TournamentCard` hace N+1 queries para el organizador

**Impacto:** MEDIO. Lista de torneos en `/tournaments` carga lenta.

**Ubicación:** `src/components/tournaments/tournament-card.tsx:40-54`

**Causa raíz:**
- Cada `<TournamentCard>` tiene un `useEffect` que hace `supabase.from("organization_profiles").select(...).eq("user_id", tournament.createdBy)`.
- Con 20 torneos en pantalla = **20 queries paralelas** contra Supabase. Aunque sean paralelas, suman latencia + consumen pool de conexiones.

**Síntoma usuario:** "Ver torneo" desde la landing → `/tournaments` muestra esqueleto un rato hasta que se llenan los nombres de organizadores.

**Sugerencia:**
1. Pre-cargar el mapping `createdBy → org_name` en el server component que renderiza la lista.
2. O agregar un `JOIN` a `organization_profiles` directamente en `TOURNAMENT_SELECT` (en `src/lib/db/tournaments.ts`).
3. O batch query única en `TournamentList` que carga todos los organizadores y los pasa como prop.

---

### 🟠 #5 — Página de detalle muestra spinner aunque el torneo ya esté en memoria

**Impacto:** MEDIO. "Ver torneo" pinta loader innecesario.

**Ubicación:** `src/app/tournaments/[id]/page.tsx:18-33`

**Causa raíz:**
```tsx
const tournament = getTournamentById(id);
if (!tournament && (dataLoading || authLoading))
  return <Spinner />;
```
- `dataLoading` es **global** (refleja si todos los torneos están cargados, no si **este** torneo está listo).
- Si el usuario ya pasó por `/tournaments` antes, el torneo está en memoria — pero si `dataLoading=true` por cualquier otra razón, igual se ve loader.

**Síntoma usuario:** Click en "Ver torneo" → spinner "Cargando torneo..." aunque el torneo se acaba de ver en la lista.

**Sugerencia:**
- Cambiar la guarda a `if (!tournament) return ...` y solo mostrar spinner si **realmente** no está en memoria.
- Si está en memoria → renderizar el detalle inmediatamente; los datos secundarios pueden refrescarse en background.

---

### 🔴 #6 — `AppShell` bloquea `/tournaments` aunque el usuario sea público

**Impacto:** ALTO. Botón "Explorar torneo" para users no logueados se siente lentísimo.

**Ubicación:** `src/components/layout/app-shell.tsx:58-65`

**Causa raíz:**
```tsx
const needsTournamentData =
  pathname === "/dashboard" ||
  pathname.startsWith("/admin") ||
  (pathname.startsWith("/tournaments") && pathname !== "/tournaments/create");
if (!authLoading && dataLoading && needsTournamentData && isAuthenticated) {
  return <LoadingScreen />;
}
```
- Para usuarios **NO autenticados** este bloque NO bloquea (la condición exige `isAuthenticated`).
- **Pero** el `TournamentProvider` sigue haciendo el `Promise.all` con `fetchAllTeams()` igual (innecesario para anónimos).
- Resultado: el LoadingScreen no aparece, pero la página tarda igual porque el provider está ocupado.

**Síntoma usuario:** "Explorar torneo" en landing → tarda varios segundos porque el provider está cargando equipos que nunca se mostrarán al anónimo.

**Sugerencia:**
- Ya viene resuelto si arreglamos #1 (cargar solo `fetchTournaments()` para anónimos).
- Reforzar acá: tener un fast-path para anónimos en `AppShell` que nunca espere `fetchAllTeams`.

---

## Plan de acción

### Fase 1 — Quick wins (máximo impacto, ~25 min)

Resuelve ~80% del problema percibido.

| # | Fix | Archivo | Esfuerzo |
|---|---|---|---|
| 1 | Provider consciente de auth: para `!isAuthenticated` cargar solo `fetchTournaments()` | `tournament-context.tsx` | 10 min |
| 2 | `useTransition` en filtros de deporte + login + clicks en cards | `tournament-filters.tsx`, `login-form.tsx`, `tournament-card.tsx` | 10 min |
| 3 | Página de detalle: si tournament ya está en memoria, no mostrar spinner | `app/tournaments/[id]/page.tsx` | 5 min |

**Cómo validar:**
- Entrar a la landing en incógnito (anónimo) → debería pintar instantáneo.
- Click en "Explorar torneo" → menos de 500ms para que aparezcan tarjetas.
- Filtros de deporte: clicks responden visualmente al instante (con opacity o spinner durante la transición).

---

### Fase 2 — Calidad de vida (~15 min)

| # | Fix | Archivo | Esfuerzo |
|---|---|---|---|
| 4 | Login no re-dispara `loadData()` en `SIGNED_IN` (ya cargó al mount) | `tournament-context.tsx` | 5 min |
| 5 | `AppShell`: fast-path para anónimos sin gate de data | `app-shell.tsx` | 5 min |

**Cómo validar:**
- Iniciar sesión desde landing → llegar al dashboard en <1s después del login.
- Logout y entrar de nuevo → la landing pinta instantáneo (sin LoadingScreen).

---

### Fase 3 — Optimización profunda (~20 min, opcional)

| # | Fix | Archivo | Esfuerzo |
|---|---|---|---|
| 6 | N+1 de `TournamentCard`: JOIN con `organization_profiles` en `TOURNAMENT_SELECT` | `tournaments.ts`, `tournament-card.tsx` | 15 min |
| 7 | Dividir Provider en `PublicTournamentProvider` + `AuthenticatedProvider` (refactor mayor) | varios | 30+ min |

**Cómo validar:**
- Network panel: la página `/tournaments` con 20 torneos debería tener **1 query** principal en vez de 1 + 20.
- Tiempo total de carga inicial debería bajar 30-50%.

---

## Trade-offs a considerar

- **Cargar menos datos para anónimos** → si el anónimo después se loguea, hay que recargar `fetchAllTeams()`. Es aceptable porque el login ya implica una transición.
- **`useTransition`** → no acelera la navegación, pero hace que el UI **se sienta** instantáneo. Es psicológicamente importante.
- **JOIN con `organization_profiles`** → agrega complejidad al query principal. Si en el futuro la tabla crece mucho, podría volverse contraproducente; pero para los volúmenes actuales es la mejor opción.
- **No re-disparar `loadData()` en `SIGNED_IN`** → asume que la data inicial es suficiente para el dashboard. Si hay datos que solo el usuario logueado puede ver (filas con RLS), habría que refetch ese subset específico, no todo.

---

## Cómo medir antes/después

1. **DevTools → Performance** (Chrome): grabar desde landing → click "Explorar" → ver tarjetas. Medir "Total Blocking Time" y "Time to Interactive".
2. **Network panel**: contar requests + tamaño total al cargar landing y `/tournaments`.
3. **Test manual:** abrir incógnito, navegar landing → tournaments → detalle → click organizador. Cronometrar la sensación.

Métricas objetivo después de Fase 1:
- Landing FCP: <1s
- `/tournaments` (anónimo): <1.5s para ver tarjetas
- "Ver torneo": navegación instantánea (<300ms desde click hasta detalle visible)
