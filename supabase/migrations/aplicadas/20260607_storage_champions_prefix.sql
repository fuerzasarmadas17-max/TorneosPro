-- Pieza J: allow the `champions/` prefix in the `images` storage bucket.
--
-- The existing storage RLS policy (`Usuarios suben imagenes`) whitelisted
-- only `logos/%` and `sponsors/%` paths. The champion-photo uploader now
-- writes under `champions/<tournamentId>-<rand>.<ext>`, so we extend the
-- policy with that prefix. SVG is intentionally NOT added (the existing
-- policy excludes it; we keep parity).
--
-- Drop & recreate the policy because `ALTER POLICY ... USING` can't widen
-- the OR list inside a complex CHECK in a single statement portably.

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
    )
  );
