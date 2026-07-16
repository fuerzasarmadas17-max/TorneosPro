"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sponsor } from "@/types";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import {
  resizeImageForUpload,
  IMAGE_SIZES,
  MAX_UPLOAD_BYTES,
  isImageFile,
} from "@/lib/images";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ImagePlus,
  Trash2,
  Upload,
  Search,
  Plus,
  Images,
  AlertCircle,
  Loader2,
} from "lucide-react";

async function uploadSponsorImage(file: File): Promise<string | null> {
  if (!isImageFile(file)) {
    toast.error("El archivo debe ser una imagen (PNG, JPG, etc.)");
    return null;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    toast.error("La imagen no debe superar los 12MB");
    return null;
  }
  const { blob, ext } = await resizeImageForUpload(file, {
    maxDim: IMAGE_SIZES.sponsor,
  });
  const path = `sponsors/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from("images")
    .upload(path, blob, { contentType: blob.type });
  if (error) {
    toast.error("Error al subir la imagen: " + error.message);
    return null;
  }
  const { data } = supabase.storage.from("images").getPublicUrl(path);
  return data.publicUrl;
}

export function LogoLibraryManager() {
  const { user, updateOrganizationProfile } = useAuth();
  const profile = user?.organizationProfile;

  const [logos, setLogos] = useState<Sponsor[]>(profile?.sponsors ?? []);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // Alta (modal)
  const [addOpen, setAddOpen] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newPreview, setNewPreview] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [uploading, setUploading] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  // Reemplazo de imagen de un logo existente
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Confirmación de borrado
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleting = logos.find((l) => l.id === deletingId);

  useEffect(() => {
    if (!dirty) setLogos(profile?.sponsors ?? []);
  }, [profile?.sponsors, dirty]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logos;
    return logos.filter((l) => (l.name ?? "").toLowerCase().includes(q));
  }, [logos, search]);

  const unnamedCount = logos.filter((l) => !(l.name ?? "").trim()).length;

  const setName = (id: string, name: string) => {
    setLogos((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)));
    setDirty(true);
  };

  const confirmDelete = () => {
    if (!deletingId) return;
    setLogos((prev) => prev.filter((l) => l.id !== deletingId));
    setDirty(true);
    setDeletingId(null);
  };

  const handleReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingId) return;
    setUploading(true);
    const url = await uploadSponsorImage(file);
    if (url) {
      setLogos((prev) => prev.map((l) => (l.id === replacingId ? { ...l, imageUrl: url } : l)));
      setDirty(true);
    }
    setReplacingId(null);
    setUploading(false);
    if (replaceInputRef.current) replaceInputRef.current.value = "";
  };

  const handleNewFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setNewPreview(reader.result as string);
    reader.readAsDataURL(file);
    setUploading(true);
    const url = await uploadSponsorImage(file);
    if (url) setNewImageUrl(url);
    else setNewPreview(null);
    setUploading(false);
  };

  const resetAdd = () => {
    setNewImageUrl("");
    setNewPreview(null);
    setNewName("");
    if (addInputRef.current) addInputRef.current.value = "";
  };

  const addLogo = () => {
    if (!newImageUrl.trim() || !newName.trim()) return;
    setLogos((prev) => [
      { id: `logo-${Date.now()}`, imageUrl: newImageUrl.trim(), linkUrl: "", name: newName.trim() },
      ...prev,
    ]);
    setDirty(true);
    setAddOpen(false);
    resetAdd();
  };

  const discard = () => {
    setLogos(profile?.sponsors ?? []);
    setDirty(false);
  };

  const save = async () => {
    if (!profile) return;
    if (unnamedCount > 0) {
      toast.error(`Faltan nombres: ${unnamedCount} logo(s) sin nombre.`);
      return;
    }
    setSaving(true);
    const res = await updateOrganizationProfile({ ...profile, sponsors: logos });
    setSaving(false);
    if (res.success) {
      setDirty(false);
      toast.success("Logos guardados. Los cambios de imagen se aplican en todos los torneos que los usan.");
    } else {
      toast.error(res.error || "No se pudieron guardar los cambios.");
    }
  };

  if (!profile) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        <Images className="mx-auto mb-3 h-8 w-8 opacity-60" />
        <p>Primero configurá tu perfil de organización para gestionar tus logos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Inputs ocultos */}
      <input ref={replaceInputRef} type="file" accept="image/*" onChange={handleReplace} className="hidden" />

      {/* Sub-header */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="rounded-full">{logos.length}</Badge>
        <p className="text-sm text-muted-foreground">
          en tu biblioteca. Editar la imagen de un logo se refleja en todos los torneos donde se usa.
        </p>
      </div>

      {/* Aviso de logos sin nombre */}
      {unnamedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            {unnamedCount} {unnamedCount === 1 ? "logo no tiene" : "logos no tienen"} nombre. Ponéles uno para poder guardar.
          </span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {search.trim() && (
          <span className="text-sm text-muted-foreground">
            {filtered.length} de {logos.length}
          </span>
        )}
        <Button className="ml-auto" onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar logo
        </Button>
      </div>

      {/* Grilla / estados */}
      {logos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
          <Images className="h-10 w-10 text-muted-foreground/60" />
          <div>
            <p className="font-medium">Todavía no tenés logos</p>
            <p className="text-sm text-muted-foreground">Subí el primero para empezar tu biblioteca.</p>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar logo
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Ningún logo coincide con “{search}”.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((logo) => {
            const unnamed = !(logo.name ?? "").trim();
            return (
              <div
                key={logo.id}
                className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-sm"
              >
                {/* Imagen */}
                <button
                  type="button"
                  onClick={() => {
                    setReplacingId(logo.id);
                    replaceInputRef.current?.click();
                  }}
                  className="relative flex h-28 w-full items-center justify-center bg-muted/40"
                  title="Cambiar imagen"
                >
                  <img
                    src={logo.imageUrl}
                    alt={logo.name || "Logo"}
                    loading="lazy"
                    decoding="async"
                    className="max-h-full max-w-full object-contain p-3"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-xs font-medium">Cambiar imagen</span>
                  </div>
                  {/* Borrar */}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingId(logo.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeletingId(logo.id);
                      }
                    }}
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-background/85 text-muted-foreground opacity-0 shadow-sm ring-1 ring-border transition-all hover:bg-destructive hover:text-white group-hover:opacity-100"
                    title="Borrar logo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                </button>

                {/* Nombre */}
                <div className="space-y-1 p-2.5">
                  <Input
                    value={logo.name ?? ""}
                    onChange={(e) => setName(logo.id, e.target.value)}
                    placeholder="Nombre del patrocinador"
                    className={`h-8 text-sm ${unnamed ? "border-amber-500/60" : ""}`}
                  />
                  {unnamed && (
                    <p className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-3 w-3" /> Sin nombre
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Barra fija de cambios sin guardar */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="container mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm text-muted-foreground">Tenés cambios sin guardar</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={discard} disabled={saving}>
                Descartar
              </Button>
              <Button onClick={save} disabled={saving || unnamedCount > 0}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                  </>
                ) : (
                  "Guardar cambios"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Agregar logo */}
      <Dialog
        open={addOpen}
        onOpenChange={(v) => {
          setAddOpen(v);
          if (!v) resetAdd();
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Agregar logo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <input ref={addInputRef} type="file" accept="image/*" onChange={handleNewFile} className="hidden" />
            <div className="flex items-center gap-3">
              {newPreview ? (
                <button
                  type="button"
                  onClick={() => addInputRef.current?.click()}
                  className="h-20 w-28 shrink-0 overflow-hidden rounded-lg border bg-muted/40"
                  title="Cambiar imagen"
                >
                  <img src={newPreview} alt="Preview" decoding="async" className="h-full w-full object-contain p-1.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => addInputRef.current?.click()}
                  className="flex h-20 w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Subiendo..." : "Subir imagen"}
                </button>
              )}
              <p className="text-xs text-muted-foreground">
                PNG o JPG. Ideal 300×100px con fondo transparente. Lo optimizamos solo.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ej. Coca-Cola"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newImageUrl.trim() && newName.trim()) addLogo();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={addLogo} disabled={!newImageUrl.trim() || !newName.trim() || uploading}>
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal — Confirmar borrado */}
      <Dialog open={!!deletingId} onOpenChange={(v) => !v && setDeletingId(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Borrar logo</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3">
            {deleting && (
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded border bg-muted/40">
                <img src={deleting.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-1.5" />
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Se quita <strong>{deleting?.name || "este logo"}</strong> de tu biblioteca. Los torneos
              que ya lo usan lo conservan (no se borra de ellos), pero dejará de estar disponible para
              reutilizar.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeletingId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
