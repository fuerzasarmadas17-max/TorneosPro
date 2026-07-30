"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { HandCoins, Users, Lock, Loader2 } from "lucide-react";
import { formatCOP } from "@/lib/pricing";
import {
  computeRevenueShare,
  isMonthClosable,
  proratedRevenue,
  toSettlementInputs,
  wouldBeTotal,
  SETTLEMENT_STATUS_LABELS,
  type AdCampaignOrganizerRow,
  type AdSettlement,
} from "@/lib/ad-analytics";

/** Lo que hace falta saber de cada campaña para repartir. */
export interface CampaignInfo {
  name: string;
  /** COP efectivamente COBRADOS: suma de pagos aprobados. NO el precio de
   *  lista — si el anunciante no pagó, acá va 0 y no se reparte nada. */
  paidCop: number;
  starts: string;
  ends: string;
}

interface Props {
  rows: AdCampaignOrganizerRow[];
  campaigns: Record<string, CampaignInfo>;
  /** Campañas prendidas y vigentes hoy. */
  activeCount: number;
  periodLabel: string;
  periodMonth: string | null;
  coverage: number;
  onPayableChange?: (payableCop: number) => void;
}

/** "Torneos Pro · 1–31 jul" — dos campañas del mismo anunciante se veían
 *  idénticas en la tabla, con montos distintos y sin forma de saber cuál era
 *  cuál. */
function campaignLabel(
  name: string,
  dates: { starts: string; ends: string }
): string {
  const f = (iso: string) =>
    new Date(iso).toLocaleDateString("es-CO", {
      day: "numeric",
      month: "short",
    });
  return `${name} · ${f(dates.starts)}–${f(dates.ends)}`;
}

/**
 * Reparto de publicidad con organizadores, POR CAMPAÑA.
 *
 * Cada campaña reparte el 50% de lo que pagó entre los organizadores que le
 * entregaron audiencia A ELLA. Ver `lib/ad-analytics.ts`.
 *
 * Dos modos: mes abierto (cálculo en vivo) y mes cerrado (lo congelado en
 * `ad_settlements`, que ya no se recalcula).
 */
export function AdRevenueShare({
  rows,
  campaigns,
  activeCount,
  periodLabel,
  periodMonth,
  coverage,
  onPayableChange,
}: Props) {
  const [revenue, setRevenue] = useState<Record<string, string>>({});
  const [settlements, setSettlements] = useState<AdSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

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

  /** Precarga: lo cobrado, prorrateado a los días que la campaña estuvo al aire
   *  dentro del mes. Si ya se corrigió a mano, manda lo guardado. */
  const prefillOf = (id: string): number => {
    const c = campaigns[id];
    if (!c) return 0;
    return proratedRevenue(c.paidCop, c.starts, c.ends, periodMonth);
  };

  const valueOf = (id: string): string =>
    revenue[id] ?? String(prefillOf(id));

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
    [rows, campaignIds, revenue, campaigns, periodMonth]
  );

  const nameOf = (id: string) => {
    const c = campaigns[id];
    return c ? campaignLabel(c.name, c) : "Campaña eliminada";
  };

  const organizerNameOf = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of rows) {
      if (r.organizer_name) map[r.organizer_id] = r.organizer_name;
    }
    return map;
  }, [rows]);

  const closed = settlements.length > 0;
  const closable = isMonthClosable(periodMonth);

  const cobran = share.organizers.filter((o) => o.eligible && o.totalCop > 0);
  const noCobran = share.organizers.filter((o) => !o.eligible);

  /** Lo cobrado a los anunciantes en el período. */
  const totalCobrado = campaignIds.reduce((a, id) => a + amountOf(id), 0);

  const payable = closed
    ? settlements.reduce((a, s) => a + s.amount_cop, 0)
    : share.payableCop;

  /** Tu plata: tu mitad más la parte de los que no clasificaron. */
  const teQuedas = totalCobrado - payable;

  useEffect(() => {
    onPayableChange?.(payable);
  }, [payable, onPayableChange]);

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
            Cargando…
          </p>
        </CardContent>
      </Card>
    );
  }

  // ---- MES CERRADO ----
  if (closed) {
    return (
      <Card>
        {header}
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Congelado el{" "}
            {new Date(settlements[0].closed_at).toLocaleDateString("es-CO")}. No
            se recalcula: es lo que se le prometió a cada organizador.
          </p>
          <ScrollRows count={settlements.length} rowHeight={ROW_H_INPUT}>
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
                          <Button size="sm" onClick={() => setStatus(s.id, "paid")}>
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
                    {formatCOP(payable)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
          </ScrollRows>
        </CardContent>
      </Card>
    );
  }

  async function setStatus(id: string, status: AdSettlement["status"]) {
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
  }

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
      toast.error(error.message);
      return;
    }
    const r = data as { settlements: number; payable_cop: number };
    toast.success(
      `Mes cerrado: ${r.settlements} cortes por ${formatCOP(r.payable_cop)}.`
    );
    load();
  };

  // ---- MES ABIERTO ----
  if (campaignIds.length === 0) {
    return (
      <Card>
        {header}
        <CardContent>
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-1.5 h-4 w-4" />
            Ninguna campaña generó audiencia en este período.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {header}
      <CardContent className="space-y-6">
        {/* ============ 1. LOS CUATRO NÚMEROS ============ */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Figure label="Campañas activas" value={String(activeCount)} />
          <Figure label="Cobrado a anunciantes" value={formatCOP(totalCobrado)} />
          <Figure
            label="A transferir"
            value={formatCOP(payable)}
            tone="text-emerald-600"
          />
          <Figure label="Te quedas" value={formatCOP(teQuedas)} />
        </div>

        {coverage < 0.99 && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-700">
            <strong>No liquidar todavía.</strong> Solo el{" "}
            {Math.round(coverage * 100)}% de las impresiones del período tienen
            persona identificada, así que las personas-día están subestimadas.
          </p>
        )}

        {/* ============ 2. POR CAMPAÑA ============ */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">
            Por campaña
            <span className="ml-1.5 font-normal text-muted-foreground">
              ({share.perCampaign.length}) · {formatCOP(share.poolCop)} a repartir
            </span>
          </h3>
          <ScrollRows
            count={share.perCampaign.length}
            rowHeight={ROW_H_INPUT}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaña</TableHead>
                  <TableHead className="text-right">Cobrado</TableHead>
                  <TableHead className="text-right">
                    50% a repartir
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
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCOP(c.poolCop)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.personDays.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {c.poolCop > 0
                        ? formatCOP(Math.round(c.ratePerPersonDay))
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCOP(totalCobrado)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {formatCOP(share.poolCop)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
          </ScrollRows>
          <p className="text-xs text-muted-foreground">
            El cobro sale de los pagos aprobados, ya prorrateado a los días que
            la campaña estuvo al aire en el mes. Si cobraste por fuera
            (efectivo, transferencia directa) escribilo a mano: se guarda al
            salir del campo.
          </p>
        </section>

        {/* ============ 3. QUIÉN COBRA ============ */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">
            Organizadores que cobran
            <span className="ml-1.5 font-normal text-muted-foreground">
              ({cobran.length}) · {formatCOP(share.payableCop)}
            </span>
          </h3>
          {cobran.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
              Ninguno. {share.poolCop === 0 && "Falta registrar el cobro de las campañas."}
            </p>
          ) : (
            <ScrollRows count={cobran.length}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organizador</TableHead>
                    <TableHead className="text-right">Campañas</TableHead>
                    <TableHead className="text-right">Personas-día</TableHead>
                    <TableHead className="text-right">A transferir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cobran.map((o) => (
                    <TableRow key={o.organizerId}>
                      <TableCell className="font-medium">
                        {o.organizerName || "Organizador sin nombre"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {o.slices.length}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {o.personDaysAcrossCampaigns.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCOP(o.totalCop)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3}>Total a transferir</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {formatCOP(share.payableCop)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </ScrollRows>
          )}
        </section>

        {/* ============ 4. QUIÉN NO COBRA (y su plata te queda a ti) ============ */}
        {noCobran.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">
              No clasificaron — su parte te queda a ti
              <span className="ml-1.5 font-normal text-muted-foreground">
                ({noCobran.length}) · {formatCOP(share.retainedCop)}
              </span>
            </h3>
            <ScrollRows count={noCobran.length}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organizador</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-right">Personas-día</TableHead>
                    <TableHead className="text-right">Retenido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {noCobran.map((o) => (
                    <TableRow key={o.organizerId}>
                      <TableCell className="font-medium">
                        {o.organizerName || "Organizador sin nombre"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {o.reason}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {o.personDaysAcrossCampaigns.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCOP(wouldBeTotal(o))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3}>Total retenido</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {formatCOP(share.retainedCop)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </ScrollRows>
            <p className="text-xs text-muted-foreground">
              Su audiencia sí cuenta para calcular los porcentajes, así que los
              que cobran reciben exactamente su aporte — no más. Lo que no se
              paga te queda a ti.
            </p>
          </section>
        )}

        {/* ============ 5. CERRAR ============ */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <p className="min-w-0 text-xs text-muted-foreground">
            {!periodMonth
              ? "El histórico completo no se puede cerrar. Elegí un mes."
              : !closable
                ? "Este mes todavía corre. Se puede cerrar cuando termine."
                : "Al cerrar, estas cifras se congelan y no se recalculan."}
          </p>
          <Button
            onClick={handleClose}
            disabled={!closable || closing || share.payableCop === 0}
          >
            {closing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Lock className="mr-2 h-4 w-4" />
            )}
            Cerrar el mes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


/** Filas visibles antes de que la tabla empiece a scrollear. */
const MAX_ROWS = 5;
/** Altura aproximada de una fila: celda `p-2` (16px) + línea (~21px). */
const ROW_H = 37;
/** Filas con un <Input h-8> adentro son más altas. */
const ROW_H_INPUT = 49;
const HEAD_H = 40;
const FOOT_H = 37;

/**
 * Limita la tabla a `MAX_ROWS` filas y deja scrollear el resto.
 *
 * Solo pone el tope si hace falta: con 5 filas o menos no aparece scrollbar ni
 * se recorta nada.
 *
 * El encabezado y el pie NO quedan fijos a propósito. `Table` ya se envuelve en
 * un contenedor con `overflow-x-auto`, y en CSS eso convierte también el eje
 * vertical en scrollable, así que un `sticky` adentro se anclaría a ese
 * contenedor —que no es el que scrollea— y no haría nada. Por eso los totales
 * van en el título de cada sección, donde siempre se ven.
 */
function ScrollRows({
  count,
  rowHeight = ROW_H,
  children,
}: {
  count: number;
  rowHeight?: number;
  children: React.ReactNode;
}) {
  const limited = count > MAX_ROWS;
  return (
    <div
      className={limited ? "overflow-y-auto rounded-lg border" : "overflow-x-auto"}
      style={
        limited
          ? { maxHeight: HEAD_H + MAX_ROWS * rowHeight + FOOT_H }
          : undefined
      }
    >
      {children}
    </div>
  );
}

/** Cifra grande del resumen. */
function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={"text-lg font-semibold tabular-nums " + (tone ?? "")}>
        {value}
      </p>
    </div>
  );
}
