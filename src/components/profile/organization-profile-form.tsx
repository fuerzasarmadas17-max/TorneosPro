"use client";

import { useState, useEffect } from "react";
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
import { ExternalLink } from "lucide-react";
import { SponsorForm } from "@/components/sponsors/sponsor-form";

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

  const handleSubmit = (e: React.FormEvent) => {
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

    const result = updateOrganizationProfile(formData);

    if (result.success) {
      toast.success("Perfil actualizado exitosamente");
    } else {
      toast.error(result.error || "Error al actualizar perfil");
    }

    setLoading(false);
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
