"use client";

import { Card, CardContent } from "@/components/ui/card";
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
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Visitas</p>
          <p className="text-3xl font-bold">{totalViews.toLocaleString()}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Visitantes Unicos</p>
          <p className="text-3xl font-bold">
            {uniqueVisitors.toLocaleString()}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Tiempo Promedio</p>
          <p className="text-3xl font-bold">{formatDuration(avgDurationMs)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
