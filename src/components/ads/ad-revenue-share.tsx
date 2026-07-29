"use client";

import { Fragment, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { HandCoins, Users, ChevronRight } from "lucide-react";
import { formatCOP } from "@/lib/pricing";
import {
  computeRevenueShare,
  ORGANIZER_SHARE,
  type AdCampaignOrganizerRow,
} from "@/lib/ad-analytics";

interface Props {
  /** Celdas campaña × organizador del período. */
  rows: AdCampaignOrganizerRow[];
  /** Nombre del anunciante por campaña, para no mostrar UUIDs. */
  campaignNames: Record<string, string>;
  /** `monthly_price` por campaña. Precarga el cobro del período; el admin lo
   *  puede corregir (una campaña que arrancó a mitad de mes cobra menos). */
  monthlyPrices: Record<string, number>;
  periodLabel: string;
  /** Proporción de impresiones del período que ya traen persona (0..1). */
  coverage: number;
}

/**
 * Reparto de publicidad con organizadores, POR CAMPAÑA.
 *
 * Cada campaña reparte lo que pagó entre los organizadores que le entregaron
 * audiencia a ELLA. Con un fondo único, una campaña dirigida a Córdoba le
 * pagaba al organizador más grande de la plataforma aunque no hubiera aportado
 * ni una persona a esa campaña. Ver `lib/ad-analytics.ts`.
 *
 * OJO: se calcula EN VIVO, así que cambia mientras el mes corre. El corte
 * congelado —guardar personas-día, tarifa y monto como fila inmutable a la que
 * apunta la cuenta de cobro— es lo que falta antes de prometerle una cifra a
 * alguien.
 */
export function AdRevenueShare({
  rows,
  campaignNames,
  monthlyPrices,
  periodLabel,
  coverage,
}: Props) {
  /** Solo lo que el admin corrigió a mano; el resto sale de `monthlyPrices`. */
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  /** Campañas con audiencia en el período, que son las que reparten. */
  const campaignIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of rows) if (r.person_days > 0) ids.add(r.campaign_id);
    return [...ids];
  }, [rows]);

  const revenueOf = (id: string): number => {
    const raw = overrides[id];
    if (raw !== undefined) {
      const digits = raw.replace(/[^\d]/g, "");
      return digits ? parseInt(digits, 10) : 0;
    }
    return monthlyPrices[id] ?? 0;
  };

  const inputValue = (id: string): string =>
    overrides[id] ?? String(monthlyPrices[id] ?? 0);

  const share = useMemo(
    () =>
      computeRevenueShare(
        rows,
        campaignIds.map((id) => ({ campaignId: id, amountCop: revenueOf(id) }))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, campaignIds, overrides, monthlyPrices]
  );

  const nameOf = (id: string) => campaignNames[id] ?? "Campaña eliminada";

  if (campaignIds.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <HandCoins className="h-4 w-4 text-emerald-600" />
            Reparto con organizadores
            <span className="font-normal text-muted-foreground">
              · {periodLabel}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-1.5 h-4 w-4" />
            Todavía no hay personas-día en este período. Aparecen cuando los
            espectadores vean publicidad en torneos con organizador.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <HandCoins className="h-4 w-4 text-emerald-600" />
          Reparto con organizadores
          <span className="font-normal text-muted-foreground">
            · {periodLabel}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {coverage < 0.99 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <p className="font-medium text-amber-700">
              No liquidar con estas cifras todavía
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Solo el {Math.round(coverage * 100)}% de las impresiones del
              período tienen persona identificada, así que las personas-día
              están subestimadas — y no parejo entre organizadores.
            </p>
          </div>
        )}

        {/* ---- Cobro por campaña ---- */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Cobrado por campaña en el período</p>
          <p className="text-xs text-muted-foreground">
            Precargado con el precio mensual de cada campaña. Corrígelo si
            estuvo al aire solo parte del período o si cobraste otra cosa.
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaña</TableHead>
                  <TableHead className="text-right">Cobrado</TableHead>
                  <TableHead className="text-right">
                    Para organizadores
                  </TableHead>
                  <TableHead className="text-right">Personas-día</TableHead>
                  <TableHead className="text-right">$/pers-día</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {share.perCampaign.map((c) => (
                  <TableRow key={c.campaignId}>
                    <TableCell className="font-medium">
                      {nameOf(c.campaignId)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        inputMode="numeric"
                        value={inputValue(c.campaignId)}
                        onChange={(e) =>
                          setOverrides((o) => ({
                            ...o,
                            [c.campaignId]: e.target.value,
                          }))
                        }
                        className="ml-auto h-8 w-28 text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCOP(c.poolCop)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.personDays.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.poolCop > 0
                        ? formatCOP(Math.round(c.ratePerPersonDay))
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Cada campaña tiene su propia tarifa por persona-día, y eso es
            correcto: una campaña departamental chica paga más por persona que
            una nacional grande, porque su bolsa se divide entre menos
            audiencia.
          </p>
        </div>

        {/* ---- Resumen de plata ---- */}
        <div className="flex flex-wrap gap-6 rounded-lg border bg-muted/30 p-3">
          <div>
            <p className="text-xs text-muted-foreground">
              Para organizadores ({Math.round(ORGANIZER_SHARE * 100)}%)
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {formatCOP(share.poolCop)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">A transferir</p>
            <p className="text-lg font-semibold tabular-nums text-emerald-600">
              {formatCOP(share.payableCop)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              Queda con la plataforma
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {formatCOP(share.retainedCop)}
            </p>
          </div>
        </div>

        {share.retainedCop > 0 && (
          <p className="text-xs text-muted-foreground">
            Lo retenido es la parte de organizadores que no participan del
            reparto. No se redistribuye entre los demás: cada uno cobra su
            aporte real, ni más ni menos.
          </p>
        )}

        {/* ---- Por organizador ---- */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Por organizador</p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organizador</TableHead>
                  <TableHead className="text-right">Campañas</TableHead>
                  <TableHead className="text-right">A transferir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {share.organizers.map((o) => (
                  <Fragment key={o.organizerId}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() =>
                        setExpanded((e) =>
                          e === o.organizerId ? null : o.organizerId
                        )
                      }
                    >
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-1.5">
                          <ChevronRight
                            className={
                              "h-3.5 w-3.5 text-muted-foreground transition-transform " +
                              (expanded === o.organizerId ? "rotate-90" : "")
                            }
                          />
                          {o.organizerName || "Organizador sin nombre"}
                          {!o.eligible && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-normal"
                            >
                              {o.reason}
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {o.slices.length}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {o.eligible ? (
                          formatCOP(o.totalCop)
                        ) : (
                          <span className="text-muted-foreground">
                            {formatCOP(0)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Desglose: en qué campaña ganó qué. Sin esto, un total
                        sin explicación es imposible de auditar cuando el
                        organizador pregunta de dónde salió. */}
                    {expanded === o.organizerId &&
                      o.slices
                        .slice()
                        .sort((a, b) => b.amountCop - a.amountCop)
                        .map((s) => (
                          <TableRow
                            key={o.organizerId + s.campaignId}
                            className="bg-muted/30 text-xs"
                          >
                            <TableCell className="pl-9 text-muted-foreground">
                              {nameOf(s.campaignId)} ·{" "}
                              {s.personDays.toLocaleString()} pers-día ·{" "}
                              {(s.share * 100).toFixed(1)}%
                            </TableCell>
                            <TableCell />
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {o.eligible
                                ? formatCOP(s.amountCop)
                                : `(${formatCOP(s.wouldBeCop)})`}
                            </TableCell>
                          </TableRow>
                        ))}
                  </Fragment>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>Total a transferir</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {formatCOP(share.payableCop)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Cálculo en vivo: mientras el mes corra, estas cifras cambian. El corte
          mensual congelado y el estado de la cuenta de cobro son lo que falta.
        </p>
      </CardContent>
    </Card>
  );
}
