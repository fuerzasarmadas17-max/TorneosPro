"use client";

import { OrganizationProfile } from "@/types";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Calendar,
  Globe,
  Facebook,
  Instagram,
  Twitter,
} from "lucide-react";

interface ProfileHeaderProps {
  profile: OrganizationProfile;
}

const socialConfig = {
  website: { icon: Globe, label: "Sitio Web", buildUrl: (v: string) => v },
  facebook: {
    icon: Facebook,
    label: "Facebook",
    buildUrl: (v: string) => `https://facebook.com/${v.replace("@", "")}`,
  },
  instagram: {
    icon: Instagram,
    label: "Instagram",
    buildUrl: (v: string) => `https://instagram.com/${v.replace("@", "")}`,
  },
  twitter: {
    icon: Twitter,
    label: "Twitter",
    buildUrl: (v: string) => `https://x.com/${v.replace("@", "")}`,
  },
} as const;

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  return (
    <div className="border-b bg-muted/30">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Logo */}
          <div className="flex-shrink-0">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-lg bg-background border-2 border-border shadow-lg flex items-center justify-center overflow-hidden">
              {profile.logoUrl ? (
                <img
                  src={profile.logoUrl}
                  alt={profile.organizationName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl md:text-5xl font-bold text-muted-foreground">
                  {profile.organizationName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 space-y-3">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">
                {profile.organizationName}
              </h1>
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                {profile.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {profile.location}
                  </div>
                )}
                {profile.foundedYear && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Desde {profile.foundedYear}
                  </div>
                )}
              </div>
            </div>

            {profile.bio && (
              <p className="text-muted-foreground max-w-2xl">{profile.bio}</p>
            )}

            {profile.socialLinks &&
              Object.keys(profile.socialLinks).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(
                    Object.entries(profile.socialLinks) as [
                      keyof typeof socialConfig,
                      string | undefined,
                    ][]
                  ).map(([platform, handle]) => {
                    if (!handle) return null;
                    const config = socialConfig[platform];
                    if (!config) return null;
                    const Icon = config.icon;
                    return (
                      <Button
                        key={platform}
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a
                          href={config.buildUrl(handle)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2"
                        >
                          <Icon className="h-4 w-4" />
                          {config.label}
                        </a>
                      </Button>
                    );
                  })}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
