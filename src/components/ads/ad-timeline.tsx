"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { formatCOP } from "@/lib/pricing";
import { SPORTS } from "@/data/sports";
import { TOURNAMENT_COLORS } from "@/lib/tournament-colors";
import {
  buildAdTimeline,
  type InventoryCampaignInput,
  type InventoryTournamentInput,
} from "@/lib/ads/inventory";

/**
 * Línea de tiempo de publicidad, tipo Gantt.
 *
 * A la izquierda los torneos, arriba los meses, y por cada torneo una barra por
 * campaña que va desde que arranca hasta que vence. De un vistazo se ve cuántas
 * publicidades tiene cada torneo AL MISMO TIEMPO y en qué tramos del calendario
 * queda descubierto — que es lo que una tabla de "cuántas tiene hoy" no puede
 * mostrar.
 *
 * El cálculo está en `lib/ads/inventory`; acá solo se pinta y se filtra.
 */

interface Props {
  campaigns: InventoryCampaignInput[];
  tournaments: InventoryTournamentInput[];
  listMap: Record<string, string[]>;
  /** `user_id → nombre del organizador`, para el filtro. */
  organizers: Map<string, { name: string }>;
  loading?: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  "in-progress": "En curso",
  upcoming: "Próximo",
  completed: "Terminado",
  draft: "Borrador",
};

/** Ancho mínimo de cada mes. Por debajo de esto las barras no se leen, así que
 *  la grilla scrollea en horizontal en vez de comprimirse. */
const MIN_MONTH_PX = 96;
const LANE_H = 22;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
}

export function AdTimeline({
  campaigns,
  tournaments,
  listMap,
  organizers,
  loading = false,
}: Props) {
  const [onlyLive, setOnlyLive] = useState(true);
  const [sport, setSport] = useState("all");
  const [organizer, setOrganizer] = useState("all");
  const [query, setQuery] = useState("");
  /** Cuántas campañas tiene el torneo: "all" | "0" | "1" | "2" | "3+" */
  const [count, setCount] = useState("all");

  // El filtro de campañas activas se aplica ANTES de construir la línea: así el
  // eje de meses se encoge a lo que queda visible en vez de dejar meses vacíos
  // arrastrados por una campaña vieja que ya no se está mirando.
  const shownCampaigns = useMemo(
    () =>
      onlyLive
        ? campaigns.filter(
            (c) =>
              c.is_active &&
              new Date(c.ends_at) > new Date() &&
              new Date(c.starts_at) <= new Date()
          )
        : campaigns,
    [campaigns, onlyLive]
  );

  const shownTournaments = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tournaments.filter((t) => {
      if (sport !== "all" && t.sport !== sport) return false;
      if (organizer !== "all" && t.createdBy !== organizer) return false;
      if (q && !t.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tournaments, sport, organizer, query]);

  const timeline = useMemo(
    () => buildAdTimeline(shownCampaigns, shownTournaments, listMap),
    [shownCampaigns, shownTournaments, listMap]
  );

  /** Color estable por campaña, del mismo set categórico de la agenda. */
  const colorOf = useMemo(() => {
    const ids = [...campaigns].map((c) => c.id).sort();
    const map = new Map<string, string>();
    ids.forEach((id, i) =>
      map.set(id, TOURNAMENT_COLORS[i % TOURNAMENT_COLORS.length])
    );
    return map;
  }, [campaigns]);

  const sportsPresent = useMemo(() => {
    const keys = new Set(tournaments.map((t) => t.sport).filter(Boolean));
    return SPORTS.filter((s) => keys.has(s.key));
  }, [tournaments]);

  const organizersPresent = useMemo(() => {
    const ids = new Set(
      tournaments.map((t) => t.createdBy).filter(Boolean) as string[]
    );
    return [...ids]
      .map((id) => ({ id, name: organizers.get(id)?.name ?? "(sin nombre)" }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [tournaments, organizers]);

  const gridWidth = Math.max(100, timeline.months.length * MIN_MONTH_PX);

  /**
   * Cuántos torneos hay con 0, 1, 2 y 3+ campañas.
   *
   * Se cuenta sobre las barras VISIBLES, no sobre todas las campañas del
   * torneo: así el número siempre coincide con lo que se ve en la fila. Con
   * "solo activas" prendido, "2 campañas" significa dos al aire hoy; con
   * "todas", dos que pasaron por ahí en el período del eje.
   */
  const distribution = useMemo(() => {
    const d = { 0: 0, 1: 0, 2: 0, "3+": 0 } as Record<string, number>;
    for (const r of timeline.rows) {
      const n = r.bars.length;
      d[n >= 3 ? "3+" : String(n)]++;
    }
    return d;
  }, [timeline.rows]);

  /**
   * Filtra las filas DESPUÉS de construir la línea de tiempo, a propósito: así
   * el eje de meses no se mueve al cambiar el filtro. Si se recalculara, filtrar
   * a "sin publicidad" dejaría el eje sin campañas y el calendario se
   * desarmaría justo cuando querés comparar contra las fechas.
   */
  const visibleRows = useMemo(() => {
    if (count === "all") return timeline.rows;
    return timeline.rows.filter((r) =>
      count === "3+" ? r.bars.length >= 3 : r.bars.length === Number(count)
    );
  }, [timeline.rows, count]);

  /** Torneos en curso que no llevan ni una campaña: el inventario sin vender. */
  const gaps = visibleRows.filter(
    (r) => r.bars.length === 0 && r.tournament.status === "in-progress"
  ).length;

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/50" />
        ))}
      </div>
    );
  }

  const clearable =
    sport !== "all" ||
    organizer !== "all" ||
    query.trim() !== "" ||
    count !== "all" ||
    !onlyLive;

  return (
    <div className="space-y-3">
      {/* ---------- Filtros ---------- */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-3">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar torneo…"
              className="pl-8"
            />
          </div>

          <Select value={sport} onValueChange={setSport}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Deporte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los deportes</SelectItem>
              {sportsPresent.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={organizer} onValueChange={setOrganizer}>
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Organizador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los organizadores</SelectItem>
              {organizersPresent.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={count} onValueChange={setCount}>
            <SelectTrigger className="w-[185px]">
              <SelectValue placeholder="Cuántas campañas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                Cualquier cantidad ({timeline.rows.length})
              </SelectItem>
              <SelectItem value="0">
                Sin publicidad ({distribution["0"]})
              </SelectItem>
              <SelectItem value="1">1 campaña ({distribution["1"]})</SelectItem>
              <SelectItem value="2">2 campañas ({distribution["2"]})</SelectItem>
              <SelectItem value="3+">
                3 o más ({distribution["3+"]})
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant={onlyLive ? "default" : "outline"}
            onClick={() => setOnlyLive((v) => !v)}
          >
            {onlyLive ? "Solo activas" : "Todas las campañas"}
          </Button>

          {clearable && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSport("all");
                setOrganizer("all");
                setQuery("");
                setCount("all");
                setOnlyLive(true);
              }}
            >
              <X className="h-4 w-4" />
              Limpiar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ---------- Grilla ---------- */}
      <Card>
        <CardContent className="p-0">
          {timeline.empty || visibleRows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {tournaments.length === 0
                ? "No hay torneos."
                : shownCampaigns.length === 0
                  ? "No hay campañas activas. Probá con “Todas las campañas”."
                  : "Ningún torneo coincide con el filtro."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-max">
                {/* Encabezado de meses */}
                <div className="sticky top-0 z-20 flex border-b bg-card">
                  <div className="sticky left-0 z-30 w-[220px] flex-shrink-0 border-r bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
                    {visibleRows.length} torneo
                    {visibleRows.length === 1 ? "" : "s"}
                    {gaps > 0 && (
                      <span className="ml-1 text-amber-600">
                        · {gaps} vacío{gaps === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <div
                    className="relative flex"
                    style={{ width: gridWidth }}
                  >
                    {timeline.months.map((m, i) => (
                      <div
                        key={m.key}
                        className="border-r py-2 text-center text-xs font-medium last:border-r-0"
                        style={{ width: `${m.widthPct}%` }}
                      >
                        {m.label}
                        {(i === 0 ||
                          timeline.months[i - 1].year !== m.year) && (
                          <span className="ml-1 text-muted-foreground">
                            {String(m.year).slice(2)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Filas */}
                {visibleRows.map((row) => (
                  <div
                    key={row.tournament.id}
                    className="flex border-b last:border-b-0 hover:bg-muted/30"
                  >
                    <div className="sticky left-0 z-10 w-[220px] flex-shrink-0 border-r bg-card px-3 py-2">
                      <div className="truncate text-sm" title={row.tournament.name}>
                        {row.tournament.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">
                          {STATUS_LABEL[row.tournament.status ?? ""] ??
                            row.tournament.status}
                        </span>
                        {row.bars.length === 0 &&
                          row.tournament.status === "in-progress" && (
                            <Badge
                              variant="outline"
                              className="h-4 border-amber-500/30 px-1 text-[9px] text-amber-600"
                            >
                              vacío
                            </Badge>
                          )}
                      </div>
                    </div>

                    <div
                      className="relative py-1.5"
                      style={{
                        width: gridWidth,
                        height: row.lanes * LANE_H + 12,
                      }}
                    >
                      {/* Líneas de mes, para poder leer dónde empieza cada barra */}
                      {timeline.months.map((m, i) => {
                        const left = timeline.months
                          .slice(0, i)
                          .reduce((s, x) => s + x.widthPct, 0);
                        return (
                          <div
                            key={m.key}
                            className="absolute inset-y-0 border-r border-border/50 last:border-r-0"
                            style={{ left: `${left}%`, width: `${m.widthPct}%` }}
                          />
                        );
                      })}

                      {/* Sin publicidad: franja rayada a lo ancho de la fila.
                          El vacío tiene que VERSE, no deducirse de la ausencia
                          de barras — es el inventario que queda por vender. */}
                      {row.bars.length === 0 && (
                        <div
                          className="absolute inset-x-0 flex items-center justify-center rounded"
                          style={{
                            top: 6,
                            height: LANE_H - 4,
                            backgroundImage:
                              "repeating-linear-gradient(45deg, var(--muted) 0 6px, transparent 6px 12px)",
                            border: "1px dashed var(--border)",
                          }}
                        >
                          <span className="text-[10px] text-muted-foreground">
                            sin publicidad
                          </span>
                        </div>
                      )}

                      {/* Hoy */}
                      {timeline.todayPct != null && (
                        <div
                          className="absolute inset-y-0 z-10 w-px bg-red-500/60"
                          style={{ left: `${timeline.todayPct}%` }}
                        />
                      )}

                      {/* Barras */}
                      {row.bars.map((b) => (
                        <div
                          key={b.campaignId}
                          className="absolute flex items-center gap-1 overflow-hidden rounded px-1.5 text-[10px] font-medium text-white"
                          style={{
                            left: `${b.leftPct}%`,
                            width: `${b.widthPct}%`,
                            top: b.lane * LANE_H + 6,
                            height: LANE_H - 4,
                            backgroundColor: colorOf.get(b.campaignId),
                            opacity: b.live ? 1 : 0.45,
                            // Rayada si no está al aire: se distingue de una
                            // campaña viva incluso sin comparar opacidades.
                            backgroundImage: b.live
                              ? undefined
                              : "repeating-linear-gradient(45deg, rgba(255,255,255,.35) 0 4px, transparent 4px 8px)",
                          }}
                          title={`${b.advertiserName}\n${fmtDate(
                            b.startsAt
                          )} → ${fmtDate(b.endsAt)}\n${formatCOP(
                            b.monthlyPrice
                          )}/mes${b.live ? "" : b.expired ? "\nVENCIDA" : "\nNo sale todavía"}`}
                        >
                          <span className="truncate">{b.advertiserName}</span>
                          {b.widthPct > 12 && (
                            <span className="ml-auto flex-shrink-0 opacity-80">
                              {formatCOP(b.monthlyPrice)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        Cada barra es una campaña, del día que arranca al día que vence. La línea
        roja es hoy. Las barras translúcidas son campañas que no están al aire
        (vencidas, pausadas o que todavía no arrancaron). Pasá el mouse por una
        barra para ver fechas y precio.
      </p>
    </div>
  );
}
