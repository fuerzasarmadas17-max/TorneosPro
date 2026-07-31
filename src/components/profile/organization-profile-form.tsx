"use client";

import { useRef, useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import {
  resizeImageForUpload,
  IMAGE_SIZES,
  MAX_UPLOAD_BYTES,
  isImageFile,
} from "@/lib/images";
import { OrganizationProfile } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Stepper } from "@/components/ui/stepper";

// Mismos pasos visuales que el wizard de "Crear Torneo".
const PROFILE_STEPS = [
  { label: "Identidad" },
  { label: "Detalles" },
  { label: "Patrocinadores" },
];
import { toast } from "sonner";
import { generateSlug } from "@/data/users";
import { isSlugReserved } from "@/lib/reserved-slugs";
import Link from "next/link";
import { ExternalLink, Upload, Trash2 } from "lucide-react";
import { ProfileSponsorsCuration } from "@/components/profile/profile-sponsors-curation";
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
  const [step, setStep] = useState(1);
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
    // Solo guardar en el último paso (Enter en pasos previos no envía).
    if (step < PROFILE_STEPS.length) return;
    setLoading(true);

    if (!formData.slug || formData.slug.length < 3) {
      toast.error("El slug debe tener al menos 3 caracteres");
      setStep(1);
      setLoading(false);
      return;
    }

    if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      toast.error(
        "El slug solo puede contener letras minusculas, numeros y guiones"
      );
      setStep(1);
      setLoading(false);
      return;
    }

    if (isSlugReserved(formData.slug)) {
      toast.error("Este slug está reservado, por favor elige otro");
      setStep(1);
      setLoading(false);
      return;
    }

    // La biblioteca de patrocinadores NO se gestiona acá (se gestiona en la
    // sección Logos, y la selección para el perfil vive en el flag
    // show_on_profile que persiste al toque). Pasamos sponsors: undefined para
    // que el guardado del perfil no reescriba/borre la biblioteca.
    const result = await updateOrganizationProfile({ ...formData, sponsors: undefined });

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

    if (!isImageFile(file)) {
      toast.error("El archivo debe ser una imagen (PNG, JPG, etc.)");
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("La imagen no debe superar los 12MB");
      return;
    }

    setUploadingLogo(true);
    const { blob, ext } = await resizeImageForUpload(file, {
      // PNG y no WebP: se inlinea en la tarjeta OG y Satori no decodifica
      // WebP (ver `format` en lib/images.ts).
      maxDim: IMAGE_SIZES.orgLogo,
      format: "png",
    });
    const path = `logos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from("images")
      .upload(path, blob, { contentType: blob.type });
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
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Configuración</CardTitle>
        <CardDescription>
          Personaliza el perfil público de tu organización para que otros
          encuentren tus torneos
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <Stepper steps={PROFILE_STEPS} current={step} />

          {/* ===== Paso 1 — Identidad ===== */}
          {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Información general</h3>
            <div className="grid gap-4 sm:grid-cols-2">
      {/* Organization Name */}
      <div className="space-y-2">
        <Label htmlFor="organizationName">Nombre de la Organización *</Label>
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
            </div>

      {/* Logo */}
      <div className="space-y-2">
        <Label>Logo de la Organización</Label>
        <p className="text-sm text-muted-foreground">
          Tamano recomendado: 512x512px. Formato: PNG o JPG. Lo optimizamos
          automaticamente para que cargue rapido en celulares.
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
                loading="lazy"
                decoding="async"
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
        <Label htmlFor="bio">Descripción</Label>
        <Textarea
          id="bio"
          value={formData.bio || ""}
          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
          placeholder="Describe tu organización..."
          rows={4}
        />
      </div>
          </div>
          )}

          {/* ===== Paso 2 — Detalles y redes ===== */}
          {step === 2 && (
          <div className="space-y-6">
          {/* Detalles */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Detalles</h3>
            <div className="grid gap-4 sm:grid-cols-2">
      {/* Location */}
      <div className="space-y-2">
        <Label htmlFor="location">Ubicación</Label>
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
            </div>
          </div>

          {/* Redes sociales */}
          <div className="space-y-4">
        <h3 className="font-semibold text-lg">Redes sociales</h3>
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
              placeholder="usuario o URL completa"
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
              placeholder="@usuario o URL completa"
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
              placeholder="@usuario o URL completa"
            />
          </div>
        </div>
      </div>
          </div>
          )}

          {/* ===== Paso 3 — Patrocinadores del perfil ===== */}
          {step === 3 && <ProfileSponsorsCuration />}

          {/* Navegación entre pasos */}
          <div className="flex gap-2 pt-2">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep((s) => Math.max(s - 1, 1))}
              >
                Atras
              </Button>
            )}
            {step < PROFILE_STEPS.length ? (
              <Button
                type="button"
                className="flex-1"
                onClick={() => setStep((s) => Math.min(s + 1, PROFILE_STEPS.length))}
              >
                Siguiente
              </Button>
            ) : (
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Guardando..." : "Guardar Cambios"}
              </Button>
            )}
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
