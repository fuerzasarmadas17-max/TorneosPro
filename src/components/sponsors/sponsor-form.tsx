"use client";

import { useRef, useState } from "react";
import { Sponsor } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Upload, ImagePlus, GripVertical } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SponsorFormProps {
  sponsors: Sponsor[];
  onChange: (sponsors: Sponsor[]) => void;
  maxSponsors?: number;
}

function SortableSponsor({
  sponsor,
  index,
  onReplace: triggerReplace,
  onUrlChange,
  onRemove,
}: {
  sponsor: Sponsor;
  index: number;
  onReplace: (index: number) => void;
  onUrlChange: (index: number, url: string) => void;
  onRemove: (index: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sponsor.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 border rounded-lg p-2 bg-background"
    >
      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Thumbnail + replace */}
      <button
        type="button"
        onClick={() => triggerReplace(index)}
        className="w-16 h-10 rounded border bg-muted/30 overflow-hidden flex-shrink-0 relative group cursor-pointer"
        title="Reemplazar imagen"
      >
        <img
          src={sponsor.imageUrl}
          alt="Patrocinador"
          className="w-full h-full object-contain p-1"
        />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <ImagePlus className="h-3.5 w-3.5 text-white" />
        </div>
      </button>

      {/* URL input */}
      <Input
        value={sponsor.linkUrl}
        onChange={(e) => onUrlChange(index, e.target.value)}
        placeholder="URL del patrocinador"
        className="h-8 text-xs flex-1"
      />

      {/* Delete */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 flex-shrink-0"
        onClick={() => onRemove(index)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function SponsorForm({
  sponsors,
  onChange,
  maxSponsors = 10,
}: SponsorFormProps) {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const activeId = String(active.id);
      const overId = String(over.id);
      const oldIndex = sponsors.findIndex((s) => s.id === activeId);
      const newIndex = sponsors.findIndex((s) => s.id === overId);
      if (oldIndex !== -1 && newIndex !== -1) {
        onChange(arrayMove(sponsors, oldIndex, newIndex));
      }
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
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
      console.error("Storage upload error:", error);
      toast.error("Error al subir la imagen: " + error.message);
      return null;
    }

    const { data: urlData } = supabase.storage.from("images").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    const url = await uploadFile(file);
    if (url) {
      setImageUrl(url);
    } else {
      setImagePreview(null);
    }
    setUploading(false);
  };

  const handleReplaceImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || replacingIndex === null) return;

    setUploading(true);
    const url = await uploadFile(file);
    if (url) {
      const updated = [...sponsors];
      updated[replacingIndex] = { ...updated[replacingIndex], imageUrl: url };
      onChange(updated);
    }
    setReplacingIndex(null);
    setUploading(false);
    if (replaceInputRef.current) replaceInputRef.current.value = "";
  };

  const handleAdd = () => {
    if (!imageUrl.trim()) return;
    const newSponsor: Sponsor = {
      id: `sponsor-${Date.now()}`,
      imageUrl: imageUrl.trim(),
      linkUrl: linkUrl.trim() || "",
    };
    onChange([...sponsors, newSponsor]);
    setImageUrl("");
    setImagePreview(null);
    setLinkUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemove = (index: number) => {
    onChange(sponsors.filter((_, i) => i !== index));
  };

  const handleUrlChange = (index: number, url: string) => {
    const updated = [...sponsors];
    updated[index] = { ...updated[index], linkUrl: url };
    onChange(updated);
  };

  const clearImage = () => {
    setImageUrl("");
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      {/* Hidden input for replacing images */}
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        onChange={handleReplaceImage}
        className="hidden"
      />

      {/* Current sponsors */}
      {sponsors.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sponsors.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {sponsors.map((sponsor, index) => (
                <SortableSponsor
                  key={sponsor.id}
                  sponsor={sponsor}
                  index={index}
                  onReplace={(i) => {
                    setReplacingIndex(i);
                    replaceInputRef.current?.click();
                  }}
                  onUrlChange={handleUrlChange}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add new */}
      {sponsors.length < maxSponsors && (
        <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
          {/* Image upload */}
          <div className="space-y-1.5">
            <Label className="text-xs">Imagen del patrocinador</Label>
            <p className="text-xs text-muted-foreground">
              Tamano recomendado: 300x100px. Formato: PNG o JPG. Maximo 2MB.
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
                <div className="w-24 h-14 rounded border bg-muted/30 overflow-hidden flex-shrink-0">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-contain p-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {uploading && (
                    <span className="text-xs text-muted-foreground">Subiendo...</span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearImage}
                    disabled={uploading}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Quitar
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
              >
                <Upload className="h-4 w-4" />
                Subir imagen desde tu PC
              </button>
            )}
          </div>

          {/* Link URL */}
          <div className="space-y-1.5">
            <Label className="text-xs">URL de destino (opcional)</Label>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://patrocinador.com"
              type="url"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={!imageUrl.trim() || uploading}
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar Patrocinador
          </Button>
        </div>
      )}

      {sponsors.length >= maxSponsors && (
        <p className="text-xs text-muted-foreground">
          Maximo de {maxSponsors} patrocinadores alcanzado
        </p>
      )}
    </div>
  );
}
