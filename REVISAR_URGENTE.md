# 🚨 REVISAR URGENTE — Review CTO del MVP

> Generado el 2026-05-03 por el CTO virtual.
> **No mostrar TorneosPro a un organizador real hasta resolver los items 🔴.**

---

## TL;DR

- El MVP funciona y el flujo principal cierra bien (crear torneo → equipos → jornadas → resultados → tabla). Walkover por descalificación y desempate H2H están bien pensados.
- **12 problemas críticos**, casi todos en el RLS de Supabase.
- Riesgo real hoy: cualquier user con DevTools puede crear torneos premium gratis, aprobarse pagos, manipular cupones de otros y reescribir analíticas.

---

## 🔴 CRÍTICOS (fix antes de soft-launch)

### 1. `is_admin()` no existe pero se usa en policies
**Archivo:** `supabase/schema.sql:525, 529, 533`
La función se referencia en las policies de `coupons` pero nunca se define. Las policies fallan al ejecutarse → nadie puede crear/editar/eliminar cupones desde el admin.
**Fix:**
```sql
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS
$$ SELECT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin') $$;
```

### 2. RLS de `users` con recursión infinita
**Archivo:** `supabase/schema.sql:389-393` y `:450-454`
La policy "Admin ve todos los usuarios" hace `EXISTS (SELECT 1 FROM users …)` sobre la propia tabla `users` con RLS habilitado → "infinite recursion detected in policy". `getAllUsers()` (`auth-context.tsx:324`) directamente no funciona en prod.
**Fix:** usar `is_admin()` (security definer) en lugar de subquery sobre `users`.

### 3. El cliente decide `tier` y `price` del torneo
**Archivos:** `src/components/forms/create-tournament-form.tsx:342-343`, `mappers.ts:234-235`
El front manda `price` y `tier` directo al insert con anon key. La policy de tournaments (`schema.sql:410-412`) usa `FOR ALL USING (created_by = auth.uid())` **sin `WITH CHECK`**. Resultado: un user puede crear `tier: 'premium'` desde la consola sin pagar, o subirse el tier con un UPDATE.
**Fix:** mover creación de torneo pago al webhook (siempre, no solo recovery), o crear el torneo en una API route server-side que valide `tier vs teamCount` y `created_by = auth.uid()`.

### 4. Cualquier user puede aprobarse pagos
**Archivo:** `supabase/schema.sql:588-591` + `src/components/forms/create-tournament-form.tsx:362-369`
La policy "Usuario actualiza su pago" deja al cliente hacer `update payments set status='approved'`. Combinado con #3, podés crear torneo premium gratis y aprobarte el pago vos mismo.
**Fix:** eliminar esa policy. Solo el webhook (con service role) debe tocar `payments`.

### 5. Policies INSERT usan `USING` en vez de `WITH CHECK`
**Archivo:** `supabase/schema.sql:524, 609`
Postgres ignora `USING` en INSERT — solo `WITH CHECK` aplica. Las restricciones no están activas: cualquier authenticated user puede insertar en `coupons` y crear cupones a voluntad.
**Fix:** cambiar `USING` por `WITH CHECK` en todas las policies INSERT.

### 6. Cualquier user puede crear torneos a nombre de otro
**Archivo:** `supabase/schema.sql:410-412`
Falta `WITH CHECK` en la policy de tournaments. Sin esa cláusula, podés insertar un torneo con `created_by = <id de otro user>` y "regalárselo", o transferirte uno tuyo. El mismo bug en cascada está en `matches`, `match_events`, `volleyball_sets`, `organization_profiles`, `social_links`, `sponsors`.
**Fix:** `FOR ALL USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid())` en todas.

### 7. Cualquier user puede modificar `is_active` y `role`
**Archivo:** `supabase/schema.sql:450-454`
Sin `WITH CHECK` en la policy de admin de users, una vez arreglado el bug #2, un user podría auto-promocionarse a admin con un UPDATE directo.
**Fix:** `WITH CHECK (is_admin())` en la policy de admin.

### 8. RLS de `coupons` permite usar/transferir cupones de otros
**Archivo:** `supabase/schema.sql:537-542`
La policy "Usuario usa cupon" (`FOR UPDATE`) **sin `WITH CHECK`** permite reclamar un cupón seteando `used_by = <id de otro user>`, o cambiar `value`/`type` en cupones propios ya usados.
**Fix:** `WITH CHECK (used_by = auth.uid())` y mover el claim al webhook.

### 9. Cupón se pre-reclama antes del pago
**Archivo:** `src/components/forms/create-tournament-form.tsx:237-255`
Si el user abandona Wompi (cierra widget, falla red), el cupón queda quemado y nadie lo libera.
**Fix:** reclamar el cupón en el webhook al aprobarse el pago. Solo validar disponibilidad (`used_by IS NULL`) en `create-reference`.

### 10. Webhook Wompi: `tier` no se valida
**Archivo:** `src/app/api/payments/webhook/route.ts:170-191` + `create-reference/route.ts:8`
`tournament_data` viene del cliente sin validación. El amount sí se valida con la `integrity_signature` de Wompi (correcto), pero `tier` no. Alguien puede mandar `amountCop: 40000, tier: 'premium', teamCount: 50`.
**Fix:** en `create-reference`, recalcular `amountCop` desde `getTournamentPriceInfo(teamCount)`. Ignorar el monto del cliente.

### 11. `page_views` UPDATE permite a cualquiera reescribir métricas ajenas
**Archivo:** `supabase/schema.sql:650-653`
`FOR UPDATE USING (true) WITH CHECK (true)`. Cualquier visitante anónimo puede `UPDATE page_views SET duration_ms = -999999, page_path = '...'` masivamente.
**Fix:** scope al `session_id` reciente o mover el update a una RPC con `SECURITY DEFINER`.

### 12. `usePageView` nunca asigna `viewIdRef` → `duration_ms` siempre 0
**Archivo:** `src/hooks/use-page-view.ts:60`
El insert no hace `.select("id")` y no setea el ref. La métrica "Duración promedio" del dashboard de organizador está rota desde el día 1.
**Fix:**
```ts
const { data } = await supabase.from("page_views").insert({...}).select("id").single();
if (data) viewIdRef.current = data.id;
```

---

## 🟡 IMPORTANTES (próximas semanas)

### 13. N+1 grave en creación de bracket / matches
**Archivos:** `src/lib/db/matches.ts:28-41`, `src/lib/db/tournaments.ts:222-236`
Inserts secuenciales con `await`. Torneo de 24 equipos = 60+ round-trips, 5-10s percibidos.
**Fix:** insertar en bulk (`.insert([...])`) y un segundo pass para resolver `next_match_id`.

### 14. Race condition en `updateMatchResult`
**Archivo:** `src/lib/db/matches.ts:78-110`
`delete` + `insert` sin transacción. Si dos asistentes editan el mismo partido, el último gana. Si la red corta entre delete e insert, los events se pierden sin rollback.
**Fix:** RPC que haga el reemplazo atómico o `upsert` con `id` estable.

### 15. `removeTeamFromTournament` borra resultados ya cargados
**Archivo:** `src/lib/db/tournaments.ts:158-162`
Si el organizador "quita equipo" después de cargar resultados, se borran silenciosamente (CASCADE). Destrucción irrecuperable.
**Fix:** si el team tiene matches `completed`, requerir confirmación explícita o forzar el path de "descalificar" (que ya existe).

### 16. `fetchTournaments()` trae todo en una query gigante
**Archivo:** `src/lib/db/tournaments.ts:5-12`
Trae todos los torneos con todos sus matches/events/sets/sponsors/groups. `TournamentProvider` lo carga en cada login y en cada mutation. Con 50 organizadores se vuelve doloroso.
**Fix MVP:** filtrar `eq("created_by", user.id)` para el dashboard. Estructural: separar listado de detalle.

### 17. RLS público expone datos sensibles de menores
**Archivo:** `supabase/schema.sql:325-377`
Listado público (`/tournaments`) trae `players` con `birth_date`, `document_number`, `eps`. Riesgo legal con datos de menores.
**Fix:** `is_public BOOLEAN` por torneo. Para `players`, no exponer `document_number`/`eps`/`birth_date` públicamente — separar en una vista.

### 18. Sin validación de longitudes de strings
Schema entero. `name TEXT NOT NULL` sin límite — un user puede meter 100MB.
**Fix:** `CHECK (length(name) <= 200)` etc.

### 19. Bracket fill propaga `winner_id` desde el cliente
**Archivos:** `tournament-context.tsx:600-630`, mappers, helpers
La UI calcula y guarda `winnerId`. Sin transacción backend, dos clientes simultáneos pueden dejar `nextMatch.homeTeamId` apuntando a un equipo que no jugó esa ronda.
**Fix mínimo:** trigger en BD que recalcule `winner_id` cuando se completa un match.

### 20. `safetyTimer` de 4s/6s oculta bugs reales
**Archivos:** `auth-context.tsx:141-143`, `tournament-context.tsx:95-97`
Timeout silencioso muestra UI vacía como si el user no tuviera datos → tickets de "perdí mi torneo".
**Fix:** distinguir "loading" de "error" y mostrar retry.

### 21. `setTimeout(500)` innecesario en cost dialog
**Archivo:** `src/components/forms/tournament-cost-dialog.tsx:130`
Probablemente para "sentir" que algo procesó. Sacalo.

---

## 🟢 Deuda aceptable

- Sin tests — OK para MVP, pero al menos cubrir `use-standings.ts` y bracket fill (lógica con bugs sutiles).
- `group_stage_complete` flag manual — sirve para cerrar manualmente con reprogramaciones.

---

## Producto / MVP

### Sobra para esta etapa
- **Módulo entero de analíticas con device/browser breakdown.** Para 0 ARR, es PostHog-lite over-engineered. El bug del `viewIdRef` (#12) está hace tiempo y nadie se enteró → no se usa. Sacaría hasta llegar a 50 paying. Plausible o Vercel Analytics alcanza.
- **11 deportes en el enum.** Apuesta: 95% es fútbol/futsal. Cada deporte = código de stats, scoresheet, RLS. Recortá a fútbol+volley el primer año.
- **Multi-fase grupos+playoffs (`hasPhase2`).** 200 líneas de UI y mucha lógica. Si <5% de organizadores reales lo usa, sacalo.
- **`disqualifiedTeamIds` como TEXT[]** — funciona pero se complica al agregar "razón" o "fecha". Migrar a tabla cuando sea necesario.

### Falta crítico
- **Path para que jugador/equipo VEA su torneo.** Hoy es 100% para el organizador, pero el viral loop B2B2C es el lado del jugador (link de invitación, ver próximo partido, notificaciones). Sin eso, organizadores no recomiendan.
- **Export PDF/imagen del fixture o tabla.** Lo PRIMERO que un organizador comparte en WhatsApp. Killer feature de marketing.
- **Rate limiting en API routes.** `create-reference` puede ser spammed. Upstash Redis o `unstable_after` con limit en memoria.
- **Email confirmation visible.** `register` devuelve `needsEmailConfirmation: true` pero el flujo no chequea si confirmó. Si Supabase no lo tiene activo, cualquiera registra con email ajeno.
- **Auditoría de quién cambió qué.** Cuando un organizador disputa "yo no descalifiqué a ese equipo", no hay log.

---

## Próximo paso concreto

**Una sola migración SQL que arregle todo el RLS** — antes de mostrar a un organizador real.

Orden:
1. Definir `is_admin()` SECURITY DEFINER (#1).
2. Reemplazar policies de `users` para usar `is_admin()` (#2).
3. Agregar `WITH CHECK` a TODAS las policies `FOR ALL` / `UPDATE` / `INSERT` (#5, #6, #7, #8).
4. Mover creación de torneos pagos al webhook (#3) y validar `amountCop` server-side desde `teamCount` (#10).
5. Quitar la policy UPDATE en `payments` para users (#4).

**Una tarde de trabajo.** Sin esto, el modelo de pricing es romper-able en 30 segundos con DevTools.

---

## Archivos a tocar

- `supabase/schema.sql` (todo el RLS)
- `src/app/api/payments/create-reference/route.ts` (validar tier server-side)
- `src/app/api/payments/webhook/route.ts` (mover creación normal acá, no solo recovery)
- `src/components/forms/create-tournament-form.tsx:351-369` (eliminar `update payments`, mover creación)
- `src/hooks/use-page-view.ts:42-50` (asignar `viewIdRef`)
