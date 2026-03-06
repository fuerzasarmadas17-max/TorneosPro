"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ViewsByDay {
  date: string;
  views: number;
  unique_visitors: number;
}

interface ViewsChartProps {
  data: ViewsByDay[];
}

export function ViewsChart({ data }: ViewsChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visitas por Dia</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Sin datos disponibles</p>
        </CardContent>
      </Card>
    );
  }

  const maxViews = Math.max(...data.map((d) => d.views), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Visitas por Dia</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1 h-40">
          {data.map((day) => {
            const height = (day.views / maxViews) * 100;
            const dateLabel = new Date(day.date + "T12:00:00").toLocaleDateString("es-CO", {
              day: "numeric",
              month: "short",
            });
            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center gap-1 min-w-0"
              >
                <span className="text-xs text-muted-foreground tabular-nums">
                  {day.views > 0 ? day.views : ""}
                </span>
                <div
                  className="w-full bg-primary/80 rounded-t transition-all min-h-[2px]"
                  style={{ height: `${Math.max(height, 2)}%` }}
                  title={`${dateLabel}: ${day.views} visitas, ${day.unique_visitors} unicos`}
                />
                <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                  {dateLabel}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
