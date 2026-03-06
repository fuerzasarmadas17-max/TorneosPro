"use client";

import { useParams, notFound } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrganizationProfile } from "@/types";
import { TournamentDetail } from "@/components/tournaments/tournament-detail";
import { getUserBySlug } from "@/data/users";
import { useTournaments } from "@/context/tournament-context";
import { usePageView } from "@/hooks/use-page-view";

interface ProfileUser {
  id: string;
  name: string;
  isActive: boolean;
  organizationProfile: OrganizationProfile;
}

export default function ProfileTournamentPage() {
  const params = useParams<{ slug: string; tournamentId: string }>();
  const { getTournamentById } = useTournaments();
  const [user, setUser] = useState<ProfileUser | undefined>(undefined);
  const [checked, setChecked] = useState(false);
  usePageView("profile_tournament", params.tournamentId, "tournament");

  useEffect(() => {
    getUserBySlug(params.slug).then((found) => {
      setUser(found);
      setChecked(true);
    });
  }, [params.slug]);

  if (!checked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!user || !user.organizationProfile || !user.organizationProfile.isPublic || user.isActive === false) {
    notFound();
  }

  const tournament = getTournamentById(params.tournamentId);

  if (!tournament || tournament.createdBy !== user.id) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Torneo no encontrado</h1>
        <p className="text-muted-foreground mt-2">
          Este torneo no existe o no pertenece a esta organizacion
        </p>
        <Button asChild className="mt-4">
          <Link href={`/${params.slug}`}>
            Volver al perfil de {user.organizationProfile.organizationName}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/${params.slug}`}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {user.organizationProfile.organizationName}
        </Link>
      </Button>
      <TournamentDetail tournament={tournament} canEdit={false} orgSponsors={user.organizationProfile.sponsors} />
    </div>
  );
}
