"use client";

import { Eye, Users, Clock, Activity, ArrowUp, ArrowDown, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/analytics";
import type { PeriodTotals } from "@/hooks/use-analytics";

const accentBox: Record<string, string> = {
  default: "bg-muted text-muted-foreground",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-500",
  green: "bg-green-500/10 text-green-600 dark:text-green-500",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-500",
};
const accentSpark: Record<string, string> = {
  default: "text-muted-foreground",
  blue: "text-blue-500",
  green: "text-green-500",
  amber: "text-amber-500",
};

function Delta({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined) return null;
  if (previous === 0) {
    if (current === 0) return null;
    return (
      <span className="inline-flex items-center rounded-full bg-green-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-green-600 dark:text-green-500">
        nuevo
      </span>
    );
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) {
    return <span className="text-[11px] font-medium text-muted-foreground">sin cambio</span>;
  }
  const up = pct > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
        up
          ? "bg-green-500/10 text-green-600 dark:text-green-500"
          : "bg-red-500/10 text-red-600 dark:text-red-500"
      )}
    >
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(pct)}%
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "default",
  current,
  previous,
  series,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  accent?: keyof typeof accentBox;
  current?: number;
  previous?: number;
  series?: number[];
}) {
  const hasDelta = current !== undefined && previous !== undefined;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              accentBox[accent]
            )}
          >
            <Icon className="size-4" />
          </div>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-2xl font-bold tracking-tight">{value}</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              {hasDelta && <Delta current={current} previous={previous} />}
              {hint && (
                <span className="truncate text-xs text-muted-foreground/70">{hint}</span>
              )}
            </div>
          </div>
          {series && series.length >= 2 && (
            <div className={cn("w-20 shrink-0", accentSpark[accent])}>
              <SparklineInline data={series} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Sparkline inline (evita import extra y mantiene el color por accent).
function SparklineInline({ data }: { data: number[] }) {
  const W = 80;
  const H = 22;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = W / (data.length - 1);
  const pts = data.map((v, i) => [i * stepX, H - ((v - min) / range) * (H - 4) - 2] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-6 w-full" aria-hidden="true">
      <path d={`${line} L ${W} ${H} L 0 ${H} Z`} className="fill-current opacity-10" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

interface ViewsByDay {
  views: number;
  unique_visitors: number;
  unique_persons: number;
}

interface AnalyticsCardsProps {
  uniquePersons: number;
  uniqueVisitors: number;
  totalViews: number;
  avgDurationMs: number;
  /** Totales del período anterior, para mostrar deltas ▲/▼. */
  previous?: PeriodTotals;
  /** Serie diaria, para las sparklines de cada tarjeta. */
  viewsByDay?: ViewsByDay[];
}

export function AnalyticsCards({
  uniquePersons,
  uniqueVisitors,
  totalViews,
  avgDurationMs,
  previous,
  viewsByDay,
}: AnalyticsCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        icon={Users}
        label="Personas"
        value={uniquePersons.toLocaleString()}
        hint="gente distinta"
        accent="blue"
        current={uniquePersons}
        previous={previous?.unique_persons}
        series={viewsByDay?.map((d) => d.unique_persons)}
      />
      <MetricCard
        icon={Activity}
        label="Sesiones"
        value={uniqueVisitors.toLocaleString()}
        hint="visitas en 30 min"
        current={uniqueVisitors}
        previous={previous?.unique_visitors}
        series={viewsByDay?.map((d) => d.unique_visitors)}
      />
      <MetricCard
        icon={Eye}
        label="Visitas"
        value={totalViews.toLocaleString()}
        hint="cargas de página"
        current={totalViews}
        previous={previous?.total_views}
        series={viewsByDay?.map((d) => d.views)}
      />
      <MetricCard
        icon={Clock}
        label="Tiempo promedio"
        value={formatDuration(avgDurationMs)}
        hint="por visita"
        accent="amber"
        current={avgDurationMs}
        previous={previous?.avg_duration_ms}
      />
    </div>
  );
}
