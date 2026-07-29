"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdDetailRow } from "@/lib/ad-analytics";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  advertiserName: string;
  periodLabel: string;
  /** Filas campaña × torneo de ESTA campaña, ya filtradas. */
  rows: AdDetailRow[];
  /** Personas-día de la campaña completa, calculadas por la base. NO es la
   *  suma de `rows`: la misma persona el mismo día puede haber visto esta
   *  campaña en dos torneos. */
  campaignPersonDays: number;
}

function ctrOf(clicks: number, impressions: number): string {
  return impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) + "%" : "—";
}

/**
 * Desglose de una campaña por torneo y organizador: el informe que se le
 * entrega al anunciante.
 *
 * Impresiones y clics SÍ se suman entre torneos. Personas-día NO, así que el
 * total de la campaña viene calculado por la base y se muestra aparte del pie
 * de tabla, en vez de sumar la columna.
 */
export function AdCampaignDetail({
  open,
  onOpenChange,
  advertiserName,
  periodLabel,
  rows,
  campaignPersonDays,
}: Props) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.impressions - a.impressions),
    [rows]
  );

  const totalImpr = sorted.reduce((a, r) => a + r.impressions, 0);
  const totalClicks = sorted.reduce((a, r) => a + r.clicks, 0);
  const sumPersonDays = sorted.reduce((a, r) => a + r.person_days, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{advertiserName}</DialogTitle>
          <DialogDescription>
            Desglose por torneo y organizador · {periodLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Impresiones</p>
            <p className="text-lg font-semibold tabular-nums">
              {totalImpr.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Personas-día</p>
            <p className="text-lg font-semibold tabular-nums">
              {campaignPersonDays.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Clics</p>
            <p className="text-lg font-semibold tabular-nums">
              {totalClicks.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">CTR</p>
            <p className="text-lg font-semibold tabular-nums">
              {ctrOf(totalClicks, totalImpr)}
            </p>
          </div>
        </div>

        {sorted.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Esta campaña no registró actividad en el período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Torneo</TableHead>
                  <TableHead>Organizador</TableHead>
                  <TableHead className="text-right">Impr.</TableHead>
                  <TableHead className="text-right">Pers-día</TableHead>
                  <TableHead className="text-right">Clics</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => (
                  <TableRow key={r.tournament_id ?? "sin-torneo"}>
                    {/* Sin `tournament_id` el evento se disparó fuera de un
                        torneo; con id pero sin nombre, el torneo se borró
                        después. Son casos distintos y conviene distinguirlos. */}
                    <TableCell className="font-medium">
                      {r.tournament_name ??
                        (r.tournament_id ? "Torneo eliminado" : "Sin torneo")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.organizer_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.impressions.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.person_days.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.clicks.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {ctrOf(r.clicks, r.impressions)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {totalImpr.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {campaignPersonDays.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {totalClicks.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {ctrOf(totalClicks, totalImpr)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}

        {/* Sin esta nota, el total de personas-día se lee como un error de
            suma: la columna suma más que el total de la campaña. */}
        {sumPersonDays > campaignPersonDays && (
          <p className="text-xs text-muted-foreground">
            Las personas-día por torneo suman{" "}
            {sumPersonDays.toLocaleString()}, más que las{" "}
            {campaignPersonDays.toLocaleString()} de la campaña. No es un error:
            quien el mismo día vio esta campaña en dos torneos cuenta en cada
            fila, pero una sola vez en el total. Por eso esa columna no se suma.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
