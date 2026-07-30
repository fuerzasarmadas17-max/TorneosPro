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
  compact = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  accent?: keyof typeof accentBox;
  current?: number;
  previous?: number;
  series?: number[];
  compact?: boolean;
}) {
  const hasDelta = current !== undefined && previous !== undefined;
  return (
    <Card>
      <CardContent className={cn("flex flex-col", compact ? "gap-2 p-4" : "gap-3 p-5")}>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-lg",
              compact ? "size-7" : "size-9",
              accentBox[accent]
            )}
          >
            <Icon className={compact ? "size-3.5" : "size-4"} />
          </div>
          <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>{label}</p>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className={cn("truncate font-bold tracking-tight", compact ? "text-xl" : "text-2xl")}>{value}</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              {hasDelta && <Delta current={current} previous={previous} />}
              {hint && !compact && (
                <span className="truncate text-xs text-muted-foreground/70">{hint}</span>
              )}
            </div>
          </div>
          {series && series.length >= 2 && (
            <div
              className={cn(
                "shrink-0",
                accentSpark[accent],
                // La sparkline es decorativa: en mobile compacto se lleva 56px
                // de una tarjeta de ~138px y deja el número recortado ("12…").
                // El valor manda, así que abajo de sm la escondemos.
                compact ? "hidden w-14 sm:block" : "w-20"
              )}
            >
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
  /** Personas-día: pares (persona, día) distintos del período. Es la unidad
   *  con la que se le paga al organizador por publicidad, así que conviene que
   *  la vea también acá y no tenga que traducir entre dos números.
   *
   *  Sale de sumar `views_by_day[].unique_persons`, y no es una aproximación:
   *  contar pares (persona, día) distintos es exactamente lo mismo que, para
   *  cada día, contar personas distintas y sumar. */
  personDays: number;
  totalViews: number;
  avgDurationMs: number;
  /** Totales del período anterior, para mostrar deltas ▲/▼. */
  previous?: PeriodTotals;
  /** Serie diaria, para las sparklines de cada tarjeta. */
  viewsByDay?: ViewsByDay[];
  /** Versión compacta (dashboard): tarjetas más chicas. */
  compact?: boolean;
}

export function AnalyticsCards({
  uniquePersons,
  personDays,
  totalViews,
  avgDurationMs,
  previous,
  viewsByDay,
  compact = false,
}: AnalyticsCardsProps) {
  // "Cada persona volvió N días" — lo que de verdad dice si el torneo engancha.
  const daysPerPerson =
    uniquePersons > 0 ? (personDays / uniquePersons).toFixed(1) : null;

  return (
    <div className={cn("grid gap-3", compact ? "grid-cols-2 lg:grid-cols-4" : "gap-4 sm:grid-cols-2 lg:grid-cols-4")}>
      <MetricCard
        icon={Users}
        label="Personas"
        value={uniquePersons.toLocaleString()}
        hint="gente distinta"
        accent="blue"
        current={uniquePersons}
        previous={previous?.unique_persons}
        series={viewsByDay?.map((d) => d.unique_persons)}
        compact={compact}
      />
      {/* Reemplazó a "Sesiones", que era el sustituto de "personas" en la época
          en que no existía `visitor_id`. Ya no responde nada que el organizador
          se pregunte: "tuve 2.049 sesiones" no le sirve, "cada persona volvió
          4,7 días" sí. Y esta es además la unidad con la que se le paga.

          Sin delta a propósito: el período anterior no viene en la serie diaria,
          y comparar contra un pasado sin `visitor_id` daría "nuevo" por otro mes.
          Cuando la comparación tenga sentido se agrega a las RPC. */}
      <MetricCard
        icon={Activity}
        label="Personas-día"
        value={personDays.toLocaleString()}
        hint={daysPerPerson ? `vuelven ${daysPerPerson} días c/u` : "por día"}
        series={viewsByDay?.map((d) => d.unique_persons)}
        compact={compact}
      />
      <MetricCard
        icon={Eye}
        label="Visitas"
        value={totalViews.toLocaleString()}
        hint="cargas de página"
        current={totalViews}
        previous={previous?.total_views}
        series={viewsByDay?.map((d) => d.views)}
        compact={compact}
      />
      <MetricCard
        icon={Clock}
        label="Tiempo promedio"
        value={formatDuration(avgDurationMs)}
        hint="por visita"
        accent="amber"
        current={avgDurationMs}
        previous={previous?.avg_duration_ms}
        compact={compact}
      />
    </div>
  );
}
