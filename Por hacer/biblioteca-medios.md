# Plan: biblioteca de medios + compresión automática

**Estado:** planeación. No implementado todavía.
**Fecha:** 2026-06-13

## Contexto

Hoy el organizador sube imágenes (sponsors, logo de organización, futuros
logos de equipo) **una y otra vez** para cada torneo. Si tiene 10 torneos
con los mismos 6 sponsors, son 60 archivos en Storage (uno por torneo). El
mismo Club Atlético jugando en 5 torneos suyos requeriría re-subir su logo
5 veces si lo agregáramos hoy.

**Objetivos:**

1. **Reutilización:** una imagen subida una vez sirve para todos los torneos
   del organizador.
2. **Compresión automática:** al subir, el cliente comprime + convierte a
   WebP antes de enviar. El organizador no tiene que saber nada.
3. **Maximizar el plan free de Supabase Storage** (1 GB + 5 GB egress/mes).
4. **UX limpia:** modal con thumbnails de "tus imágenes" + tab para subir
   una nueva.

## Análisis de costo

Organizador "típico" para el cálculo: 10 torneos, 6 sponsors recurrentes,
50 equipos únicos rotando entre torneos (cada uno aparece en ~3 torneos
en promedio), 1 logo de organización, 5 fotos de campeón.

| Estrategia | Archivos totales | Tamaño/archivo | MB por organizador | Organizadores en 1 GB |
|---|---|---|---|---|
| **Hoy** (sin biblioteca, sin compresión) | ~216 (duplicados) | ~200 KB | ~45 MB | **~22** |
| Solo biblioteca (sin compresión) | 62 (únicos) | ~200 KB | ~12 MB | ~85 |
| **Biblioteca + compresión WebP** | 62 (únicos) | ~30 KB | ~2 MB | **~465** |

**~21× mejora** sobre el estado actual. La compresión sola da ~5×, la
biblioteca sola ~4×, juntas son multiplicativas.

### Egress (descargas) — el cuello real

5 GB/mes de descarga free. Cada visitante de un torneo ve ~10 logos
(equipos de su grupo + sponsors).

- Hoy: 10 logos × 200 KB = 2 MB/visita → 2.500 visitas/mes antes de pagar.
- Con compresión: 10 logos × 30 KB = 300 KB/visita → **~17.000 visitas/mes**.

La compresión también soluciona el egress, no solo el storage.

## Arquitectura propuesta

### Nuevo schema

```sql
CREATE TABLE media_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,             -- URL pública en Storage
  storage_path TEXT NOT NULL,    -- path interno (para poder borrar archivo real)
  kind TEXT NOT NULL,            -- 'team_logo' | 'sponsor' | 'org_logo' (extensible)
  label TEXT,                    -- opcional: "Club Atlético", "Coca-Cola"
  width INT,
  height INT,
  size_bytes INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_media_owner_kind ON media_library(owner_id, kind);

ALTER TABLE media_library ENABLE ROW LEVEL SECURITY;

-- El organizador SOLO ve/edita sus propias medias.
CREATE POLICY "Owner reads own media"
  ON media_library FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Owner inserts own media"
  ON media_library FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner deletes own media"
  ON media_library FOR DELETE
  USING (owner_id = auth.uid());
```

### Bucket / storage path

Nuevo prefijo en el bucket `images`:

```
images/library/<ownerId>/<mediaId>.webp
```

Hay que actualizar la RLS policy de `storage.objects` (la que armamos para
champions) para incluir `library/%` en el whitelist:

```sql
DROP POLICY IF EXISTS "Usuarios suben imagenes" ON storage.objects;
CREATE POLICY "Usuarios suben imagenes"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'images'
    AND auth.role() = 'authenticated'
    AND storage.extension(name) = ANY (
      ARRAY['jpg', 'jpeg', 'png', 'webp', 'gif']
    )
    AND (
      name LIKE 'logos/%'
      OR name LIKE 'sponsors/%'
      OR name LIKE 'champions/%'
      OR name LIKE 'library/%'
    )
  );
```

### Compresión en el cliente

Helper compartido nuevo: `src/lib/image-utils.ts`.

```ts
// Pseudocódigo del flujo
export async function optimizeImage(
  file: File,
  options: { maxSize?: number; quality?: number } = {}
): Promise<Blob> {
  // 1. Cargar imagen en HTMLImageElement
  // 2. Calcular dimensiones manteniendo aspect ratio, max maxSize px
  // 3. Dibujar en canvas con resize
  // 4. canvas.toBlob('image/webp', quality)
  // 5. Devolver Blob (que se sube como archivo .webp)
}
```

**Defaults sugeridos:**
- `maxSize: 256` px (lado mayor) — los logos en cards y banners se muestran
  más chicos que eso, no se gana nada con más resolución.
- `quality: 0.85` — buen compromiso entre tamaño y calidad visual.

**Excepción:** la foto del campeón (champion_photo) NO usa esto. Es
horizontal y queremos mejor calidad. Tendría su propio path: `maxSize: 1280`,
`quality: 0.9` (~150 KB en lugar de 30 KB).

### Componente reutilizable

Nuevo componente: `src/components/media/media-library-picker.tsx`.

```tsx
<MediaLibraryPicker
  kind="sponsor"                     // filtra qué le muestra
  onSelect={(url) => setSponsorUrl(url)}  // qué hacer cuando elige una
  trigger={<Button>Elegir imagen</Button>} // opcional, default <Button>
/>
```

**UX del modal:**

```
┌──────────────────────────────────────────────┐
│ Elegir imagen                            [×] │
├──────────────────────────────────────────────┤
│ [Mis imágenes (12)] [Subir nueva]            │
├──────────────────────────────────────────────┤
│                                              │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐                     │
│  │   │ │   │ │   │ │   │                     │
│  └───┘ └───┘ └───┘ └───┘                     │
│  Club A  Coca   Pep  Logo Y                  │
│                                              │
│  ┌───┐ ┌───┐ ...                             │
│                                              │
├──────────────────────────────────────────────┤
│                       [Cancelar]  [Elegir]   │
└──────────────────────────────────────────────┘
```

- Tab "Mis imágenes": grid de thumbnails 80×80 con label debajo. Click
  selecciona (highlight). "Elegir" cierra el modal con `onSelect(url)`.
- Tab "Subir nueva": input file → al elegir, ejecuta `optimizeImage()` con
  preview → confirma → sube a Storage + inserta en `media_library` →
  selecciona automáticamente.

### Puntos de integración

| Lugar | Cambio |
|---|---|
| `sponsor-form.tsx` | El input file actual → trigger del `<MediaLibraryPicker kind="sponsor">`. La URL elegida va a `sponsor.image_url` igual que hoy. |
| `organization-profile-form.tsx` | Idem para `kind="org_logo"`. |
| Form de equipo (no existe aún el campo) | `<MediaLibraryPicker kind="team_logo">`. Requiere agregar `teams.logo_url`. |
| `tournament-champion-modal.tsx` | **NO** usa biblioteca. La foto del campeón es única por torneo y se elimina si se reemplaza. |

**Importante:** las tablas existentes (`sponsors`, `organization_profiles`)
NO cambian de schema. Siguen guardando `image_url` / `logo_url` como TEXT
con la URL pública. La biblioteca es el **catálogo** del organizador, no
es FK obligatorio. Esto significa:

- Cambios mínimos en código existente.
- Una imagen puede estar en biblioteca sin estar en uso (subida pero no
  asignada). OK.
- Una imagen puede estar en uso sin estar en biblioteca (subida en el viejo
  sistema, antes de la migración). OK también — el modal solo muestra las
  que SÍ están en biblioteca.

### Borrar de la biblioteca

Cuando el organizador quiere borrar una imagen de su biblioteca:

```ts
// 1. Contar referencias en tablas que la usan
const usedBy = await countReferences(mediaId);
// { sponsors: 5, teams: 2, org_profiles: 0 }

// 2. Si > 0, advertir
if (usedBy.total > 0) {
  // Mostrar: "Esta imagen está siendo usada por 5 sponsors y 2 equipos.
  // Si la borrás, esas referencias se romperán."
  // Opciones: [Cancelar] [Borrar igual]
}

// 3. Al confirmar:
//    - Setear NULL en las tablas que la referencian
//    - DELETE de media_library
//    - storage.remove([storage_path])
```

**Tradeoff:** alternativa más segura sería bloquear el borrado hasta que
no esté en uso. Más estricto pero menos flexible. **Recomendación:** advertir
+ permitir, no bloquear.

### Backfill de imágenes existentes (decisión pendiente)

**Opción A — migrar todo:** un script SQL que recorre
`sponsors`, `organization_profiles` y crea filas en `media_library` para
cada URL única por owner. Los organizadores ven sus imágenes viejas en el
modal sin re-subir nada.

```sql
-- Pseudocódigo
INSERT INTO media_library (owner_id, url, storage_path, kind, ...)
SELECT DISTINCT
  t.created_by AS owner_id,
  s.image_url AS url,
  -- extraer storage_path desde la URL (basename después de /images/)
  ...
FROM sponsors s
JOIN tournaments t ON t.id = s.tournament_id
WHERE NOT EXISTS (
  SELECT 1 FROM media_library m WHERE m.url = s.image_url
);
-- idem para org_profiles
```

**Opción B — biblioteca arranca vacía:** lo viejo sigue funcionando, lo
nuevo va a biblioteca. Más simple, peor UX para organizadores activos.

## Tradeoffs / decisiones pendientes

### 1. Scope inicial (incremental vs completo)

- **Solo sponsors primero** (recomendado): mínimo cambio, máximo aprendizaje.
  Si el flujo le gusta, se extiende a logos de org y equipo.
- **Sponsors + org + team logo de una**: más código pero queda homogéneo.
  Requiere agregar `teams.logo_url` en la misma migration.

### 2. Calidad de compresión

- **Agresiva (256×256 @ 85%)**: ~30 KB/archivo. Recomendado para logos
  porque siempre se muestran chiquitos.
- **Moderada (512×512 @ 90%)**: ~80 KB/archivo. Más margen para zoom o
  Retina, pero corta el ratio de mejora a ~7× en lugar de 21×.

### 3. Backfill (ver sección arriba)

- Opción A (migrar) vs B (biblioteca arranca vacía).

### 4. Labels de imagen

¿El organizador puede ponerle un nombre a cada imagen ("Logo Club X") o son
anónimas? Labels facilitan reusar (en lugar de buscar visualmente) pero
agregan fricción al subir.

**Recomendación:** label opcional. En el input de upload, default es el
nombre del archivo (sin extensión); el organizador puede editarlo.

### 5. Permitir crop al subir

¿Vale la pena un cropper (tipo react-easy-crop) al subir? Útil para sponsors
que vienen con padding raro. Suma una dependencia y complejidad.

**Recomendación:** **NO en v1**. El resize automático ya ajusta proporción.
Si el organizador quiere editar antes, lo hace fuera de la app.

### 6. Tamaño mostrado en el modal

Grid de 80×80? 100×100? Cuántas columnas? Pensar UX mobile (3 cols max).

**Recomendación:** 80×80 con 3 cols mobile / 4 cols desktop, label debajo.

## Fases de implementación

1. **Migration**: tabla `media_library` + RLS + actualización de policy de
   `storage.objects` para incluir `library/%`.
2. **Helper de compresión**: `src/lib/image-utils.ts` con `optimizeImage()`.
   Test manual con varias imágenes (PNG, JPG con transparencia, dimensiones
   varias) para confirmar que el resize + WebP funciona bien.
3. **Componente `MediaLibraryPicker`**: el modal con tabs "Mis imágenes" /
   "Subir nueva". Standalone, sin integrar todavía.
4. **Integrar en sponsors** (kind="sponsor"): reemplazar el input file en
   `sponsor-form.tsx`. Smoke test con un torneo.
5. **(opcional)** Integrar en logo de organización.
6. **(opcional)** Agregar `teams.logo_url` + integrar en form de equipo.
7. **Backfill** si se decidió Opción A: script SQL + correr en prod.
8. **Borrado con check de referencias**: UI + lógica para borrar de
   biblioteca con advertencia de uso.

## Verificación

- Organizador con 3 torneos sube un sponsor "Coca-Cola" → se ve en modal
  como "Mis imágenes" en los otros 2 torneos sin volver a subir.
- Click en el archivo del bucket de Supabase → el archivo es `.webp` y pesa
  ~30 KB (no el PNG original de 200 KB).
- Borra el sponsor del torneo 1 → la imagen sigue en la biblioteca + sigue
  en uso en torneos 2 y 3 sin romperse.
- Borra desde la biblioteca → advertencia "está en 2 torneos" → al confirmar,
  los 2 torneos quedan sin sponsor (NULL) y el archivo desaparece de Storage.
- Organizador 2 NO ve las imágenes del organizador 1 en su modal (RLS).
- Compresión: una imagen subida en mobile (foto de cámara, 3 MB) llega al
  servidor como ~30 KB.

## Notas adicionales

- **Otras features ya en `images/`**: `logos/`, `sponsors/`, `champions/`.
  Este plan agrega un cuarto prefijo `library/`. Las imágenes viejas siguen
  donde están — no las movemos.
- **Champion photo NO entra en biblioteca**: es única por torneo, se borra
  al reemplazar (TODO ya anotado en otro punto).
- **Fotos huérfanas (TODO de otro doc)**: cuando se borra una imagen sin
  hacer cleanup en Storage, queda huérfana. Este plan facilita el cleanup
  porque `media_library.storage_path` da el handle exacto.
- **No usar SVG por ahora**: la policy actual NO permite SVG por riesgo
  XSS. Si se permitiera, podríamos pasar de ~30 KB a ~10 KB por logo
  vectorial, pero hay que sanitizar primero.
