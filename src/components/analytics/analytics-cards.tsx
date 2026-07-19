"use client";

import { Eye, Users, Clock } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { formatDuration } from "@/lib/analytics";

interface AnalyticsCardsProps {
  totalViews: number;
  uniqueVisitors: number;
  avgDurationMs: number;
}

export function AnalyticsCards({
  totalViews,
  uniqueVisitors,
  avgDurationMs,
}: AnalyticsCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard icon={Eye} label="Visitas" value={totalViews.toLocaleString()} />
      <StatCard
        icon={Users}
        label="Visitantes únicos"
        value={uniqueVisitors.toLocaleString()}
        accent="blue"
      />
      <StatCard
        icon={Clock}
        label="Tiempo promedio"
        value={formatDuration(avgDurationMs)}
        accent="amber"
      />
    </div>
  );
}
