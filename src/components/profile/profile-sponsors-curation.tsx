"use client";

import { useMemo, useRef, useState } from "react";
import { Sponsor } from "@/types";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { setSponsorOnProfile, createProfileSponsor } from "@/lib/db/sponsors";
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
import { Search, Plus, Check, Upload, Loader2, ImageOff } from "lucide-react";

async function uploadSponsorImage(file: File): Promise<string | null> {
  const validExts = ["jpg", "jpeg", "png", "gif", "webp", "svg", "heic", "heif"];
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const isImage = file.type.startsWith("image/") || validExts.includes(ext);
  if (!isImage) {
    toast.error("El archivo debe ser una imagen (PNG, JPG, etc.)");
    return null;
  }
  if (file.size > 2 * 1024 * 1024) {
    toast.error("La imagen no debe superar los 2MB");
    return null;
  }
  const path = `sponsors/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("images").upload(path, file);
  if (error) {
    toast.error("Error al subir la imagen: " + error.message);
    return null;
  }
  const { data } = supabase.storage.from("images").getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Curación de los patrocinadores que aparecen en el PERFIL PÚBLICO del
 * organizador. Elige del catálogo (biblioteca) cuáles mostrar, o sube uno
 * nuevo (que queda en la biblioteca). Togglear la selección persiste al toque
 * (no depende de guardar el perfil). Agregar sponsors a un torneo NO afecta
 * esta selección.
 */
export function ProfileSponsorsCuration() {
  const { user } = useAuth();
  const orgId = user?.organizationProfile?.id;

  const [library, setLibrary] = useState<Sponsor[]>(
    user?.organizationProfile?.sponsors ?? []
  );
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Alta (modal)
  const [addOpen, setAddOpen] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newPreview, setNewPreview] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newLink, setNewLink] = useState("");
  const [uploading, setUploading] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  const featuredCount = library.filter((s) => s.showOnProfile).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return library;
    return library.filter((s) => (s.name ?? "").toLowerCase().includes(q));
  }, [library, search]);

  const toggle = async (s: Sponsor) => {
    const next = !s.showOnProfile;
    setBusyId(s.id);
    const ok = await setSponsorOnProfile(s.id, next);
    setBusyId(null);
    if (ok) {
      setLibrary((prev) => prev.map((l) => (l.id === s.id ? { ...l, showOnProfile: next } : l)));
    } else {
      toast.error("No se pudo actualizar.");
    }
  };

  const resetAdd = () => {
    setNewImageUrl("");
    setNewPreview(null);
    setNewName("");
    setNewLink("");
    if (addInputRef.current) addInputRef.current.value = "";
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

  const addLogo = async () => {
    if (!orgId || !newImageUrl.trim() || !newName.trim()) return;
    setUploading(true);
    const created = await createProfileSponsor(orgId, {
      name: newName.trim(),
      imageUrl: newImageUrl.trim(),
      linkUrl: newLink.trim(),
    });
    setUploading(false);
    if (created) {
      setLibrary((prev) => [created, ...prev]);
      setAddOpen(false);
      resetAdd();
      toast.success("Agregado a tu perfil.");
    } else {
      toast.error("No se pudo agregar.");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg">Patrocinadores del perfil</h3>
        <p className="text-sm text-muted-foreground">
          Elegí cuáles de tus logos aparecen en tu perfil público. Los que agregás a un torneo
          <strong> no</strong> se muestran acá automáticamente.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary" className="rounded-full">{featuredCount} en el perfil</Badge>
        {library.length > 0 && (
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        )}
        <Button type="button" size="sm" className="ml-auto" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Subir nuevo
        </Button>
      </div>

      {/* Grilla del catálogo */}
      {library.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          <ImageOff className="h-8 w-8 opacity-60" />
          <p>No tenés logos todavía. Subí el primero para mostrarlo en tu perfil.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Ningún logo coincide con “{search}”.</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Tocá un logo para mostrarlo u ocultarlo del perfil.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filtered.map((s) => {
              const on = !!s.showOnProfile;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s)}
                  disabled={busyId === s.id}
                  className={`relative flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors ${
                    on ? "border-primary ring-1 ring-primary bg-primary/5" : "opacity-70 hover:opacity-100 hover:border-primary/40"
                  }`}
                  title={s.name || undefined}
                >
                  <div className="flex h-14 w-full items-center justify-center overflow-hidden rounded bg-muted/30">
                    {busyId === s.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <img src={s.imageUrl} alt={s.name || "Logo"} className="h-full w-full object-contain p-1" />
                    )}
                  </div>
                  <span className="w-full truncate text-[11px] text-muted-foreground">{s.name || "Sin nombre"}</span>
                  {on && (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Modal — Subir nuevo */}
      <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) resetAdd(); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Subir patrocinador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <input ref={addInputRef} type="file" accept="image/*" onChange={handleNewFile} className="hidden" />
            <div className="flex items-center gap-3">
              {newPreview ? (
                <button
                  type="button"
                  onClick={() => addInputRef.current?.click()}
                  className="h-14 w-24 shrink-0 overflow-hidden rounded-lg border bg-muted/40"
                >
                  <img src={newPreview} alt="Preview" className="h-full w-full object-contain p-1.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => addInputRef.current?.click()}
                  className="flex h-14 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Subiendo..." : "Imagen"}
                </button>
              )}
              <p className="text-xs text-muted-foreground">
                Los logos de patrocinador son horizontales (ej. 300×100px). PNG o JPG, máx 2MB.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre <span className="text-destructive">*</span></Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ej. Coca-Cola" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">URL de destino (opcional)</Label>
              <Input value={newLink} onChange={(e) => setNewLink(e.target.value)} placeholder="https://patrocinador.com" type="url" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={addLogo} disabled={!newImageUrl.trim() || !newName.trim() || uploading}>
              Agregar al perfil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
