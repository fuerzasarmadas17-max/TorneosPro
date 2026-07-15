"use client";

import { useParams, notFound } from "next/navigation";
import { useState, useEffect } from "react";
import { OrganizationProfile } from "@/types";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileTournaments } from "@/components/profile/profile-tournaments";
import { SponsorBanner } from "@/components/sponsors/sponsor-banner";
import { getUserBySlug } from "@/data/users";
import { useTournaments } from "@/context/tournament-context";
import { usePageView } from "@/hooks/use-page-view";

interface ProfileUser {
  id: string;
  name: string;
  isActive: boolean;
  organizationProfile: OrganizationProfile;
}

export default function ProfilePage() {
  const params = useParams<{ slug: string }>();
  const { tournaments } = useTournaments();
  const [user, setUser] = useState<ProfileUser | undefined>(undefined);
  const [checked, setChecked] = useState(false);
  usePageView("profile", user?.id, "organization");

  useEffect(() => {
    getUserBySlug(params.slug)
      .then((found) => {
        setUser(found);
        setChecked(true);
      })
      .catch(() => {
        setChecked(true);
      });
  }, [params.slug]);

  if (!checked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Cargando perfil...</p>
      </div>
    );
  }

  if (!user || !user.organizationProfile || !user.organizationProfile.isPublic || user.isActive === false) {
    notFound();
  }

  const userTournaments = tournaments.filter((t) => t.createdBy === user.id);

  return (
    <div className="min-h-screen bg-background">
      <ProfileHeader profile={user.organizationProfile} />
      {(() => {
        // El perfil público muestra SOLO los patrocinadores marcados por el
        // organizador (show_on_profile). La biblioteca completa no se publica.
        const profileSponsors = (user.organizationProfile.sponsors || []).filter(
          (s) => s.showOnProfile
        );
        return profileSponsors.length > 0 ? (
          <div className="container mx-auto px-4 pt-6">
            <SponsorBanner sponsors={profileSponsors} orgId={user.id} />
          </div>
        ) : null;
      })()}
      <div className="container mx-auto px-4 py-8">
        <ProfileTournaments
          tournaments={userTournaments}
          organizationName={user.organizationProfile.organizationName}
          slug={params.slug}
        />
      </div>
    </div>
  );
}
