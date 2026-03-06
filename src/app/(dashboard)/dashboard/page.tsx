"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AuthGuard } from "@/components/auth-guard";
import { TournamentList } from "@/components/tournaments/tournament-list";
import { AnalyticsCards } from "@/components/analytics/analytics-cards";
import { TournamentViews } from "@/components/analytics/tournament-views";
import { useAuth } from "@/context/auth-context";
import { useTournaments } from "@/context/tournament-context";
import {
  useEntityAnalytics,
  useOrganizerTournamentViews,
} from "@/hooks/use-analytics";

const dayOptions = [7, 30, 90] as const;

function DashboardContent() {
  const { user } = useAuth();
  const { tournaments } = useTournaments();
  const [analyticsDays, setAnalyticsDays] = useState<number>(30);

  const hasPublicProfile = !!user?.organizationProfile?.isPublic;
  const { data: profileAnalytics } = useEntityAnalytics(
    hasPublicProfile ? "organization" : null,
    hasPublicProfile ? user?.id : null,
    analyticsDays
  );
  const { data: tournamentViews } = useOrganizerTournamentViews(
    user?.id,
    analyticsDays
  );

  const myTournaments = tournaments.filter(
    (t) => t.createdBy === user?.id
  );

  const stats = {
    total: myTournaments.length,
    inProgress: myTournaments.filter((t) => t.status === "in-progress").length,
    completed: myTournaments.filter((t) => t.status === "completed").length,
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Hola, {user?.name}</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus torneos desde aqui
          </p>
        </div>
        <Button asChild>
          <Link href="/tournaments/create">Crear Torneo</Link>
        </Button>
      </div>

      {/* Public profile link */}
      {user?.organizationProfile?.isPublic && (
        <div className="rounded-lg border bg-card p-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Tu perfil publico: <span className="font-medium text-foreground">/{user.organizationProfile.slug}</span>
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${user.organizationProfile.slug}`} target="_blank">
              Ver perfil
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Torneos</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">En Curso</p>
            <p className="text-3xl font-bold text-green-500">
              {stats.inProgress}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Completados</p>
            <p className="text-3xl font-bold">{stats.completed}</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Analiticas</h2>
          <div className="flex gap-1">
            {dayOptions.map((d) => (
              <Button
                key={d}
                variant={analyticsDays === d ? "default" : "outline"}
                size="sm"
                onClick={() => setAnalyticsDays(d)}
              >
                {d}d
              </Button>
            ))}
          </div>
        </div>
        {profileAnalytics && (
          <AnalyticsCards
            totalViews={profileAnalytics.total_views}
            uniqueVisitors={profileAnalytics.unique_visitors}
            avgDurationMs={profileAnalytics.avg_duration_ms}
          />
        )}
        <TournamentViews data={tournamentViews} tournaments={myTournaments} />
      </div>

      {/* Tournaments */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Mis Torneos</h2>
        {myTournaments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <p className="text-muted-foreground text-lg">
                Aun no has creado torneos
              </p>
              <Button asChild>
                <Link href="/tournaments/create">Crear mi primer torneo</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <TournamentList tournaments={myTournaments} />
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
