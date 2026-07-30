"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HandCoins, Users, ChevronRight, Lock, Loader2 } from "lucide-react";
import { formatCOP } from "@/lib/pricing";
import {
  computeRevenueShare,
  isMonthClosable,
  toSettlementInputs,
  ORGANIZER_SHARE,
  SETTLEMENT_STATUS_LABELS,
  type AdCampaignOrganizerRow,
  type AdSettlement,
} from "@/lib/ad-analytics";

interface Props {
  rows: AdCampaignOrganizerRow[];
  campaignNames: Record<string, string>;
  /** `monthly_price` por campaña. Solo se usa como valor inicial cuando el mes
   *  todavía no tiene un cobro registrado en `ad_period_revenue`. */
  monthlyPrices: Record<string, number>;
  periodLabel: string;
  /** Primer día del mes, o `null` si el rango no es un mes (el histórico no se
   *  puede cerrar). */
  periodMonth: string | null;
  coverage: number;
  /** Reporta hacia arriba lo que hay que transferir, para la tarjeta de
   *  resumen del panel. La cifra se calcula acá porque acá viven los cobros
   *  por campaña; duplicar el cálculo en la página sería tener dos versiones de
   *  la misma cuenta de plata. */
  onPayableChange?: (payableCop: number) => void;
}

/**
 * Reparto de publicidad con organizadores, POR CAMPAÑA, y cierre del mes.
 *
 * Cada campaña reparte lo que pagó entre los organizadores que le entregaron
 * audiencia a ELLA — con un fondo único, una campaña dirigida a Córdoba le
 * pagaba al organizador más grande de la plataforma aunque no hubiera aportado
 * ni una persona. Ver `lib/ad-analytics.ts`.
 *
 * Dos modos según el mes:
 *
 * - **Abierto:** cálculo en vivo. Los cobros por campaña se guardan en
 *   `ad_period_revenue` al salir del campo, así no se pierden al recargar.
 * - **Cerrado:** se muestra lo congelado en `ad_settlements` y NO se recalcula.
 *   Es el punto de todo esto: el número que el organizador vio el día 12 tiene
 *   que ser el mismo que se le paga.
 */
export function AdRevenueShare({
  rows,
  campaignNames,
  monthlyPrices,
  periodLabel,
  periodMonth,
  coverage,
  onPayableChange,
}: Props) {
  /** Cobro por campaña, tal como está guardado (o editándose) para este mes. */
  const [revenue, setRevenue] = useState<Record<string, string>>({});
  const [settlements, setSettlements] = useState<AdSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  /** Campañas con audiencia en el período: las que reparten. */
  const campaignIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of rows) if (r.person_days > 0) ids.add(r.campaign_id);
    return [...ids];
  }, [rows]);

  const load = useCallback(async () => {
    if (!periodMonth) {
      setSettlements([]);
      setRevenue({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const [revRes, setRes] = await Promise.all([
      supabase
        .from("ad_period_revenue")
        .select("campaign_id, amount_cop")
        .eq("period_month", periodMonth),
      supabase
        .from("ad_settlements")
        .select("*")
        .eq("period_month", periodMonth)
        .neq("status", "void"),
    ]);

    const saved: Record<string, string> = {};
    for (const r of (revRes.data ?? []) as {
      campaign_id: string;
      amount_cop: number;
    }[]) {
      saved[r.campaign_id] = String(r.amount_cop);
    }
    setRevenue(saved);
    setSettlements((setRes.data as AdSettlement[]) ?? []);
    setLoading(false);
  }, [periodMonth]);

  useEffect(() => {
    load();
  }, [load]);

  /** Lo guardado si existe; si no, el precio de lista como punto de partida. */
  const valueOf = (id: string): string =>
    revenue[id] ?? String(monthlyPrices[id] ?? 0);

  const amountOf = (id: string): number => {
    const digits = valueOf(id).replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : 0;
  };

  const persistRevenue = async (campaignId: string) => {
    if (!periodMonth) return;
    const { error } = await supabase.from("ad_period_revenue").upsert(
      {
        campaign_id: campaignId,
        period_month: periodMonth,
        amount_cop: amountOf(campaignId),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "campaign_id,period_month" }
    );
    if (error) {
      console.error("ad_period_revenue upsert falló", error);
      toast.error("No se pudo guardar el cobro: " + error.message);
    }
  };

  const share = useMemo(
    () =>
      computeRevenueShare(
        rows,
        campaignIds.map((id) => ({ campaignId: id, amountCop: amountOf(id) }))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, campaignIds, revenue, monthlyPrices]
  );

  const nameOf = (id: string) => campaignNames[id] ?? "Campaña eliminada";
  const organizerNameOf = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of rows) {
      if (r.organizer_name) map[r.organizer_id] = r.organizer_name;
    }
    return map;
  }, [rows]);

  const closed = settlements.length > 0;
  const closable = isMonthClosable(periodMonth);

  // Con el mes cerrado la cifra de arriba tiene que ser la congelada, no el
  // recálculo en vivo: si difieren, la que vale es la que se prometió.
  const payable = closed
    ? settlements.reduce((a, s) => a + s.amount_cop, 0)
    : share.payableCop;

  useEffect(() => {
    onPayableChange?.(payable);
  }, [payable, onPayableChange]);

  const handleClose = async () => {
    if (!periodMonth) return;
    const inputs = toSettlementInputs(share);
    if (inputs.length === 0) {
      toast.error("No hay nada que liquidar en este período.");
      return;
    }
    setClosing(true);
    const { data, error } = await supabase.rpc("close_ad_period", {
      p_month: periodMonth,
      p_rows: inputs,
    });
    setClosing(false);
    if (error) {
      console.error("close_ad_period falló", error);
      toast.error(error.message);
      return;
    }
    const r = data as { settlements: number; payable_cop: number };
    toast.success(
      `Mes cerrado: ${r.settlements} cortes por ${formatCOP(r.payable_cop)}.`
    );
    load();
  };

  const setStatus = async (id: string, status: AdSettlement["status"]) => {
    const { error } = await supabase
      .from("ad_settlements")
      .update({
        status,
        paid_at: status === "paid" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) {
      toast.error("No se pudo cambiar el estado: " + error.message);
      return;
    }
    load();
  };

  const header = (
    <CardHeader className="pb-3">
      <CardTitle className="flex flex-wrap items-center gap-2 text-base">
        <HandCoins className="h-4 w-4 text-emerald-600" />
        Reparto con organizadores
        <span className="font-normal text-muted-foreground">· {periodLabel}</span>
        {closed && (
          <Badge className="gap-1 bg-emerald-600 text-[11px] hover:bg-emerald-600">
            <Lock className="h-3 w-3" />
            Mes cerrado
          </Badge>
        )}
      </CardTitle>
    </CardHeader>
  );

  if (loading) {
    return (
      <Card>
        {header}
        <CardContent>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando el reparto…
          </p>
        </CardContent>
      </Card>
    );
  }

  // ---- MES CERRADO: se muestra lo congelado, no se recalcula ----
  if (closed) {
    const total = settlements.reduce((a, s) => a + s.amount_cop, 0);
    return (
      <Card>
        {header}
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Cifras congeladas el{" "}
            {new Date(settlements[0].closed_at).toLocaleDateString("es-CO")}. No
            se recalculan aunque cambien los eventos: es lo que se le prometió a
            cada organizador. Para corregir hay que anular los cortes y volver a
            cerrar el mes.
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organizador</TableHead>
                  <TableHead className="text-right">Personas-día</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {settlements
                  .slice()
                  .sort((a, b) => b.amount_cop - a.amount_cop)
                  .map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        {organizerNameOf[s.organizer_id] ?? "Organizador"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.person_days.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCOP(s.amount_cop)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[11px]">
                          {SETTLEMENT_STATUS_LABELS[s.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {s.status === "issued" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatus(s.id, "approved")}
                          >
                            Aprobar
                          </Button>
                        )}
                        {s.status === "approved" && (
                          <Button
                            size="sm"
                            onClick={() => setStatus(s.id, "paid")}
                          >
                            Marcar pagada
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>Total del mes</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {formatCOP(total)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- MES ABIERTO: cálculo en vivo ----
  if (campaignIds.length === 0) {
    return (
      <Card>
        {header}
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
      {header}
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
            {periodMonth
              ? "Se guarda al salir del campo. Precargado con el precio mensual: corrígelo si la campaña estuvo al aire solo parte del mes."
              : "El histórico completo no se puede guardar ni cerrar. Elegí un mes para eso."}
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaña</TableHead>
                  <TableHead className="text-right">Cobrado</TableHead>
                  <TableHead className="text-right">Para organizadores</TableHead>
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
                        disabled={!periodMonth}
                        value={valueOf(c.campaignId)}
                        onChange={(e) =>
                          setRevenue((r) => ({
                            ...r,
                            [c.campaignId]: e.target.value,
                          }))
                        }
                        onBlur={() => persistRevenue(c.campaignId)}
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
            una nacional grande, porque su bolsa se divide entre menos audiencia.
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

                    {/* Desglose por campaña. Sin esto, un total sin explicación
                        es imposible de auditar cuando el organizador pregunta
                        de dónde salió. */}
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

        {/* ---- Cerrar el mes ---- */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Cerrar el mes</p>
            <p className="text-xs text-muted-foreground">
              {!periodMonth
                ? "Elegí un mes concreto: el histórico completo no se puede cerrar."
                : !closable
                  ? "Este mes todavía corre. Se puede cerrar cuando termine — congelarlo antes dejaría el corte por debajo de lo real."
                  : "Congela estas cifras. A partir de ahí no se recalculan, aunque cambien los eventos."}
            </p>
          </div>
          <Button
            onClick={handleClose}
            disabled={!closable || closing || share.payableCop === 0}
          >
            {closing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Lock className="mr-2 h-4 w-4" />
            )}
            Cerrar {periodLabel.toLowerCase()}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
