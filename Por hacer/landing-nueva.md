# Plan: migrar la landing y los torneos al diseño nuevo

> **Estado verificado contra el código el 6 de agosto de 2026.** Escrito el 30 de julio.
>
> **Casi todo está hecho y commiteado** (commits `a8054f1` → `48bdd58`). Lo
> que sigue abierto es la Etapa 8 a medias y el material de fotos.
>
> | Etapa | Estado |
> |---|---|
> | 0 — Assets | 🟡 logo en `public/logo/` y 5 fotos de hero en `public/hero/` ✅. Faltan las **fotos de las tarjetas** (`public/sports/` está vacío, ver `fotos-de-tarjetas.md`) y la tipografía display |
> | 1 — Tema + modo oscuro | ✅ hecho y commiteado (`a8054f1`) |
> | 2 — Header y footer | ✅ hecho (`c5ec759`), + menú hamburguesa que no estaba previsto |
> | 3 — Imágenes por deporte | ✅ la mecánica está (`src/data/sport-images.ts`); las fotos son la Etapa 0 |
> | 3b — Hero rotativo | ✅ hecho — `hero-carousel.tsx`, 5 fotos |
> | 4 — Tarjeta de torneo | ✅ hecho, incluida la consulta única de organizadores (`useOrganizers`) |
> | 5 — Torneo destacado | ✅ hecho y migración corrida; API admin + trigger verificados |
> | Extra — foto elegible por el organizador | ✅ código hecho y migración corrida; falta el material |
> | 6 — La landing | ✅ hecho (`bc66782`) |
> | 7 — Alinear `/tournaments` | ✅ hecho |
> | 8 — Pantalla del torneo | 🟡 **lo único que falta de código.** Encabezado, migas de pan y tablas: ✅ (`48bdd58`). Faltan: medallas en los puestos 1-2-3, pestañas con subrayado dorado (hoy usan el `after:bg-foreground` de shadcn), tarjeta "La competencia continúa" y restilar patrocinadores |
>
> Ya no aplica el aviso de "sin commit": todo está en `main`. Las dos
> migraciones (`20260731_tournament_featured.sql` y
> `20260731b_tournament_card_image.sql`) están corridas en producción.

## Contexto

Hay tres mockups en el escritorio (`Nuevo diseño landing.png`, `nuevo diseño landing dark.png` y `pantalla torneos.png`) que definen una identidad nueva para Torneos Pro: azul marino + dorado sobre blanco, con detalles en negro, y una versión oscura completa. El diseño reemplaza la landing actual (hero con video, grilla de deportes, features, precios) por una portada orientada a descubrir torneos: hero con foto, barra de búsqueda y filtros, torneo destacado, grilla de torneos con foto, y una franja de valores. El tercer mockup rediseña la pantalla de un torneo: encabezado con foto y escudo, patrocinadores, y la tabla de posiciones.

La landing de hoy (`src/app/page.tsx`) es estática: no muestra un solo torneo real. El diseño nuevo la convierte en la vitrina del producto, que es lo que un visitante que llega por un link de WhatsApp espera ver.

> Los tres mockups viven en el escritorio, fuera del repo. Conviene copiarlos a `Por hacer/mockups/` para que queden versionados junto a este plan y no se pierdan.

**Decisiones ya tomadas con el organizador:**
- El rebranding va a **toda la app**, no solo a la landing.
- **Modo oscuro siguiendo la configuración del teléfono** (mockup dark).
- Las fotos de las tarjetas son **una por deporte** (set fijo), no subidas por torneo.
- El **torneo destacado lo marca el admin a mano** (columna nueva en la base).
- El menú **no** incorpora Equipos / Calendario / Rankings / Recursos: queda con Torneos y Precios.

---

## Etapa 0 — Assets (bloquea las etapas 1, 2 y 3)

Nada de esto está en el repo todavía y no lo puedo generar yo:

| Asset | Para qué | Dónde va |
|---|---|---|
| ~7 fotos de hero, una por deporte fuerte | Carrusel del hero | `public/hero/<key>.jpg` |
| 3-4 fotos horizontales por deporte | Fondo de cada tarjeta | `public/sports/<key>-1.jpg`, `-2.jpg`, … |
| Logo "TORNEOS PRO" con trofeo, versión clara y oscura | Header | `public/logo/` |
| Tipografía display (la condensada itálica del logo y el título) | Hero + logo | `next/font` |

Los deportes son los 11 de `src/data/sports.ts`: futbol, futsal, microfutbol, beisbol, softball, wiffleball, volleyball, basketball, padel, ping-pong, tenis.

**Por qué 3-4 fotos por deporte y no una.** Hoy **la mitad de los torneos son de volleyball** (10 de 21; después vienen béisbol 4, fútbol 3, softball 3, microfútbol 1). Con una sola foto por deporte, la portada mostraría 6 tarjetas y hasta 5 con la imagen idéntica repetida — se lee como un error de carga, no como un diseño. Es justo lo que se ve en el mockup oscuro, donde la segunda fila son 6 tarjetas de béisbol clonadas.

No hacen falta las ~33 de entrada: con 3-4 para volleyball, béisbol y fútbol ya quedan cubiertos 17 de los 21 torneos. Los deportes con un solo torneo pueden arrancar con una foto y crecer después.

**Requisitos de las fotos:**
- **Horizontales y sin texto ni logos**: encima va un degradado oscuro con el nombre del torneo y el organizador, y cualquier marca de agua choca.
- **Genéricas** (una jugada, un estadio), no de un equipo o una persona reconocible de Sincelejo: la misma foto aparece en torneos de otros organizadores, y quien sale puede no tener nada que ver.
- Las del **hero**, además, con la acción hacia la derecha (como el voleibolista del mockup): la mitad izquierda la ocupa el título. Y con un tratamiento de color parejo entre todas, si no cada cambio del carrusel se siente como un salto.

**Mientras no lleguen:** arranco con placeholders (degradado azul→dorado por deporte, derivado del color que ya existe en `sportColors` de `tournament-card.tsx`) y la fuente `Geist` actual. Todo lo demás avanza igual; cambiar el placeholder por la foto real después es reemplazar archivos.

---

## Etapa 1 — Tema: tokens de color + modo oscuro

**`src/app/globals.css`** — reescribir los bloques `:root` y `.dark` con la paleta nueva (azul marino, dorado, blanco, negro) en el mismo formato oklch que ya usan. Los tokens siguen siendo los de shadcn (`--primary`, `--background`, `--card`, …), así que toda la app se repinta sin tocar componente por componente.

- Claro: fondo blanco hueso, `--foreground` azul marino, `--primary` dorado, bordes suaves.
- Oscuro: fondo azul marino casi negro, texto blanco, `--primary` dorado (el mismo hue, más luminoso para contraste).
- El verde del chip "En Curso" y el resto de `statusColors` se ajustan aparte (ver Etapa 4).

**`src/app/providers.tsx`** — hoy **no hay ThemeProvider**, por eso el bloque `.dark` que ya existe en el CSS nunca se activa. Agregar `ThemeProvider` de `next-themes` (ya está en `package.json`, lo usa `components/ui/sonner.tsx`) con `attribute="class"` y `defaultTheme="system"`: eso hace que el teléfono en modo oscuro vea la versión oscura automáticamente, sin switch manual.

**`src/app/layout.tsx`** — el `viewport.themeColor` ya tiene variantes por `prefers-color-scheme`; actualizar los dos hex a los colores nuevos. Agregar la fuente display junto a `Geist`/`Geist_Mono`.

**Repaso de colores claros hardcodeados.** Son solo 7 en todo el repo (`grep "bg-white\|text-black\|bg-zinc-50"`), la app está bien tokenizada:
- `src/app/page.tsx:37` — desaparece con la landing nueva.
- `src/components/tournaments/tournament-card.tsx:22` y `tournament-detail.tsx:87` — `bg-zinc-500/10` del estado "Completado", hay que darle variante oscura.
- `admin/ads/page.tsx` (×2), `components/ads/ad-modal.tsx`, `analytics/sponsor-clicks-panel.tsx` — cajas blancas **a propósito** detrás de logos de patrocinadores. **Se quedan como están**: un logo con fondo transparente sobre superficie oscura se ve roto.

---

## Etapa 2 — Header y footer

**`src/components/layout/header.tsx`** — logo en imagen (hoy es texto plano "Torneos Pro"), nav con Torneos y Precios, ícono de búsqueda que lleva a `/tournaments`, "Iniciar Sesión" en texto y "Registrarse" en botón dorado. Mantener intacta la rama `isAuthenticated` que renderiza `<UserNav />`.

**`src/components/layout/mobile-nav.tsx`** y **`footer.tsx`** — alinear a la paleta nueva.

---

## Etapa 3 — Imágenes por deporte

**Nuevo `src/data/sport-images.ts`** — mapa `sport key → lista de fotos`, con fallback al degradado si falta el archivo. Un solo lugar para cambiar o sumar fotos después. Se usa junto a `getSportInfo()` de `src/data/sports.ts`, que ya da label y emoji.

**Cómo se elige cuál de las 3-4 le toca a cada torneo.** De forma determinística por el id del torneo, no al azar: el mismo torneo muestra siempre la misma foto (si no, cambiaría en cada recarga y rompería el reconocimiento), y dos torneos vecinos del mismo deporte casi nunca coinciden. Es exactamente el patrón que ya usa `buildTournamentColorMap()` en `src/lib/tournament-colors.ts` para asignarle un color estable a cada torneo en la agenda del dashboard — conviene copiarle la forma, incluido el comentario de por qué tiene que ser estable.

---

## Etapa 3b — Hero rotativo

El hero no muestra una sola foto fija: **va pasando entre deportes**, igual que hoy pero con fotos en lugar de videos.

**`src/components/landing/video-background.tsx`** ya resuelve toda esa mecánica y está probada: baraja la lista, cruza con fundido cada 7,2 segundos, usa dos elementos superpuestos para que el cambio no parpadee, y no arranca si el usuario pidió reducir animaciones. Se adapta ese mismo componente a `<img>` (o se escribe uno hermano, `hero-carousel.tsx`, y se deja el de video sin usar).

Lo que mejora al pasar de video a foto:

- **Peso.** Los 7 clips de `public/videos/` suman 33 MB, ~5 MB cada uno. Siete fotos bien comprimidas no llegan a 1 MB. Por eso hoy el carrusel **está apagado en celular** (`video-background.tsx`, chequeo de `max-width: 768px`): no se podía costear en 4G. Con fotos se puede dejar prendido en todos lados.
- **La primera imagen deja de hacerse esperar.** Hoy el código espera 1,5 s antes de bajar el primer video para no trabar el render (`VIDEO_LOAD_DELAY`). Con foto, la primera va en el HTML del servidor y aparece de una; la rotación arranca después, sin que se note.

Se conserva del original: el barajado (así no siempre entra volleyball primero) y el respeto por `prefers-reduced-motion`, que deja la primera foto quieta.

---

## Etapa 4 — Tarjeta de torneo nueva

**`src/components/tournaments/tournament-card.tsx`** — rediseño: foto del deporte de fondo con degradado encima, chip del deporte y chip de estado arriba, nombre, ubicación y organizador, y "Ver Torneo" abajo. Se conserva la lógica que ya funciona: `getSportInfo`, `getDepartmentLabel`/`getMunicipalityLabel` de `src/data/colombia.ts`, y el manejo de `scope === "nacional"`.

**Corregir de paso:** hoy **cada tarjeta dispara su propia consulta a Supabase** para traer el nombre del organizador (`useEffect` → `organization_profiles`, líneas 68-82). Con 6 tarjetas son 6 viajes a la base; con las 12 del mockup oscuro, 12. Mover ese fetch a una sola consulta por lote en el componente padre (`tournament-list.tsx`) y pasar el organizador por props. Es la diferencia entre una landing que entra de una y una que va apareciendo de a pedazos.

**`src/components/tournaments/tournament-list.tsx`** — grilla de hasta 6 columnas (hoy son 3) y el fetch por lote de organizadores.

---

## Etapa 5 — Torneo destacado

No existe el concepto en la base. Hace falta:

**1. Migración SQL** — escrita como `supabase/migrations/20260731_tournament_featured.sql`. La escribo yo, la corre el organizador en el panel de Supabase, y recién después se despliega el código.

Además de la columna y el índice previstos, lleva un **trigger** que no estaba en el plan original. El motivo apareció al leer `schema.sql`:

```sql
CREATE POLICY "Creador edita torneo"
  ON tournaments FOR ALL USING (created_by = auth.uid());
```

Cada organizador ya puede hacer UPDATE de su propio torneo desde el navegador. Con solo agregar la columna, cualquiera se destacaba en la portada desde la consola del browser — lo contrario de la decisión de que lo marca el admin. `guard_tournament_featured()` bloquea los cambios a `featured` salvo admin o service_role; el resto de las columnas sigue igual.

Por lo mismo, el interruptor del admin **no** escribe por el cliente de Supabase: va por `/api/admin/tournaments/[id]/featured` con `requireAdmin` + service role, como "Avanzar" y "Eliminar". Un admin no puede editar el torneo de otro organizador desde el navegador, porque esa policy solo cubre los propios.

**2. Modelo** — `featured?: boolean` en `Tournament` (`src/types/index.ts`), leerlo en `mapTournament` (`src/lib/db/mappers.ts`) y agregarlo a `TOURNAMENT_LIST_SELECT` (`src/lib/db/tournaments.ts`).

**3. Control del admin** — un interruptor "Destacar en la portada" dentro de `src/components/tournaments/admin-actions.tsx`, que ya se renderiza solo para admins en el detalle del torneo (`tournament-detail.tsx:842`) y ya tiene el patrón de acción + `refetch()`. No hace falta una pantalla nueva en `/admin`.

**4. Carrusel** — nuevo `src/components/landing/featured-tournament.tsx`: foto a la izquierda, y a la derecha chips, nombre, fase, metadatos (equipos con `teamIds.length`, `startDate`, ubicación) y el botón dorado. Si el admin marca varios, el carrusel rota entre ellos con las flechas. Si no hay ninguno marcado, la sección **no se renderiza** (la landing no puede depender de que alguien se acuerde de marcar uno).

---

## Etapa 6 — La landing

**`src/app/page.tsx`** reescrita con las secciones del mockup: hero con foto, barra de búsqueda + filtros, torneo destacado, "Todos los torneos", franja COMPITE / CONECTA / CRECE / DISFRUTA.

**Datos.** Sigue siendo Server Component. Traer los torneos en el servidor con `revalidate = 60`, el mismo patrón ya probado en `src/app/tournaments/[id]/page.tsx` (y su explicación de por qué 60s). Así la portada llega con los torneos ya en el HTML: bueno para SEO y para el que abre el link en 4G.

**La barra de filtros** de la landing no filtra en el lugar: navega a `/tournaments?sport=…&status=…` reutilizando los mismos parámetros que ya entiende `TournamentFilters`. Un componente cliente chico, sin duplicar la lógica.

**Qué desaparece de la landing:**
- El **carrusel de video** (`VideoBackground`): lo reemplaza el carrusel de fotos de la Etapa 3b, que hereda su lógica. Los ~33 MB de `public/videos/` se pueden borrar en una limpieza aparte.
- La **grilla de deportes**: su función la cumple el filtro "Todos los deportes".
- La sección **"Todo lo que necesitas"**: la reemplaza la franja de valores.
- El bloque **"Planes y Precios"**: el mockup no lo tiene. Los precios siguen vivos en `/pricing`, enlazado desde el menú. Vale la pena que lo confirmes con el negocio — hoy es lo único que le dice a un organizador nuevo cuánto cuesta, sin tener que hacer clic.

---

## Etapa 7 — Alinear `/tournaments`

`src/app/tournaments/page.tsx` hereda la tarjeta y los tokens nuevos casi gratis. Falta rediseñar la barra de `tournament-filters.tsx` para que se vea como la del mockup (pastilla ancha con la lupa adentro), conservando el `useTransition` y el modal de filtros en mobile que ya están resueltos.

---

## Etapa 8 — La pantalla del torneo (`pantalla torneos.png`)

Es la pantalla más delicada de las tres: `src/components/tournaments/tournament-detail.tsx` tiene **89 KB** y concentra la lógica de fases, playoffs, permisos y edición. El trabajo acá es **de piel, no de tripas**: se rediseña el encabezado y se restilan las tablas, sin tocar la lógica.

**Encabezado nuevo.** Banda con la foto del deporte a la derecha en degradado, y a la izquierda:
- **Escudo** en tarjeta blanca. Sale del logo del organizador (`organizationProfile.logoUrl`, ya existe en `mapOrganizationProfile`); si el organizador no cargó logo, cae al emoji del deporte sobre el color que ya define `sportColors`.
- **Chips**: deporte, formato, estado y ubicación. El "Fase de Grupos + Playoffs" del mockup se arma con `format` y `phaseConfigs`, que ya están en el modelo.
- **Metadatos**: equipos (`teamIds.length`) y fecha de inicio (`startDate`) salen directo.

  ⚠️ **"Modalidad: Masculino" no existe como campo.** En los datos reales eso vive dentro del nombre del torneo ("Masculino Aprendiz 2.0"). Propongo poner el **organizador** en ese lugar, con link a su perfil público — es información que sí tenemos y le sirve más al visitante. Si se quiere la modalidad de verdad, es una columna nueva más su selector al crear el torneo.

**Migas de pan** (Inicio › Torneos › Volleyball › nombre). No hay componente de breadcrumb en `src/components/ui/`; es uno chico y nuevo.

**Patrocinadores oficiales.** Ya existe `src/components/sponsors/sponsor-banner.tsx`, montado en `tournament-detail.tsx:975`. Restilarlo como el carrusel del mockup, con las cajas blancas de los logos **intactas** (ver Etapa 1).

**Pestañas.** El mockup dibuja seis fijas. Las reales son dinámicas: se arman por fase, y aparecen o no según `visibleTabs` y si el usuario puede editar (`tournament-detail.tsx:1018-1036`). **Se conserva esa lógica tal cual**; solo cambia el estilo a la pestaña activa subrayada en dorado con ícono.

**Tablas de posiciones.** Son cuatro, una por familia de deporte: `standings-table.tsx`, `volleyball-standings-table.tsx`, `baseball-standings-table.tsx` y `basketball-standings-table.tsx`. A las cuatro: puestos 1-2-3 con medalla (oro/plata/bronce), columna de puntos en dorado, filas alternadas y el escudo del equipo (`Team.logoUrl`, ya existe). Ojo con `table-watermark.tsx`, que superpone la marca de agua y hay que revisar cómo queda en oscuro.

**Tarjeta lateral "La competencia continúa"** con el botón "Ver calendario de partidos": componente nuevo y chico, que cambia a la pestaña Calendario. Solo tiene sentido en torneos en curso; en uno completado debería mostrar al campeón, que ya existe como `tournament-champion-viewer-modal.tsx` y `championPhotoUrl`.

---

## Verificación

1. `npm run dev` y revisar la landing **como visitante anónimo**. Ojo: `AppShell` redirige a `/dashboard` a todo usuario logueado que entra a `/` (`app-shell.tsx:42`), así que la landing nueva **solo la ven los anónimos** — hay que probarla en ventana privada o cerrando sesión.
2. Cambiar macOS a Apariencia oscura y recargar: la landing debe pasar sola a la versión oscura del mockup, sin tocar nada en la app.
3. Con el modo oscuro activo, recorrer el resto de la app, que hasta ahora nunca se vio en oscuro: dashboard, detalle de torneo, brackets, tabla de posiciones, `/admin/ads`, `/admin/finances`. Es el mayor riesgo del cambio y hay que verlo pantalla por pantalla.
4. Correr la migración en Supabase, marcar un torneo como destacado desde el detalle con la cuenta admin, y confirmar que aparece en la portada y que al desmarcarlo desaparece.
5. Verificar que la barra de filtros de la landing cae en `/tournaments` con los filtros aplicados.
6. Abrir un torneo real y comprobar que el rediseño no rompió nada de la lógica: las pestañas por fase, playoffs, la vista del organizador con permiso de edición vs la del visitante anónimo, y las cuatro tablas de posiciones (usar un torneo de voleibol, uno de béisbol, uno de básquet y uno de fútbol).
7. `npm run build` y `npm run lint` sin errores.
8. Los PDF de estadísticas (`src/lib/stats-pdf.ts`) y las imágenes de OpenGraph (`src/lib/og/`) generan sus colores por su cuenta, fuera del CSS: siguen saliendo claros y eso está bien, pero conviene mirar uno de cada uno después del rebranding.

---

## Orden sugerido

Las etapas están ordenadas por dependencia, no por importancia. El camino más corto a algo mirable es **1 → 3 → 4 → 6** (tema, fotos, tarjeta, landing): con eso la portada ya se ve como el mockup. La 3b (hero rotativo) puede entrar en cualquier momento después de la 6, con una foto fija mientras tanto. La 5 (destacado) necesita que el organizador corra la migración antes. La 8 (pantalla del torneo) es independiente y se puede hacer en cualquier momento después de la 1.

## Decisiones pendientes

- **Precios fuera de la portada** (Etapa 6): confirmar con el negocio.
- **"Modalidad"** en la pantalla del torneo (Etapa 8): reemplazar por el organizador, o crear el campo de verdad.
- **Assets** (Etapa 0): quién genera las fotos, el logo y de dónde sale la tipografía.
- **Orden del hero** (Etapa 3b): barajado como hoy, o el voleibolista del mockup siempre primero y el resto rotando detrás. Es una línea de código, se decide al verlo.
