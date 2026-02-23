"use client";

import { useRef, useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { OrganizationProfile } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { generateSlug } from "@/data/users";
import { isSlugReserved } from "@/lib/reserved-slugs";
import Link from "next/link";
import { ExternalLink, Upload, Trash2 } from "lucide-react";
import { SponsorForm } from "@/components/sponsors/sponsor-form";
import { supabase } from "@/lib/supabase";

const emptyProfile: OrganizationProfile = {
  slug: "",
  organizationName: "",
  bio: "",
  logoUrl: "",
  socialLinks: {},
  location: "",
  foundedYear: undefined,
  isPublic: true,
};

export function OrganizationProfileForm() {
  const { user, updateOrganizationProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<OrganizationProfile>(emptyProfile);

  useEffect(() => {
    if (user?.organizationProfile) {
      setFormData(user.organizationProfile);
    } else if (user) {
      setFormData({
        ...emptyProfile,
        slug: generateSlug(user.name),
        organizationName: user.name,
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.slug || formData.slug.length < 3) {
      toast.error("El slug debe tener al menos 3 caracteres");
      setLoading(false);
      return;
    }

    if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      toast.error(
        "El slug solo puede contener letras minusculas, numeros y guiones"
      );
      setLoading(false);
      return;
    }

    if (isSlugReserved(formData.slug)) {
      toast.error("Este slug esta reservado, por favor elige otro");
      setLoading(false);
      return;
    }

    const result = await updateOrganizationProfile(formData);

    if (result.success) {
      toast.success("Perfil actualizado exitosamente");
    } else {
      toast.error(result.error || "Error al actualizar perfil");
    }

    setLoading(false);
  };

  const logoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check type by MIME or file extension (some browsers send empty type)
    const validExts = ["jpg", "jpeg", "png", "gif", "webp", "svg", "heic", "heif"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const isImage = file.type.startsWith("image/") || validExts.includes(ext);

    if (!isImage) {
      toast.error("El archivo debe ser una imagen (PNG, JPG, etc.)");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen no debe superar los 2MB");
      return;
    }

    setUploadingLogo(true);
    const path = `logos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage.from("images").upload(path, file);
    if (error) {
      console.error("Storage upload error:", error);
      toast.error("Error al subir el logo: " + error.message);
      setUploadingLogo(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("images").getPublicUrl(path);
    setFormData((prev) => ({ ...prev, logoUrl: urlData.publicUrl }));
    setUploadingLogo(false);
  };

  const handleOrgNameChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      organizationName: value,
      slug: prev.slug === generateSlug(prev.organizationName)
        ? generateSlug(value)
        : prev.slug,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Organization Name */}
      <div className="space-y-2">
        <Label htmlFor="organizationName">Nombre de la Organizacion *</Label>
        <Input
          id="organizationName"
          value={formData.organizationName}
          onChange={(e) => handleOrgNameChange(e.target.value)}
          placeholder="Ej: FECOR"
          required
        />
      </div>

      {/* Slug */}
      <div className="space-y-2">
        <Label htmlFor="slug">URL Personalizada *</Label>
        <div className="flex gap-2">
          <Input
            id="slug"
            value={formData.slug}
            onChange={(e) =>
              setFormData({
                ...formData,
                slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
              })
            }
            placeholder="ej: fecor"
            required
          />
          {formData.slug && formData.isPublic && (
            <Button variant="outline" size="icon" asChild>
              <Link href={`/${formData.slug}`} target="_blank">
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
        {formData.slug && (
          <p className="text-sm text-muted-foreground">
            Tu perfil: mistorneos.co/{formData.slug}
          </p>
        )}
      </div>

      {/* Logo */}
      <div className="space-y-2">
        <Label>Logo de la Organizacion</Label>
        <p className="text-sm text-muted-foreground">
          Tamano recomendado: 512x512px. Formato: PNG o JPG. Maximo 2MB.
        </p>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          onChange={handleLogoUpload}
          className="hidden"
        />
        {formData.logoUrl ? (
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 rounded-lg border bg-muted/30 overflow-hidden flex-shrink-0">
              <img
                src={formData.logoUrl}
                alt="Logo"
                className="w-full h-full object-contain p-1"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
              >
                <Upload className="h-3.5 w-3.5 mr-1" />
                {uploadingLogo ? "Subiendo..." : "Cambiar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFormData({ ...formData, logoUrl: "" })}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Quitar
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            disabled={uploadingLogo}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            <Upload className="h-4 w-4" />
            {uploadingLogo ? "Subiendo..." : "Subir logo"}
          </button>
        )}
      </div>

      {/* Bio */}
      <div className="space-y-2">
        <Label htmlFor="bio">Descripcion</Label>
        <Textarea
          id="bio"
          value={formData.bio || ""}
          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
          placeholder="Describe tu organizacion..."
          rows={4}
        />
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label htmlFor="location">Ubicacion</Label>
        <Input
          id="location"
          value={formData.location || ""}
          onChange={(e) =>
            setFormData({ ...formData, location: e.target.value })
          }
          placeholder="Ej: San Jose, Costa Rica"
        />
      </div>

      {/* Founded Year */}
      <div className="space-y-2">
        <Label htmlFor="foundedYear">Ano de Fundacion</Label>
        <Input
          id="foundedYear"
          type="number"
          value={formData.foundedYear || ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              foundedYear: parseInt(e.target.value) || undefined,
            })
          }
          placeholder="Ej: 2010"
          min="1900"
          max={new Date().getFullYear()}
        />
      </div>

      {/* Social Links */}
      <div className="space-y-4">
        <Label>Redes Sociales</Label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="website" className="text-sm">
              Sitio Web
            </Label>
            <Input
              id="website"
              value={formData.socialLinks?.website || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  socialLinks: {
                    ...formData.socialLinks,
                    website: e.target.value,
                  },
                })
              }
              placeholder="https://..."
              type="url"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="facebook" className="text-sm">
              Facebook
            </Label>
            <Input
              id="facebook"
              value={formData.socialLinks?.facebook || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  socialLinks: {
                    ...formData.socialLinks,
                    facebook: e.target.value,
                  },
                })
              }
              placeholder="usuario"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instagram" className="text-sm">
              Instagram
            </Label>
            <Input
              id="instagram"
              value={formData.socialLinks?.instagram || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  socialLinks: {
                    ...formData.socialLinks,
                    instagram: e.target.value,
                  },
                })
              }
              placeholder="@usuario"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="twitter" className="text-sm">
              Twitter / X
            </Label>
            <Input
              id="twitter"
              value={formData.socialLinks?.twitter || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  socialLinks: {
                    ...formData.socialLinks,
                    twitter: e.target.value,
                  },
                })
              }
              placeholder="@usuario"
            />
          </div>
        </div>
      </div>

      {/* Sponsors */}
      <div className="space-y-4">
        <Label>Patrocinadores</Label>
        <p className="text-sm text-muted-foreground">
          Los patrocinadores se mostraran en tu perfil publico y en todos tus torneos
        </p>
        <SponsorForm
          sponsors={formData.sponsors || []}
          onChange={(sponsors) => setFormData({ ...formData, sponsors })}
        />
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Guardando..." : "Guardar Cambios"}
      </Button>
    </form>
  );
}
