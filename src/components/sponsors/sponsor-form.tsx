"use client";

import { useRef, useState } from "react";
import { Sponsor } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface SponsorFormProps {
  sponsors: Sponsor[];
  onChange: (sponsors: Sponsor[]) => void;
  maxSponsors?: number;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) return;

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to Supabase Storage
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `sponsors/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from("images")
      .upload(path, file);

    if (error) {
      setUploading(false);
      setImagePreview(null);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("images")
      .getPublicUrl(path);

    setImageUrl(urlData.publicUrl);
    setUploading(false);
  };

  const handleAdd = () => {
    if (!imageUrl.trim() || !linkUrl.trim()) return;
    const newSponsor: Sponsor = {
      id: `sponsor-${Date.now()}`,
      imageUrl: imageUrl.trim(),
      linkUrl: linkUrl.trim(),
    };
    onChange([...sponsors, newSponsor]);
    setImageUrl("");
    setImagePreview(null);
    setLinkUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemove = (id: string) => {
    onChange(sponsors.filter((s) => s.id !== id));
  };

  const clearImage = () => {
    setImageUrl("");
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      {/* Current sponsors */}
      {sponsors.length > 0 && (
        <div className="space-y-2">
          {sponsors.map((sponsor) => (
            <div
              key={sponsor.id}
              className="flex items-center gap-3 border rounded-lg p-2"
            >
              <div className="w-16 h-10 rounded border bg-muted/30 overflow-hidden flex-shrink-0">
                <img
                  src={sponsor.imageUrl}
                  alt="Patrocinador"
                  className="w-full h-full object-contain p-1"
                />
              </div>
              <span className="text-sm text-muted-foreground truncate flex-1">
                {sponsor.linkUrl}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={() => handleRemove(sponsor.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new */}
      {sponsors.length < maxSponsors && (
        <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
          {/* Image upload */}
          <div className="space-y-1.5">
            <Label className="text-xs">Imagen del patrocinador</Label>
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
            <Label className="text-xs">URL de destino (al hacer click)</Label>
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
            disabled={!imageUrl.trim() || !linkUrl.trim() || uploading}
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
