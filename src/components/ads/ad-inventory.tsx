"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { AlertTriangle, CalendarClock, CalendarRange, Target } from "lucide-react";
import { formatCOP } from "@/lib/pricing";
import { AdTimeline } from "@/components/ads/ad-timeline";
import { AdCampaignFilters } from "@/components/ads/ad-campaign-filters";
import {
  campaignFilterCounts,
  filterCampaigns,
  EMPTY_CAMPAIGN_FILTER,
  type CampaignFilterValue,
} from "@/lib/ads/campaign-filter";
import {
  buildAdInventory,
  type InventoryCampaignInput,
  type InventoryTournamentInput,
} from "@/lib/ads/inventory";

/**
 * Inventario de publicidad: en qué torneos sale cada campaña y hasta cuándo,
 * y qué torneos están vacíos.
 *
 * Existe porque la pestaña de Campañas muestra el TARGETING ("Volleyball ·
 * Sucre · En curso"), que es una regla, no una lista de torneos. Con reglas
 * dinámicas —un torneo nuevo que cumple entra solo— no hay forma de responder
 * "¿dónde está saliendo esta campaña?" sin resolverlas.
 *
 * Todo el cálculo vive en `lib/ads/inventory`, que a su vez usa el mismo
 * módulo de emparejamiento que el endpoint del espectador. Acá solo se pinta.
 */

interface Props {
  campaigns: InventoryCampaignInput[];
  tournaments: InventoryTournamentInput[];
  /** `campaign_id → tournament_id[]` de `ad_campaign_tournaments`. */
  listMap: Record<string, string[]>;
  /** `user_id → nombre`, para el filtro por organizador de la línea de tiempo. */
  organizers: Map<string, { name: string }>;
  /** `campaign_id → estado de cobro`, para filtrar por pagadas/pendientes. */
  payStatus: Record<string, "paid" | "pending">;
  loading?: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  "in-progress": "En curso",
  upcoming: "Próximo",
  completed: "Terminado",
  draft: "Borrador",
};

function pct(share: number): string {
  const v = share * 100;
  // Un 0,4% redondeado a "0%" se lee como "no sale", que es falso.
  return v > 0 && v < 1 ? "<1%" : `${Math.round(v)}%`;
}

/** Estado de la campaña, para el encabezado del acordeón. */
function StateBadge({ live, expired }: { live: boolean; expired: boolean }) {
  if (live)
    return (
      <Badge className="gap-1 border-green-500/20 bg-green-500/10 text-green-600">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
        </span>
        Al aire
      </Badge>
    );
  if (expired)
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Vencida
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-blue-500/20 text-blue-600">
      No sale todavía
    </Badge>
  );
}

/** Aviso de vencimiento. Es la cola de renovación: lo que hay que cobrar. */
function ExpiryBadge({ daysLeft, live }: { daysLeft: number; live: boolean }) {
  if (daysLeft <= 0)
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Venció hace {Math.abs(daysLeft)} d
      </Badge>
    );
  if (!live) return null;
  const urgent = daysLeft <= 7;
  return (
    <Badge
      variant="outline"
      className={
        urgent
          ? "gap-1 border-amber-500/30 text-amber-600"
          : "gap-1 text-muted-foreground"
      }
    >
      <CalendarClock className="h-3 w-3" />
      {daysLeft === 1 ? "Vence mañana" : `Vence en ${daysLeft} d`}
    </Badge>
  );
}

export function AdInventory({
  campaigns,
  tournaments,
  listMap,
  organizers,
  payStatus,
  loading = false,
}: Props) {
  const [filter, setFilter] = useState<CampaignFilterValue>(
    EMPTY_CAMPAIGN_FILTER
  );

  const inv = useMemo(
    () => buildAdInventory(campaigns, tournaments, listMap),
    [campaigns, tournaments, listMap]
  );

  const counts = useMemo(
    () => campaignFilterCounts(campaigns, payStatus),
    [campaigns, payStatus]
  );

  /** El filtro trabaja sobre la campaña de cada fila, así que se filtran las
   *  filas por su `campaign` y se conserva el resto del cálculo. */
  const visibleRows = useMemo(() => {
    const ok = new Set(
      filterCampaigns(
        inv.byCampaign.map((r) => r.campaign),
        filter,
        payStatus
      ).map((c) => c.id)
    );
    return inv.byCampaign.filter((r) => ok.has(r.campaign.id));
  }, [inv.byCampaign, filter, payStatus]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/50" />
        ))}
      </div>
    );
  }

  return (
    <Tabs defaultValue="calendario" className="gap-4">
      <TabsList className="w-full">
        <TabsTrigger value="calendario" className="flex-1">
          <CalendarRange className="h-4 w-4" />
          Calendario
        </TabsTrigger>
        <TabsTrigger value="por-campana" className="flex-1">
          <Target className="h-4 w-4" />
          Por campaña
        </TabsTrigger>
      </TabsList>

      {/* ===================== CALENDARIO (Gantt) ===================== */}
      <TabsContent value="calendario">
        <AdTimeline
          campaigns={campaigns}
          tournaments={tournaments}
          listMap={listMap}
          organizers={organizers}
        />
      </TabsContent>

      {/* ===================== POR CAMPAÑA ===================== */}
      <TabsContent value="por-campana" className="space-y-3">
        <AdCampaignFilters
          value={filter}
          onChange={setFilter}
          counts={counts}
          shown={visibleRows.length}
        />

        {visibleRows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {inv.byCampaign.length === 0
                ? "Todavía no hay campañas."
                : "Ninguna campaña coincide con el filtro."}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {/* Acordeón y no tarjetas abiertas: con decenas de campañas la
                  lista completa obliga a scrollear para encontrar una. El
                  encabezado lleva lo que se necesita para decidir si abrirla
                  —anunciante, estado y en cuántos torneos sale—, y el detalle
                  queda a un clic. */}
              <Accordion type="multiple">
                {visibleRows.map((row) => {
                  const c = row.campaign;
                  const enCurso = row.placements.filter(
                    (p) => p.tournamentStatus === "in-progress"
                  ).length;
                  return (
                    <AccordionItem key={c.id} value={c.id}>
                      <AccordionTrigger>
                        <span className="flex flex-1 flex-wrap items-center gap-2">
                          <span
                            className={
                              row.expired ? "text-muted-foreground" : undefined
                            }
                          >
                            {c.advertiser_name}
                          </span>
                          <StateBadge live={row.live} expired={row.expired} />
                          <ExpiryBadge daysLeft={row.daysLeft} live={row.live} />
                          <span className="text-xs font-normal text-muted-foreground">
                            {row.placements.length === 0 ? (
                              <span className="text-amber-600">
                                ningún torneo
                              </span>
                            ) : row.live ? (
                              `${enCurso} torneo${enCurso === 1 ? "" : "s"} en curso`
                            ) : (
                              `${row.placements.length} torneo${
                                row.placements.length === 1 ? "" : "s"
                              }`
                            )}
                          </span>
                          <span className="ml-auto pr-1 text-xs font-normal text-muted-foreground">
                            {formatCOP(c.monthly_price)}/mes
                          </span>
                        </span>
                      </AccordionTrigger>

                      <AccordionContent className="space-y-2">
                        <div className="text-xs text-muted-foreground">
                          {c.target_mode === "list"
                            ? `Lista a mano · ${listMap[c.id]?.length ?? 0} torneo${
                                (listMap[c.id]?.length ?? 0) === 1 ? "" : "s"
                              }`
                            : "Por regla de segmentación"}
                        </div>

                        {row.placements.length === 0 ? (
                          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-500">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            No le pega a ningún torneo. El anunciante está
                            pagando por cero exposición.
                          </div>
                        ) : (
                          <>
                            <ul className="divide-y rounded-lg border">
                              {row.placements.map((p) => (
                                <li
                                  key={p.tournamentId}
                                  className="flex items-center gap-2 px-3 py-2 text-sm"
                                >
                                  <span className="truncate">
                                    {p.tournamentName}
                                  </span>
                                  {p.tournamentStatus !== "in-progress" && (
                                    <Badge
                                      variant="outline"
                                      className="flex-shrink-0 text-[10px] text-muted-foreground"
                                    >
                                      {STATUS_LABEL[p.tournamentStatus ?? ""] ??
                                        p.tournamentStatus}
                                    </Badge>
                                  )}
                                  <span className="ml-auto flex-shrink-0 font-mono text-xs text-muted-foreground">
                                    {p.share == null ? "—" : pct(p.share)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                            {row.live && (
                              <p className="text-[11px] text-muted-foreground">
                                El porcentaje es la probabilidad de que a un
                                visitante de ese torneo le toque esta pieza,
                                según lo que paga cada anunciante.
                              </p>
                            )}
                          </>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
        )}
      </TabsContent>

    </Tabs>
  );
}
