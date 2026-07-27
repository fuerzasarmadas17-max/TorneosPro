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
  CalendarClock,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AuthGuard } from "@/components/auth-guard";
import { TournamentList } from "@/components/tournaments/tournament-list";
import { AnalyticsCards } from "@/components/analytics/analytics-cards";
import { ViewsChart } from "@/components/analytics/views-chart";
import { TournamentViews } from "@/components/analytics/tournament-views";
import { WeeklyAgenda } from "@/components/dashboard/weekly-agenda";
import { ScheduleMatchModal } from "@/components/dashboard/schedule-match-modal";
import { ScorerLinksPanel } from "@/components/dashboard/scorer-links-panel";
import { useAuth } from "@/context/auth-context";
import { useTournaments } from "@/context/tournament-context";
import {
  useOrganizerAnalytics,
  useOrganizerTournamentViews,
} from "@/hooks/use-analytics";

const dayOptions = [7, 30, 90] as const;

function DashboardContent() {
  const { user } = useAuth();
  const { tournaments } = useTournaments();
  const [analyticsDays, setAnalyticsDays] = useState<number>(30);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scorerLinksOpen, setScorerLinksOpen] = useState(false);

  const { data: organizerAnalytics } = useOrganizerAnalytics(
    !!user?.id,
    analyticsDays
  );
  const { data: tournamentViews } = useOrganizerTournamentViews(
    user?.id,
    analyticsDays
  );

  const myTournaments = tournaments.filter((t) => t.createdBy === user?.id);
  const activeTournaments = myTournaments.filter(
    (t) => t.status === "in-progress"
  );

  const stats = {
    total: myTournaments.length,
    inProgress: activeTournaments.length,
    completed: myTournaments.filter((t) => t.status === "completed").length,
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
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

      <Tabs defaultValue="agenda" className="space-y-6">
        <TabsList>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
        </TabsList>

        {/* --- Agenda (calendario semanal) --- */}
        <TabsContent value="agenda" className="space-y-4 max-w-4xl">
          {/* En mobile el título va arriba y los botones abajo en dos
              columnas: en una sola fila, "Programar partido" no entra por
              ~4px en 360px y rompe los márgenes. */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0 space-y-0.5">
              <h2 className="text-lg font-semibold tracking-tight">
                Partidos de la semana
              </h2>
              <p className="text-sm text-muted-foreground">
                Programados en todos tus torneos en curso.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setScorerLinksOpen(true)}
                disabled={activeTournaments.length === 0}
              >
                <Link2 className="size-4" />
                Generar links
              </Button>
              <Button size="sm" onClick={() => setScheduleOpen(true)}>
                <CalendarClock className="size-4" />
                {/* Etiqueta corta en mobile: la larga desborda el botón. */}
                <span className="sm:hidden">Programar</span>
                <span className="hidden sm:inline">Programar partido</span>
              </Button>
            </div>
          </div>
          {activeTournaments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-4 py-14 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <CalendarClock className="size-6" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium">No tenés torneos en curso</p>
                  <p className="text-sm text-muted-foreground">
                    Cuando un torneo esté en curso, sus partidos aparecerán acá.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <WeeklyAgenda tournaments={activeTournaments} />
              {/* Panel de anotadores: vive acá, no dentro del modal, para que
                  el estado de lo repartido se vea sin abrir nada. También es
                  dueño del diálogo de crear que dispara el botón del header. */}
              <ScorerLinksPanel
                tournaments={activeTournaments}
                createOpen={scorerLinksOpen}
                onCreateOpenChange={setScorerLinksOpen}
              />
            </>
          )}
        </TabsContent>

        {/* --- Resumen (KPIs + analíticas + perfil + torneos) --- */}
        <TabsContent value="resumen" className="space-y-8 max-w-4xl">
          {/* Perfil público — pill compacto (solo tan ancho como su contenido) */}
          {user?.organizationProfile?.isPublic && (
            <Link
              href={`/${user.organizationProfile.slug}`}
              target="_blank"
              className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border bg-card py-1.5 pl-2 pr-3 text-sm transition-colors hover:bg-muted/50"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Globe className="size-3.5" />
              </span>
              <span className="truncate text-muted-foreground">
                Tu perfil:{" "}
                <span className="font-medium text-foreground">
                  /{user.organizationProfile.slug}
                </span>
              </span>
              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
            </Link>
          )}

          {/* Analíticas */}
          <section className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <h2 className="text-lg font-semibold tracking-tight">Analíticas</h2>
                <p className="text-sm text-muted-foreground">
                  Visitas a tu perfil público y a todos tus torneos.
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
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
            {organizerAnalytics && (
              <>
                <AnalyticsCards
                  compact
                  uniquePersons={organizerAnalytics.unique_persons ?? 0}
                  uniqueVisitors={organizerAnalytics.unique_visitors}
                  totalViews={organizerAnalytics.total_views}
                  avgDurationMs={organizerAnalytics.avg_duration_ms}
                  previous={organizerAnalytics.previous}
                  viewsByDay={organizerAnalytics.views_by_day}
                />
                <ViewsChart data={organizerAnalytics.views_by_day ?? []} />
              </>
            )}
            <TournamentViews data={tournamentViews} tournaments={myTournaments} />
          </section>

          {/* Torneos */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold tracking-tight">Mis torneos</h2>
            </div>
            {/* Conteos compactos */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard size="sm" icon={Trophy} label="Total" value={stats.total} />
              <StatCard
                size="sm"
                icon={PlayCircle}
                label="En curso"
                value={stats.inProgress}
                accent="green"
              />
              <StatCard
                size="sm"
                icon={CheckCircle2}
                label="Completados"
                value={stats.completed}
                accent="blue"
              />
            </div>
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
        </TabsContent>
      </Tabs>

      <ScheduleMatchModal
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        tournaments={activeTournaments}
      />
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
