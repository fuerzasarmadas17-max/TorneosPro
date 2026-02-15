"use client";

import { useParams, notFound } from "next/navigation";
import { useState, useEffect } from "react";
import { User } from "@/types";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileTournaments } from "@/components/profile/profile-tournaments";
import { SponsorBanner } from "@/components/sponsors/sponsor-banner";
import { getUserBySlug } from "@/data/users";
import { useTournaments } from "@/context/tournament-context";

export default function ProfilePage() {
  const params = useParams<{ slug: string }>();
  const { tournaments } = useTournaments();
  const [user, setUser] = useState<User | undefined>(undefined);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Run after mount so localStorage is available and profiles are synced
    const found = getUserBySlug(params.slug);
    setUser(found);
    setChecked(true);
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
      {user.organizationProfile.sponsors && user.organizationProfile.sponsors.length > 0 && (
        <div className="container mx-auto px-4 pt-6">
          <SponsorBanner sponsors={user.organizationProfile.sponsors} />
        </div>
      )}
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
