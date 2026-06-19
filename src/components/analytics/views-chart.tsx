"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ViewsByDay {
  date: string;
  views: number;
  unique_visitors: number;
}

interface ViewsChartProps {
  data: ViewsByDay[];
}

const W = 760;
const H = 220;
const PAD = { l: 10, r: 10, t: 18, b: 26 };
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;

function fmtDate(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
  });
}

// Catmull-Rom → curva Bézier suave para que la línea no quede quebrada.
function smoothPath(pts: [number, number][]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export function ViewsChart({ data }: ViewsChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

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

  const n = data.length;
  const maxViews = Math.max(...data.map((d) => d.views), 1);
  const x = (i: number) =>
    PAD.l + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD.t + plotH * (1 - v / maxViews);

  const viewsPts = data.map((d, i) => [x(i), y(d.views)] as [number, number]);
  const uniqPts = data.map(
    (d, i) => [x(i), y(d.unique_visitors)] as [number, number]
  );
  const viewsLine = smoothPath(viewsPts);
  const uniqLine = smoothPath(uniqPts);
  const areaPath = `${viewsLine} L ${x(n - 1)} ${PAD.t + plotH} L ${x(0)} ${
    PAD.t + plotH
  } Z`;

  const gridVals = [0, Math.round(maxViews / 2), maxViews];
  const labelEvery = Math.max(1, Math.ceil(n / 8));

  const onMove = (e: React.MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((relX - PAD.l) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const totalViews = data.reduce((s, d) => s + d.views, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Visitas por Dia</span>
          <div className="flex items-center gap-4 text-xs font-normal text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" /> Visitas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/50" /> Unicos
            </span>
            <span className="tabular-nums">{totalViews} total</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          ref={wrapRef}
          className="relative"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            style={{ aspectRatio: `${W} / ${H}` }}
          >
            <defs>
              <linearGradient id="viewsArea" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="currentColor"
                  stopOpacity="0.22"
                />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Gridlines + valores del eje Y */}
            {gridVals.map((v, i) => (
              <g key={i}>
                <line
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={y(v)}
                  y2={y(v)}
                  stroke="currentColor"
                  strokeOpacity={0.12}
                  className="text-muted-foreground"
                />
                <text
                  x={W - PAD.r}
                  y={y(v) - 3}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px] tabular-nums"
                >
                  {v}
                </text>
              </g>
            ))}

            {/* Area + lineas */}
            <path d={areaPath} fill="url(#viewsArea)" className="text-primary" />
            <path
              d={uniqLine}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              strokeLinejoin="round"
              strokeLinecap="round"
              className="text-muted-foreground/60"
            />
            <path
              d={viewsLine}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="text-primary"
            />

            {/* Hover: guia vertical + punto */}
            {hover !== null && (
              <g>
                <line
                  x1={x(hover)}
                  x2={x(hover)}
                  y1={PAD.t}
                  y2={PAD.t + plotH}
                  stroke="currentColor"
                  strokeOpacity={0.25}
                  className="text-muted-foreground"
                />
                <circle
                  cx={x(hover)}
                  cy={y(data[hover].views)}
                  r={4.5}
                  className="fill-primary"
                  stroke="white"
                  strokeWidth={2}
                />
              </g>
            )}

            {/* Etiquetas eje X */}
            {data.map((d, i) =>
              i % labelEvery === 0 || i === n - 1 ? (
                <text
                  key={d.date}
                  x={x(i)}
                  y={H - 8}
                  textAnchor={
                    i === 0 ? "start" : i === n - 1 ? "end" : "middle"
                  }
                  className="fill-muted-foreground text-[10px]"
                >
                  {fmtDate(d.date)}
                </text>
              ) : null
            )}
          </svg>

          {/* Tooltip */}
          {hover !== null && (
            <div
              className="pointer-events-none absolute -translate-x-1/2 rounded-md border bg-popover px-2.5 py-1.5 shadow-md"
              style={{ left: `${(x(hover) / W) * 100}%`, top: 0 }}
            >
              <div className="text-xs font-medium">
                {fmtDate(data[hover].date)}
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                {data[hover].views} visitas · {data[hover].unique_visitors}{" "}
                unicos
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
