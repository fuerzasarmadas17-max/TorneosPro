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
import {
  HandCoins,
  Users,
  Lock,
  Loader2,
  Copy,
  TriangleAlert,
  Download,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCOP } from "@/lib/pricing";
import { monthLabel } from "@/lib/month-label";
import { buildRequirements } from "@/lib/monetizar-requirements";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DebtPayments } from "./debt-payments";
import { useTournamentDebts, paidInMonth } from "@/hooks/use-tournament-debts";
import {
  computeRevenueShare,
  defaultEligibility,
  eligibilityFrom,
  buildPayoutCsv,
  isMonthClosable,
  maskAccount,
  proratedRevenue,
  toSettlementInputs,
  wouldBeTotal,
  SETTLEMENT_STATUS_LABELS,
  type AdCampaignOrganizerRow,
  type AdSettlement,
  type MonetizationStatus,
  type PayoutBatchRow,
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
  /** Quién clasifica para monetizar. `null` = no se pudo cargar. */
  const [monetization, setMonetization] = useState<MonetizationStatus | null>(null);
  // Qué organizador tiene abierto el detalle de requisitos, en la tabla de los
  // que no clasificaron.
  const [openReq, setOpenReq] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  /** A dónde transferirle a cada organizador, por `user_id`. Se carga acá y no
   *  en otra pestaña porque el momento de pagar es este: marcar "Pagada" sin
   *  tener el número de cuenta a la vista obliga a salir a buscarlo, y es
   *  justamente el paso donde un error cuesta plata. */
  const [payoutInfo, setPayoutInfo] = useState<
    Record<
      string,
      {
        bank: string;
        accountType: string;
        accountNumber: string;
        fullName: string;
        documentType: string;
        documentNumber: string;
      }
    >
  >({});
  /** Corte al que se le está registrando la transferencia. */
  const [payingFor, setPayingFor] = useState<AdSettlement | null>(null);
  const [reference, setReference] = useState("");

  const campaignIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of rows) if (r.person_days > 0) ids.add(r.campaign_id);
    return [...ids];
  }, [rows]);

  const load = useCallback(async () => {
    // Sin mes ("Todo el histórico") no hay reparto que calcular: el cobro se
    // registra POR MES en `ad_period_revenue`, así que sin mes todo daba cero y
    // la pantalla quedaba llena de ceros con un "falta registrar el cobro" que
    // se lee como un error. Lo que corresponde ahí es el histórico de verdad:
    // los meses ya cerrados y cuánto se pagó en cada uno.
    if (!periodMonth) {
      const { data, error } = await supabase
        .from("ad_settlements")
        .select("*")
        .neq("status", "void")
        .order("period_month", { ascending: false });
      if (error) console.error("No se pudieron leer los cortes", error);
      setSettlements((data as AdSettlement[]) ?? []);
      setRevenue({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const [revRes, setRes, monRes, payRes] = await Promise.all([
      supabase
        .from("ad_period_revenue")
        .select("campaign_id, amount_cop")
        .eq("period_month", periodMonth),
      supabase
        .from("ad_settlements")
        .select("*")
        .eq("period_month", periodMonth)
        .neq("status", "void"),
      supabase.rpc("get_monetization_status", { p_month: periodMonth }),
      supabase
        .from("organizer_payout_info")
        .select("user_id, full_name, document_type, document_number, bank, account_type, account_number")
        .eq("approval_status", "approved"),
    ]);

    const payouts: Record<
      string,
      {
        bank: string;
        accountType: string;
        accountNumber: string;
        fullName: string;
        documentType: string;
        documentNumber: string;
      }
    > = {};
    for (const row of (payRes.data ?? []) as {
      user_id: string;
      full_name: string;
      document_type: string;
      document_number: string;
      bank: string;
      account_type: string;
      account_number: string;
    }[]) {
      payouts[row.user_id] = {
        bank: row.bank,
        accountType: row.account_type,
        accountNumber: row.account_number,
        fullName: row.full_name,
        documentType: row.document_type,
        documentNumber: row.document_number,
      };
    }
    setPayoutInfo(payouts);

    if (monRes.error) {
      console.error("get_monetization_status falló", monRes.error);
      setMonetization(null);
    } else {
      setMonetization(monRes.data as MonetizationStatus | null);
    }

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
        campaignIds.map((id) => ({ campaignId: id, amountCop: amountOf(id) })),
        // Sin el estado de monetización se cae al fallback permisivo, y el aviso
        // de abajo lo dice: es mejor que un fallo de red se vea como "no sé" y
        // no como "nadie clasificó", que dejaría el reparto entero en cero.
        monetization ? eligibilityFrom(monetization) : defaultEligibility
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, campaignIds, revenue, campaigns, periodMonth, monetization]
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

  const {
    debts,
    payments: debtPayments,
    loading: debtsLoading,
    refetch: refetchDebts,
  } = useTournamentDebts();

  // Lo que se le abonó a cada organizador contra sus torneos fiados en este
  // mes. Se resta de lo que se le TRANSFIERE, pero nunca de `amount_cop`: eso
  // es lo que ganó, está congelado por trigger, y es la cifra que él ve en su
  // histórico. Acá arriba con los otros hooks porque más abajo hay returns
  // tempranos.
  const abonado = useMemo(
    () => (periodMonth ? paidInMonth(debtPayments, periodMonth) : {}),
    [debtPayments, periodMonth]
  );

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

  // ---- Estado de la tanda de pagos ----
  const aTransferirDe = (s: AdSettlement) =>
    Math.max(0, s.amount_cop - (abonado[s.organizer_id] ?? 0));

  const paidCount = settlements.filter((s) => s.status === "paid").length;
  const pendingCop = settlements
    .filter((s) => s.status !== "paid")
    .reduce((a, s) => a + aTransferirDe(s), 0);

  /**
   * Las filas del archivo para el banco: los cortes APROBADOS y todavía sin
   * pagar. Los que están en "Emitida" quedan fuera a propósito — todavía no se
   * revisaron, y un archivo de banco no es el lugar para revisar nada.
   *
   * Quien no tenga datos de pago aprobados tampoco entra: sin cuenta no hay
   * transferencia, y meterlo en el archivo haría que el banco rechazara la tanda
   * entera por una línea incompleta.
   */
  const batchRows: PayoutBatchRow[] = settlements
    .filter((s) => s.status === "approved" && payoutInfo[s.organizer_id])
    .map((s) => {
      const p = payoutInfo[s.organizer_id];
      return {
        organizerName: organizerNameOf[s.organizer_id] ?? "Organizador",
        fullName: p.fullName,
        documentType: p.documentType,
        documentNumber: p.documentNumber,
        bank: p.bank,
        accountType: p.accountType,
        accountNumber: p.accountNumber,
        // EL NETO, no lo que ganó. Si acá fuera `s.amount_cop`, cargarías el
        // abono en pantalla y después le transferirías igual la plata entera:
        // el descuento no existiría en la práctica.
        amountCop: aTransferirDe(s),
      };
    })
    // Al que se le abonó todo no hay nada que transferirle, y una fila en $0 en
    // el archivo del banco es una transferencia rechazada.
    .filter((r) => r.amountCop > 0);

  function downloadBatch() {
    // BOM al inicio para que Excel en español no rompa las tildes.
    const blob = new Blob(["\uFEFF" + buildPayoutCsv(batchRows)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pagos-publicidad-${periodMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- TODO EL HISTÓRICO ----
  // Va ANTES de la rama de "mes cerrado", que se activa con
  // `settlements.length > 0`: sin este corte, acá caerían todos los cortes de
  // todos los meses mezclados en una sola tabla, como si fueran uno solo.
  if (!periodMonth) {
    const byMonth = new Map<string, AdSettlement[]>();
    for (const s of settlements) {
      const list = byMonth.get(s.period_month);
      if (list) list.push(s);
      else byMonth.set(s.period_month, [s]);
    }

    return (
      <Card>
        {header}
        <CardContent>
          {byMonth.size === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Todavía no se ha cerrado ningún mes. Elegí un mes terminado para
              calcular su reparto y cerrarlo.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">Organizadores</TableHead>
                  <TableHead className="text-right">Pagado</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...byMonth.entries()].map(([month, list]) => {
                  const pagado = list
                    .filter((x) => x.status === "paid")
                    .reduce((a, x) => a + x.amount_cop, 0);
                  const pendiente = list
                    .filter((x) => x.status !== "paid")
                    .reduce((a, x) => a + x.amount_cop, 0);
                  return (
                    <TableRow key={month}>
                      <TableCell className="font-medium">
                        {monthLabel(month)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {list.length}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCOP(pagado)}
                      </TableCell>
                      {/* Lo pendiente es lo accionable: son cortes emitidos o
                          aprobados a los que todavía no se les hizo la
                          transferencia. */}
                      <TableCell
                        className={
                          "text-right tabular-nums " +
                          (pendiente > 0
                            ? "font-medium"
                            : "text-muted-foreground")
                        }
                      >
                        {pendiente > 0 ? formatCOP(pendiente) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Para ver el detalle de un mes, pagarlo o cerrarlo, elegí ese mes
            arriba.
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

          {/* El estado de la tanda, arriba. Con veinte organizadores, "cuánto
              falta por pagar" no se puede sacar leyendo la tabla fila por
              fila. */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
            <p className="text-sm">
              <strong>{paidCount}</strong> de {settlements.length} pagados
              {pendingCop > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  · faltan {formatCOP(pendingCop)}
                </span>
              )}
            </p>
            {batchRows.length > 0 && (
              <Button size="sm" variant="outline" onClick={downloadBatch}>
                <Download className="h-4 w-4" />
                Archivo para el banco ({batchRows.length})
              </Button>
            )}
          </div>
          <ScrollRows count={settlements.length} rowHeight={ROW_H_INPUT}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organizador</TableHead>
                  <TableHead>A dónde transferir</TableHead>
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
                      <TableCell className="text-xs">
                        <PayoutCell info={payoutInfo[s.organizer_id]} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.person_days.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCOP(s.amount_cop)}
                        {(abonado[s.organizer_id] ?? 0) > 0 && (
                          // Lo que ganó arriba, lo que se le transfiere abajo.
                          // Mostrar solo el neto descuadraría contra el corte
                          // congelado; mostrar solo el bruto haría transferir
                          // de más.
                          <span className="block text-[11px] font-normal text-muted-foreground">
                            − {formatCOP(abonado[s.organizer_id])} abonado
                            <br />
                            transferir {formatCOP(aTransferirDe(s))}
                          </span>
                        )}
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
                            onClick={() => {
                              setPayingFor(s);
                              setReference("");
                            }}
                          >
                            Marcar pagada
                          </Button>
                        )}
                        {s.status === "paid" && s.payment_reference && (
                          // La constancia, en la misma fila. Es lo que responde
                          // "¿a este ya le pagamos?" sin ir al extracto.
                          <span className="block text-[11px] text-muted-foreground">
                            Ref. {s.payment_reference}
                            {s.paid_at && (
                              <> · {new Date(s.paid_at).toLocaleDateString("es-CO")}</>
                            )}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Total del mes</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {formatCOP(payable)}
                    {settlements.some((s) => (abonado[s.organizer_id] ?? 0) > 0) && (
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        transferir{" "}
                        {formatCOP(
                          settlements.reduce((a, s) => a + aTransferirDe(s), 0)
                        )}
                      </span>
                    )}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
          </ScrollRows>

          {/* Los abonos van DESPUÉS del cierre, no dentro: recién acá se sabe
              cuánto ganó cada uno, que es lo que hace falta para decidir cuánto
              descontarle. Y así `close_ad_period` no se toca. Se pinta solo si
              hay alguna deuda viva. */}
          {periodMonth && (
            <DebtPayments
              periodMonth={periodMonth}
              earnedByOrganizer={Object.fromEntries(
                settlements.map((s) => [s.organizer_id, s.amount_cop])
              )}
              debts={debts}
              payments={debtPayments}
              loading={debtsLoading}
              refetch={refetchDebts}
            />
          )}
        </CardContent>

        {/* Registrar la transferencia. La referencia es obligatoria y la exige
            también la base: un corte marcado como pagado sin referencia es
            justo el registro que va a hacer falta el día que alguien diga que
            no le llegó. */}
        <Dialog
          open={!!payingFor}
          onOpenChange={(o) => {
            if (!o) setPayingFor(null);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar la transferencia</DialogTitle>
              <DialogDescription>
                {payingFor && (
                  <>
                    {organizerNameOf[payingFor.organizer_id] ?? "Organizador"} ·{" "}
                    {formatCOP(payingFor.amount_cop)}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {payingFor && payoutInfo[payingFor.organizer_id] && (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <p>{payoutInfo[payingFor.organizer_id].fullName}</p>
                <p className="text-muted-foreground">
                  {payoutInfo[payingFor.organizer_id].bank} ·{" "}
                  {payoutInfo[payingFor.organizer_id].accountType} ·{" "}
                  <span className="tabular-nums">
                    {payoutInfo[payingFor.organizer_id].accountNumber}
                  </span>
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm" htmlFor="pay-ref">
                Referencia de la transferencia
              </label>
              <Input
                id="pay-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="El número que devolvió el banco"
              />
              <p className="text-xs text-muted-foreground">
                Con esto vas a poder encontrarla en el extracto sin adivinar.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPayingFor(null)}>
                Cancelar
              </Button>
              <Button
                disabled={reference.trim().length < 3}
                onClick={() =>
                  payingFor &&
                  setStatus(payingFor.id, "paid", reference.trim())
                }
              >
                Marcar pagada
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Card>
    );
  }

  // `paid_at` y `paid_by` NO se mandan: los sella el trigger con la hora del
  // servidor y el admin de la sesión. La referencia sí viaja, y la base rechaza
  // el cambio a "pagada" si viene vacía.
  async function setStatus(
    id: string,
    status: AdSettlement["status"],
    paymentReference?: string
  ) {
    const { error } = await supabase
      .from("ad_settlements")
      .update({
        status,
        ...(status === "paid" ? { payment_reference: paymentReference } : {}),
      })
      .eq("id", id);
    if (error) {
      toast.error("No se pudo cambiar el estado: " + error.message);
      return;
    }
    setPayingFor(null);
    setReference("");
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

        {/* Los requisitos no se pudieron consultar. Se avisa porque el fallback
            es permisivo: sin este cartel, el panel mostraría a todos como
            elegibles y no habría forma de saber que no se evaluó nada. */}
        {!monetization && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
            <strong>No se pudieron consultar los requisitos.</strong> Todos
            aparecen como elegibles porque no se evaluó el umbral. No liquidar
            así.
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
                    <TableHead className="text-right">Personas-día de publicidad</TableHead>
                    <TableHead className="text-right">Retenido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {noCobran.flatMap((o) => {
                    // Los requisitos se arman con la MISMA función que usa la
                    // pantalla del organizador. Si acá se armara aparte, tarde o
                    // temprano el panel diría una cosa y él vería otra — y esa
                    // discusión, con plata de por medio, no se gana.
                    const row = monetization?.organizers.find(
                      (m) => m.organizer_id === o.organizerId
                    );
                    const reqs =
                      row && monetization
                        ? buildRequirements(row, monetization.config)
                        : [];
                    const open = openReq === o.organizerId;

                    return [
                      <TableRow
                        key={o.organizerId}
                        className={reqs.length > 0 ? "cursor-pointer" : undefined}
                        onClick={() =>
                          reqs.length > 0 &&
                          setOpenReq(open ? null : o.organizerId)
                        }
                      >
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-1.5">
                            {reqs.length > 0 &&
                              (open ? (
                                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              ))}
                            {o.organizerName || "Organizador sin nombre"}
                          </span>
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
                      </TableRow>,

                      open ? (
                        <TableRow
                          key={o.organizerId + ":req"}
                          className="hover:bg-transparent"
                        >
                          <TableCell colSpan={4} className="bg-muted/30">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Lo mismo que ve él en su pantalla
                            </p>
                            {/* Las dos cifras de personas-día conviven acá y no
                                coinciden nunca. En la pantalla del organizador
                                no se ven juntas; en este panel sí, y sin este
                                aviso se lee como que una está mal. */}
                            <p className="mb-2 text-[11px] text-muted-foreground">
                              Ojo: las{" "}
                              <strong className="font-medium">
                                {o.personDaysAcrossCampaigns.toLocaleString()}
                              </strong>{" "}
                              de la columna son personas-día de{" "}
                              <strong className="font-medium">publicidad</strong>{" "}
                              sumadas por campaña —definen cuánto cobra—. Las de
                              acá abajo son{" "}
                              <strong className="font-medium">visitas al torneo</strong>,
                              una por persona y día, y son las que definen si
                              clasifica. Nunca dan igual.
                            </p>
                            <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                              {reqs.map((r) => {
                                const ok = r.current >= r.target;
                                return (
                                  <li
                                    key={r.label}
                                    className="flex items-baseline justify-between gap-3 text-xs"
                                  >
                                    <span
                                      className={
                                        ok
                                          ? "text-muted-foreground"
                                          : "font-medium text-destructive"
                                      }
                                    >
                                      {ok ? "✓" : "✗"} {r.label}
                                    </span>
                                    <span className="shrink-0 tabular-nums text-muted-foreground">
                                      {r.boolean
                                        ? ok
                                          ? "sí"
                                          : "no"
                                        : `${r.current.toLocaleString()} / ${r.target.toLocaleString()}`}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                            {row?.payout_status === "rejected" && row.rejection_reason && (
                              <p className="mt-2 text-xs text-destructive">
                                Datos de pago rechazados: {row.rejection_reason}
                              </p>
                            )}
                          </TableCell>
                        </TableRow>
                      ) : null,
                    ];
                  })}
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

/**
 * A dónde transferirle, en la misma fila donde se marca "Pagada".
 *
 * La cuenta va tapada: esta tabla se mira con gente al lado y en pantalla
 * compartida. El botón copia el número completo, que es lo que de verdad se
 * necesita —nadie transcribe una cuenta a mano— sin dejarlo a la vista.
 *
 * Si no hay datos aprobados, se avisa en vez de dejar la celda vacía. Un corte
 * emitido a alguien sin cuenta aprobada no debería existir desde que la
 * aprobación es requisito (20260808d), pero puede quedar de un cierre anterior,
 * y ese es exactamente el caso en el que hay que frenar antes de transferir.
 */
function PayoutCell({
  info,
}: {
  info?: { bank: string; accountType: string; accountNumber: string; fullName: string };
}) {
  if (!info) {
    return (
      <span className="inline-flex items-center gap-1 text-destructive">
        <TriangleAlert className="h-3.5 w-3.5" />
        Sin datos aprobados
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>
        {info.bank} · {info.accountType}
        <span className="block text-muted-foreground tabular-nums">
          {maskAccount(info.accountNumber)} · {info.fullName}
        </span>
      </span>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(info.accountNumber);
            toast.success("Número de cuenta copiado");
          } catch {
            toast.error("No se pudo copiar");
          }
        }}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Copiar número de cuenta"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
