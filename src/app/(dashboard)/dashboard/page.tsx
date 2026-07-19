"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Plus,
  Trophy,
  PlayCircle,
  CheckCircle2,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
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

  const myTournaments = tournaments.filter((t) => t.createdBy === user?.id);

  const stats = {
    total: myTournaments.length,
    inProgress: myTournaments.filter((t) => t.status === "in-progress").length,
    completed: myTournaments.filter((t) => t.status === "completed").length,
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-8">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Hola, {user?.name}</h1>
          <p className="text-sm text-muted-foreground">
            Gestioná tus torneos desde acá.
          </p>
        </div>
        <Button asChild>
          <Link href="/tournaments/create">
            <Plus className="size-4" />
            Crear torneo
          </Link>
        </Button>
      </div>

      {/* Perfil público */}
      {user?.organizationProfile?.isPublic && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Globe className="size-4" />
              </div>
              <p className="text-sm text-muted-foreground truncate">
                Tu perfil público:{" "}
                <span className="font-medium text-foreground">
                  /{user.organizationProfile.slug}
                </span>
              </p>
            </div>
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <Link href={`/${user.organizationProfile.slug}`} target="_blank">
                Ver perfil
                <ExternalLink className="ml-2 size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Métricas */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Trophy} label="Total de torneos" value={stats.total} />
        <StatCard
          icon={PlayCircle}
          label="En curso"
          value={stats.inProgress}
          accent="green"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completados"
          value={stats.completed}
          accent="blue"
        />
      </div>

      {/* Analíticas */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Analíticas</h2>
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
      </section>

      {/* Torneos */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Mis torneos</h2>
        {myTournaments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-4 py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Trophy className="size-6" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">Aún no creaste torneos</p>
                <p className="text-sm text-muted-foreground">
                  Creá tu primer torneo para empezar a gestionarlo.
                </p>
              </div>
              <Button asChild>
                <Link href="/tournaments/create">
                  <Plus className="size-4" />
                  Crear mi primer torneo
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <TournamentList tournaments={myTournaments} />
        )}
      </section>
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
