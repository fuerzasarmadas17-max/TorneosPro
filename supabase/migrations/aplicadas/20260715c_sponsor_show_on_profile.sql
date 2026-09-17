-- Desacopla la biblioteca de patrocinadores del perfil público del organizador.
--
-- Antes: el perfil mostraba TODOS los sponsors a nivel organización (= toda la
-- biblioteca). Con el backfill eso significaba mostrar decenas de logos.
--
-- Ahora: el perfil muestra SOLO los sponsors marcados con show_on_profile=true.
-- El organizador los elige explícitamente en la config del perfil. Agregar un
-- patrocinador a un torneo NO lo marca para el perfil.
--
-- 100% ADITIVO: columna nueva con default false. Las filas existentes quedan
-- en false → el perfil arranca sin banner hasta que el organizador cure su
-- selección. (Ninguna imagen ni patrocinador de torneo se toca.)
ALTER TABLE sponsors
  ADD COLUMN IF NOT EXISTS show_on_profile BOOLEAN NOT NULL DEFAULT false;
