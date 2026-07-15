"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClubLogo } from "@/types";
import { supabase } from "@/lib/supabase";
import { fetchClubLogos, createClubLogo } from "@/lib/db/club-logos";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Check, Upload, Search, ImageOff, Loader2 } from "lucide-react";

const PREVIEW = 6;

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

interface TeamLogoPickerProps {
  orgId?: string;
  currentClubLogoId?: string;
  onSelect: (sel: { imageUrl: string; clubLogoId: string; name?: string }) => void;
  trigger: React.ReactNode;
}

export function TeamLogoPicker({ orgId, currentClubLogoId, onSelect, trigger }: TeamLogoPickerProps) {
  const [open, setOpen] = useState(false);
  const [library, setLibrary] = useState<ClubLogo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Subir nuevo
  const [imageUrl, setImageUrl] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !orgId) return;
    setLoading(true);
    fetchClubLogos(orgId).then((data) => {
      setLibrary(data);
      setLoading(false);
    });
  }, [open, orgId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return library;
    return library.filter((l) => (l.name ?? "").toLowerCase().includes(q));
  }, [library, search]);
  const displayed = search.trim() ? filtered : filtered.slice(0, PREVIEW);

  const reset = () => {
    setSearch("");
    setImageUrl("");
    setPreview(null);
    setName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) reset();
  };

  const pickFromLibrary = (logo: ClubLogo) => {
    onSelect({ imageUrl: logo.imageUrl, clubLogoId: logo.id, name: logo.name });
    handleOpenChange(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
    setUploading(true);
    const url = await uploadClubLogo(file);
    if (url) setImageUrl(url);
    else setPreview(null);
    setUploading(false);
  };

  const addNew = async () => {
    if (!orgId || !imageUrl.trim() || !name.trim()) return;
    setUploading(true);
    const created = await createClubLogo(orgId, { name: name.trim(), imageUrl: imageUrl.trim() });
    setUploading(false);
    if (created) {
      onSelect({ imageUrl: created.imageUrl, clubLogoId: created.id, name: created.name });
      handleOpenChange(false);
    } else {
      toast.error("No se pudo crear el logo.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Logo del club</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="library">
          <TabsList className="w-full">
            <TabsTrigger value="library" className="flex-1">Mi biblioteca</TabsTrigger>
            <TabsTrigger value="upload" className="flex-1">Subir nuevo</TabsTrigger>
          </TabsList>

          {/* Biblioteca */}
          <TabsContent value="library" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
              </div>
            ) : library.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <ImageOff className="h-6 w-6" />
                <p>Tu biblioteca de clubes está vacía.</p>
                <p>Subí un logo en &quot;Subir nuevo&quot; y quedará guardado para reutilizarlo.</p>
              </div>
            ) : (
              <>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {displayed.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Ningún logo coincide con “{search}”.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3 max-h-[320px] overflow-y-auto pr-1">
                    {displayed.map((logo) => {
                      const isCurrent = logo.id === currentClubLogoId;
                      return (
                        <button
                          key={logo.id}
                          type="button"
                          onClick={() => pickFromLibrary(logo)}
                          className={`relative flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors ${
                            isCurrent ? "border-primary ring-1 ring-primary" : "hover:border-primary/50"
                          }`}
                          title={logo.name || undefined}
                        >
                          <div className="aspect-square w-full overflow-hidden rounded bg-muted/30">
                            <img src={logo.imageUrl} alt={logo.name || "Logo"} className="h-full w-full object-contain p-1" />
                          </div>
                          <span className="w-full truncate text-[11px] text-muted-foreground">{logo.name || "Sin nombre"}</span>
                          {isCurrent && (
                            <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {!search.trim() && library.length > PREVIEW && (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Mostrando {PREVIEW} de {library.length}. Buscá por nombre para ver el resto.
                  </p>
                )}
              </>
            )}
          </TabsContent>

          {/* Subir nuevo */}
          <TabsContent value="upload" className="mt-4 space-y-4">
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            <div className="flex items-center gap-3">
              {preview ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border bg-muted/40"
                >
                  <img src={preview} alt="Preview" className="h-full w-full object-contain p-1.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Subiendo..." : "Subir imagen"}
                </button>
              )}
              <p className="text-xs text-muted-foreground">
                Usá una imagen <strong>cuadrada (1:1)</strong> — mismo ancho y alto, ej. 500×500px —
                así el logo se ve centrado y sin recortes. Ideal PNG con fondo transparente, máx 2MB.
                Queda guardado en tu biblioteca de clubes.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre del club <span className="text-destructive">*</span></Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ej. Club Atlético"
                onKeyDown={(e) => { if (e.key === "Enter" && imageUrl.trim() && name.trim()) addNew(); }}
              />
            </div>
            <DialogFooter>
              <Button onClick={addNew} disabled={!imageUrl.trim() || !name.trim() || uploading}>
                Usar este logo
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
