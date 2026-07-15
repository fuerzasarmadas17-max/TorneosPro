"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClubLogo } from "@/types";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import {
  fetchClubLogos,
  createClubLogo,
  updateClubLogo,
  deleteClubLogo,
} from "@/lib/db/club-logos";
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
import { Search, Plus, Upload, ImagePlus, Trash2, Shield, Loader2 } from "lucide-react";

async function uploadClubLogo(file: File): Promise<string | null> {
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
  const path = `logos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("images").upload(path, file);
  if (error) {
    toast.error("Error al subir el logo: " + error.message);
    return null;
  }
  const { data } = supabase.storage.from("images").getPublicUrl(path);
  return data.publicUrl;
}

export function ClubLogoLibraryManager() {
  const { user } = useAuth();
  const orgId = user?.organizationProfile?.id;

  const [logos, setLogos] = useState<ClubLogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Edición local del nombre (se persiste on blur).
  const [nameEdits, setNameEdits] = useState<Record<string, string>>({});

  // Alta (modal)
  const [addOpen, setAddOpen] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newPreview, setNewPreview] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [uploading, setUploading] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  // Reemplazo de imagen
  const [busyId, setBusyId] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replacingId = useRef<string | null>(null);

  // Confirmar borrado
  const [deleting, setDeleting] = useState<ClubLogo | null>(null);

  useEffect(() => {
    let alive = true;
    if (!orgId) {
      setLoading(false);
      return;
    }
    fetchClubLogos(orgId).then((data) => {
      if (alive) {
        setLogos(data);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [orgId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logos;
    return logos.filter((l) => (l.name ?? "").toLowerCase().includes(q));
  }, [logos, search]);

  const resetAdd = () => {
    setNewImageUrl("");
    setNewPreview(null);
    setNewName("");
    if (addInputRef.current) addInputRef.current.value = "";
  };

  const handleNewFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setNewPreview(reader.result as string);
    reader.readAsDataURL(file);
    setUploading(true);
    const url = await uploadClubLogo(file);
    if (url) setNewImageUrl(url);
    else setNewPreview(null);
    setUploading(false);
  };

  const addLogo = async () => {
    if (!orgId || !newImageUrl.trim() || !newName.trim()) return;
    setUploading(true);
    const created = await createClubLogo(orgId, { name: newName.trim(), imageUrl: newImageUrl.trim() });
    setUploading(false);
    if (created) {
      setLogos((prev) => [created, ...prev]);
      setAddOpen(false);
      resetAdd();
      toast.success("Logo de club agregado.");
    } else {
      toast.error("No se pudo agregar el logo.");
    }
  };

  const saveName = async (logo: ClubLogo) => {
    const edited = nameEdits[logo.id];
    if (edited === undefined) return;
    const trimmed = edited.trim();
    setNameEdits((prev) => {
      const next = { ...prev };
      delete next[logo.id];
      return next;
    });
    if (!trimmed) {
      toast.error("El nombre no puede quedar vacío.");
      return;
    }
    if (trimmed === (logo.name ?? "")) return;
    const ok = await updateClubLogo(logo.id, { name: trimmed });
    if (ok) {
      setLogos((prev) => prev.map((l) => (l.id === logo.id ? { ...l, name: trimmed } : l)));
    } else {
      toast.error("No se pudo guardar el nombre.");
    }
  };

  const handleReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = replacingId.current;
    if (!file || !id) return;
    setBusyId(id);
    const url = await uploadClubLogo(file);
    if (url) {
      const ok = await updateClubLogo(id, { imageUrl: url });
      if (ok) {
        setLogos((prev) => prev.map((l) => (l.id === id ? { ...l, imageUrl: url } : l)));
        toast.success("Imagen actualizada en todos los equipos que usan este logo.");
      }
    }
    setBusyId(null);
    replacingId.current = null;
    if (replaceInputRef.current) replaceInputRef.current.value = "";
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const ok = await deleteClubLogo(deleting.id);
    if (ok) {
      setLogos((prev) => prev.filter((l) => l.id !== deleting.id));
    } else {
      toast.error("No se pudo borrar el logo.");
    }
    setDeleting(null);
  };

  if (!orgId) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        <Shield className="mx-auto mb-3 h-8 w-8 opacity-60" />
        <p>Primero configurá tu perfil de organización para gestionar tus logos de clubes.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando logos de clubes...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <input ref={replaceInputRef} type="file" accept="image/*" onChange={handleReplace} className="hidden" />

      {/* Sub-header */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="rounded-full">{logos.length}</Badge>
        <p className="text-sm text-muted-foreground">
          logos de clubes. Reutilizables al asignar el logo a un equipo; editar la imagen se refleja
          en todas sus categorías.
        </p>
      </div>

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
          <span className="text-sm text-muted-foreground">{filtered.length} de {logos.length}</span>
        )}
        <Button className="ml-auto" onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar logo
        </Button>
      </div>

      {/* Grilla / estados */}
      {logos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
          <Shield className="h-10 w-10 text-muted-foreground/60" />
          <div>
            <p className="font-medium">Todavía no tenés logos de clubes</p>
            <p className="text-sm text-muted-foreground">Subí el primero para reutilizarlo en tus equipos.</p>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar logo
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Ningún logo coincide con “{search}”.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((logo) => (
            <div key={logo.id} className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-sm">
              <button
                type="button"
                onClick={() => {
                  replacingId.current = logo.id;
                  replaceInputRef.current?.click();
                }}
                className="relative flex aspect-square w-full items-center justify-center bg-muted/40"
                title="Cambiar imagen"
              >
                {busyId === logo.id ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <img src={logo.imageUrl} alt={logo.name || "Logo"} className="max-h-full max-w-full object-contain p-3" />
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-xs font-medium">Cambiar imagen</span>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleting(logo);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleting(logo);
                    }
                  }}
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-background/85 text-muted-foreground opacity-0 shadow-sm ring-1 ring-border transition-all hover:bg-destructive hover:text-white group-hover:opacity-100"
                  title="Borrar logo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </span>
              </button>
              <div className="p-2.5">
                <Input
                  value={nameEdits[logo.id] ?? logo.name ?? ""}
                  onChange={(e) => setNameEdits((prev) => ({ ...prev, [logo.id]: e.target.value }))}
                  onBlur={() => saveName(logo)}
                  placeholder="Nombre del club"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal — Agregar logo */}
      <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) resetAdd(); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Agregar logo de club</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <input ref={addInputRef} type="file" accept="image/*" onChange={handleNewFile} className="hidden" />
            <div className="flex items-center gap-3">
              {newPreview ? (
                <button
                  type="button"
                  onClick={() => addInputRef.current?.click()}
                  className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border bg-muted/40"
                  title="Cambiar imagen"
                >
                  <img src={newPreview} alt="Preview" className="h-full w-full object-contain p-1.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => addInputRef.current?.click()}
                  className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Subiendo..." : "Subir imagen"}
                </button>
              )}
              <p className="text-xs text-muted-foreground">
                Usá una imagen <strong>cuadrada (1:1)</strong> — mismo ancho y alto, ej. 500×500px —
                así el logo se ve centrado y sin recortes. Ideal PNG con fondo transparente, máx 2MB.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre del club <span className="text-destructive">*</span></Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ej. Club Atlético"
                onKeyDown={(e) => { if (e.key === "Enter" && newImageUrl.trim() && newName.trim()) addLogo(); }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={addLogo} disabled={!newImageUrl.trim() || !newName.trim() || uploading}>
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal — Confirmar borrado */}
      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Borrar logo de club</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3">
            {deleting && (
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded border bg-muted/40">
                <img src={deleting.imageUrl} alt="" className="h-full w-full object-contain p-1.5" />
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Se quita <strong>{deleting?.name || "este logo"}</strong> de tu biblioteca. Los equipos
              que ya lo usan conservan su imagen actual, pero dejará de estar disponible para reutilizar.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Borrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
