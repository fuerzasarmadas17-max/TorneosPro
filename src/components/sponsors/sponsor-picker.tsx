"use client";

import { useMemo, useRef, useState } from "react";
import { Sponsor } from "@/types";
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
import { Check, Upload, Trash2, ImageOff, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  resizeImageForUpload,
  IMAGE_SIZES,
  MAX_UPLOAD_BYTES,
  isImageFile,
} from "@/lib/images";
import { toast } from "sonner";

interface SponsorPickerProps {
  /** Biblioteca del organizador (sponsors a nivel organización). */
  library: Sponsor[];
  /** imageUrls que ya están en el torneo, para marcarlos como "ya agregado". */
  existingUrls: string[];
  /** Cuántos patrocinadores más se pueden agregar (cap del torneo). */
  remainingSlots: number;
  /**
   * Agrega los sponsors elegidos a la lista del torneo. Los elegidos de la
   * biblioteca ya traen `librarySponsorId`; los subidos nuevos vienen sin él y
   * el padre debe resolver el link (ensureLibrarySponsor) para auto-alimentar
   * la biblioteca.
   */
  onAdd: (sponsors: Sponsor[]) => void | Promise<void>;
  /** El botón que dispara el modal. */
  trigger: React.ReactNode;
}

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
    console.error("Storage upload error:", error);
    toast.error("Error al subir la imagen: " + error.message);
    return null;
  }
  const { data } = supabase.storage.from("images").getPublicUrl(path);
  return data.publicUrl;
}

function newTournamentSponsor(
  base: Pick<Sponsor, "imageUrl" | "linkUrl" | "name" | "librarySponsorId">,
  salt: number
): Sponsor {
  return {
    id: `sponsor-${Date.now()}-${salt}`,
    imageUrl: base.imageUrl,
    linkUrl: base.linkUrl || "",
    name: base.name || undefined,
    librarySponsorId: base.librarySponsorId,
  };
}

export function SponsorPicker({
  library,
  existingUrls,
  remainingSlots,
  onAdd,
  trigger,
}: SponsorPickerProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [libSearch, setLibSearch] = useState("");

  // Cuántos logos mostrar por defecto (sin búsqueda). El resto se encuentra
  // escribiendo en el buscador.
  const LIBRARY_PREVIEW = 6;

  // Upload-new state. La URL NO se pide acá: es por-torneo y se coloca a mano
  // en la lista del torneo.
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existing = useMemo(() => new Set(existingUrls), [existingUrls]);

  // Biblioteca filtrada por nombre. Sin búsqueda: máximo LIBRARY_PREVIEW.
  const filteredLib = useMemo(() => {
    const q = libSearch.trim().toLowerCase();
    if (!q) return library;
    return library.filter((s) => (s.name ?? "").toLowerCase().includes(q));
  }, [library, libSearch]);
  const displayedLib = libSearch.trim() ? filteredLib : filteredLib.slice(0, LIBRARY_PREVIEW);

  const reset = () => {
    setSelected(new Set());
    setLibSearch("");
    setImageUrl("");
    setImagePreview(null);
    setName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) reset();
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= remainingSlots) {
          toast.error(`Solo podés agregar ${remainingSlots} más`);
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  const handleAddFromLibrary = async () => {
    const picked = library.filter((s) => selected.has(s.id));
    if (picked.length === 0) return;
    // Los de la biblioteca se linkean por su propio id (library_sponsor_id).
    // NO copiamos la URL: es por-torneo, el organizador la coloca manual en la
    // lista del torneo.
    await onAdd(
      picked.map((s, i) => newTournamentSponsor({ ...s, linkUrl: "", librarySponsorId: s.id }, i))
    );
    handleOpenChange(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    setUploading(true);
    const url = await uploadSponsorImage(file);
    if (url) setImageUrl(url);
    else setImagePreview(null);
    setUploading(false);
  };

  const handleAddUploaded = async () => {
    if (!imageUrl.trim() || !name.trim()) return;
    // Sin librarySponsorId: el padre lo resuelve (ensureLibrarySponsor), lo que
    // crea el logo en la biblioteca y deja el uso linkeado.
    const sponsor = newTournamentSponsor(
      { imageUrl: imageUrl.trim(), linkUrl: "", name: name.trim() },
      0
    );
    await onAdd([sponsor]);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Añadir patrocinador</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={library.length > 0 ? "library" : "upload"}>
          <TabsList className="w-full">
            <TabsTrigger value="library" className="flex-1">
              Mi biblioteca ({library.length})
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex-1">
              Subir nuevo
            </TabsTrigger>
          </TabsList>

          {/* --- Biblioteca --- */}
          <TabsContent value="library" className="mt-4">
            {library.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <ImageOff className="h-6 w-6" />
                <p>Tu biblioteca está vacía.</p>
                <p>Subí un logo en la pestaña &quot;Subir nuevo&quot; y quedará guardado para reutilizarlo.</p>
              </div>
            ) : (
              <>
                {/* Buscador por nombre */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre..."
                    value={libSearch}
                    onChange={(e) => setLibSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {displayedLib.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Ningún logo coincide con “{libSearch}”.
                  </p>
                ) : (
                <div className="grid grid-cols-3 gap-3 max-h-[320px] overflow-y-auto pr-1">
                  {displayedLib.map((s) => {
                    const alreadyAdded = existing.has(s.imageUrl);
                    const isSelected = selected.has(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => toggle(s.id)}
                        className={`relative flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors ${
                          alreadyAdded
                            ? "opacity-40 cursor-not-allowed"
                            : isSelected
                              ? "border-primary ring-1 ring-primary"
                              : "hover:border-primary/50"
                        }`}
                        title={alreadyAdded ? "Ya agregado a este torneo" : s.name || undefined}
                      >
                        <div className="h-12 w-full overflow-hidden rounded bg-muted/30">
                          <img
                            src={s.imageUrl}
                            alt={s.name || "Patrocinador"}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-contain p-1"
                          />
                        </div>
                        <span className="w-full truncate text-[11px] text-muted-foreground">
                          {s.name || "Sin nombre"}
                        </span>
                        {isSelected && !alreadyAdded && (
                          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                        {alreadyAdded && (
                          <span className="absolute right-1 top-1 rounded bg-muted px-1 text-[9px] leading-4 text-muted-foreground">
                            Ya está
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                )}

                {/* Hint: hay más logos que los mostrados por defecto */}
                {!libSearch.trim() && library.length > LIBRARY_PREVIEW && (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Mostrando {LIBRARY_PREVIEW} de {library.length}. Buscá por nombre para ver el resto.
                  </p>
                )}

                <DialogFooter className="mt-4">
                  <Button
                    type="button"
                    onClick={handleAddFromLibrary}
                    disabled={selected.size === 0}
                  >
                    Agregar {selected.size > 0 ? `(${selected.size})` : ""}
                  </Button>
                </DialogFooter>
              </>
            )}
          </TabsContent>

          {/* --- Subir nuevo --- */}
          <TabsContent value="upload" className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Imagen del patrocinador</Label>
              <p className="text-xs text-muted-foreground">
                Tamaño recomendado: 300x100px. PNG o JPG. Lo optimizamos solo.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {imagePreview ? (
                <div className="flex items-center gap-3">
                  <div className="h-14 w-24 flex-shrink-0 overflow-hidden rounded border bg-muted/30">
                    <img src={imagePreview} alt="Preview" decoding="async" className="h-full w-full object-contain p-1" />
                  </div>
                  <div className="flex items-center gap-2">
                    {uploading && <span className="text-xs text-muted-foreground">Subiendo...</span>}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={uploading}
                      onClick={() => {
                        setImageUrl("");
                        setImagePreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Quitar
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <Upload className="h-4 w-4" />
                  Subir imagen desde tu PC
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Nombre <span className="text-destructive">*</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ej. Coca-Cola" />
            </div>

            <p className="text-xs text-muted-foreground">
              Se agrega al torneo y queda guardado en tu biblioteca para reutilizarlo. La URL de
              destino se coloca después en la lista del torneo.
            </p>

            <DialogFooter>
              <Button
                type="button"
                onClick={handleAddUploaded}
                disabled={!imageUrl.trim() || !name.trim() || uploading}
              >
                Agregar patrocinador
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
