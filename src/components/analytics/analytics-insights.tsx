"use client";

export interface Insight {
  emoji: string;
  text: string;
}

/** Fila de conclusiones en lenguaje natural. Presentacional: recibe los insights ya calculados. */
export function AnalyticsInsights({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {insights.map((ins, i) => (
        <div
          key={i}
          className="flex items-start gap-2.5 rounded-lg border bg-muted/30 px-3 py-2.5"
        >
          <span className="mt-0.5 text-base leading-none">{ins.emoji}</span>
          <p className="text-sm text-foreground/90">{ins.text}</p>
        </div>
      ))}
    </div>
  );
}

const WEEKDAYS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

/** Insight de crecimiento comparando un total actual vs el anterior. */
export function growthInsight(
  current: number,
  previous: number | undefined,
  noun = "visitas"
): Insight | null {
  if (previous === undefined || previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct >= 5) return { emoji: "📈", text: `Tus ${noun} crecieron ${pct}% vs el período anterior` };
  if (pct <= -5) return { emoji: "📉", text: `Tus ${noun} bajaron ${Math.abs(pct)}% vs el período anterior` };
  return { emoji: "➡️", text: `Tus ${noun} se mantuvieron estables (${pct >= 0 ? "+" : ""}${pct}%)` };
}

/** Insight de día pico a partir de una serie diaria [{date, views}]. */
export function peakDayInsight(
  series: { date: string; views: number }[]
): Insight | null {
  if (series.length < 5) return null;
  const byWeekday = new Array(7).fill(0);
  for (const d of series) byWeekday[new Date(d.date + "T12:00:00").getDay()] += d.views;
  const peak = byWeekday.indexOf(Math.max(...byWeekday));
  if (byWeekday[peak] <= 0) return null;
  return { emoji: "📅", text: `El ${WEEKDAYS[peak]} es tu día de más tráfico` };
}
