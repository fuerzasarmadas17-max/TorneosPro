"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminGuard } from "@/components/auth-guard";
import { AnalyticsCards } from "@/components/analytics/analytics-cards";
import { ViewsChart } from "@/components/analytics/views-chart";
import { DeviceBreakdown } from "@/components/analytics/device-breakdown";
import { ReferrerList } from "@/components/analytics/referrer-list";
import { useAdminAnalytics, OrganizerSummary } from "@/hooks/use-admin-analytics";
import { SponsorClicksPanel } from "@/components/analytics/sponsor-clicks-panel";
import { Loader2, ChevronRight, ChevronDown } from "lucide-react";

const dayOptions = [7, 30, 90] as const;

function OrganizerRow({ org }: { org: OrganizerSummary }) {
  const [expanded, setExpanded] = useState(false);

  const totalTournamentViews = org.tournaments.reduce((s, t) => s + t.views, 0);
  const totalViews = org.profile_views + totalTournamentViews;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-4 p-4 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="font-medium truncate">{org.organization_name}</span>
        </div>
        <div className="flex gap-4 text-sm text-muted-foreground whitespace-nowrap">
          <span>{org.profile_views} perfil</span>
          <span>{totalTournamentViews} torneos</span>
          <span className="font-medium text-foreground">{totalViews} total</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t bg-muted/30 px-4 py-3 space-y-2">
          {/* Profile row */}
          <div className="flex items-center justify-between text-sm pl-6">
            <span className="text-muted-foreground">Perfil del organizador</span>
            <div className="flex gap-4 text-muted-foreground whitespace-nowrap">
              <span>{org.profile_views} visitas</span>
              <span>{org.profile_unique} unicos</span>
            </div>
          </div>

          {/* Tournament rows */}
          {org.tournaments.length === 0 ? (
            <p className="text-sm text-muted-foreground pl-6">Sin torneos</p>
          ) : (
            org.tournaments.map((t) => (
              <div
                key={t.tournament_id}
                className="flex items-center justify-between text-sm pl-6"
              >
                <Link
                  href={`/tournaments/${t.tournament_id}`}
                  className="hover:underline truncate mr-2"
                >
                  {t.name}
                </Link>
                <div className="flex gap-4 text-muted-foreground whitespace-nowrap">
                  <span>{t.views} visitas</span>
                  <span>{t.unique_visitors} unicos</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AnalyticsContent() {
  const [days, setDays] = useState<number>(30);
  const [customInput, setCustomInput] = useState("");
  const { data, organizers, isLoading } = useAdminAnalytics(days);

  const applyCustom = () => {
    const n = parseInt(customInput, 10);
    if (!isNaN(n) && n >= 1) {
      setDays(Math.min(n, 730)); // tope 2 años
      setCustomInput("");
    }
  };
  const isPreset = (dayOptions as readonly number[]).includes(days);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-muted-foreground">No se pudieron cargar las analiticas</p>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analiticas</h1>
          <p className="text-muted-foreground mt-1">
            Metricas globales de la plataforma
          </p>
        </div>
        <div className="flex items-center gap-1 flex-wrap justify-end">
          {dayOptions.map((d) => (
            <Button
              key={d}
              variant={days === d ? "default" : "outline"}
              size="sm"
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
          {/* Días personalizados: escribe cualquier número y Enter */}
          <div className="flex items-center gap-1 ml-1">
            <Input
              type="number"
              min={1}
              max={730}
              placeholder={isPreset ? "Otro" : String(days)}
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyCustom();
              }}
              onBlur={applyCustom}
              className={`h-8 w-20 ${!isPreset ? "border-primary text-primary font-medium" : ""}`}
            />
            <span className="text-sm text-muted-foreground">días</span>
          </div>
        </div>
      </div>

      <AnalyticsCards
        totalViews={data.total_views}
        uniqueVisitors={data.unique_visitors}
        avgDurationMs={data.avg_duration_ms}
      />

      {/* Organizador + clics en patrocinadores: lado a lado en desktop */}
      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visitas por Organizador</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {organizers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos de organizadores</p>
            ) : (
              organizers.map((org) => (
                <OrganizerRow key={org.user_id} org={org} />
              ))
            )}
          </CardContent>
        </Card>

        {/* Clics en patrocinadores (interacciones, no solo visitas) */}
        <SponsorClicksPanel days={days} />
      </div>

      <ViewsChart data={data.views_by_day} />

      <div className="grid gap-4 md:grid-cols-2">
        <DeviceBreakdown data={data.device_breakdown} />
        <ReferrerList data={data.top_referrers} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Browser breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Navegadores</CardTitle>
          </CardHeader>
          <CardContent>
            {!data.browser_breakdown || data.browser_breakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos</p>
            ) : (
              <div className="space-y-2">
                {data.browser_breakdown.map((entry) => (
                  <div key={entry.browser} className="flex justify-between text-sm">
                    <span>{entry.browser}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {entry.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Views by page type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visitas por Seccion</CardTitle>
          </CardHeader>
          <CardContent>
            {!data.views_by_page_type || data.views_by_page_type.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos</p>
            ) : (
              <div className="space-y-2">
                {data.views_by_page_type.map((entry) => {
                  const labels: Record<string, string> = {
                    home: "Inicio",
                    browse: "Explorar Torneos",
                    tournament: "Detalle de Torneo",
                    profile: "Perfil de Organizador",
                    profile_tournament: "Torneo en Perfil",
                  };
                  return (
                    <div key={entry.page_type} className="flex justify-between text-sm">
                      <span>{labels[entry.page_type] || entry.page_type}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {entry.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <AdminGuard>
      <AnalyticsContent />
    </AdminGuard>
  );
}
