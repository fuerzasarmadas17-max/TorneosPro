# Migraciones

**La regla es la carpeta:**

- `supabase/migrations/` (acá) → **pendiente de correr en Supabase.**
- `supabase/migrations/aplicadas/` → **ya corrió en producción.** No se toca.

Si esta carpeta solo tiene este archivo, no hay nada pendiente.

## Cómo se trabaja

El CLI de Supabase **no está enlazado**: las migraciones no se aplican solas.
El SQL se escribe acá, el organizador lo pega en el editor SQL de Supabase, y
recién después se despliega el código. Cuando confirma que corrió, el archivo
se mueve a `aplicadas/`.

En varias el **orden importa** y va escrito en el encabezado de cada archivo:
algunas van antes de desplegar (`20260905_mvp.sql` — sin el valor del enum,
todo torneo nuevo se rompe) y otras después (el backfill de la biblioteca de
logos inunda los torneos si corre antes).

## Ojo con `schema.sql`

`supabase/schema.sql` quedó congelado el **2026-07-28**. Las 41 migraciones
posteriores (foto de tarjeta, deuda de fiados, MVP, bienvenida) **no están
reflejadas ahí**. Hasta que se regenere, la forma real de la base se lee en
`aplicadas/`, no en `schema.sql`.
