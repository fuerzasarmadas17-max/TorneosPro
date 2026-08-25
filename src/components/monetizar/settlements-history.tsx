"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatCOP } from "@/lib/pricing";
import { monthLabel } from "@/lib/month-label";
import { personas } from "@/lib/plural";
import { SETTLEMENT_STATUS_LABELS, type MySettlement } from "@/lib/ad-analytics";

/**
 * Los meses ya cerrados.
 *
 * Estos números son CONGELADOS: el que vio el día del cierre es el que sigue
 * viendo, salga lo que salga de recalcular hoy. Por eso el desglose se deriva
 * del `breakdown` guardado y no se vuelve a calcular.
 *
 * Acá el estado sí importa —Emitida / Aprobada / Pagada— porque es lo que le
 * dice si ya le transferimos o si está en camino.
 */

const STATUS_STYLE: Record<MySettlement["status"], string> = {
  issued: "bg-muted text-muted-foreground",
  approved: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  // Los anulados no llegan a esta pantalla (la ruta los filtra), pero el mapa
  // tiene que ser completo para que TypeScript no deje un hueco.
  void: "bg-muted text-muted-foreground",
};

export function SettlementsHistory({
  settlements,
  campaignNames,
  abonosByMonth = {},
}: {
  settlements: MySettlement[];
  campaignNames: Record<string, string>;
  /** Lo que se abonó a torneos por pagar en cada mes. */
  abonosByMonth?: Record<string, number>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (settlements.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Todavía no hay meses cerrados. Cuando termine el mes y se liquide, tu
          corte aparece acá con su estado.
        </CardContent>
      </Card>
    );
  }

  const total = settlements.reduce((a, s) => a + s.amountCop, 0);

  return (
    <div className="space-y-4">
      <Card>
        <Table>
          {/* Sin columna de audiencia: el total del corte suma las campañas y
              cuenta dos veces a quien vio dos el mismo día, así que no cuadra
              con el requisito de audiencia que tiene arriba. La audiencia por
              campaña —que sí es comparable con nada— está en el desglose. */}
          <TableHeader>
            <TableRow>
              <TableHead>Mes</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-right">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settlements.map((s) => {
              const open = openId === s.id;
              return [
                <TableRow
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => setOpenId(open ? null : s.id)}
                >
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {open ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      {monthLabel(s.periodMonth)}
                    </span>
                  </TableCell>
                  {/* El monto es lo que GANÓ, congelado, y no se toca nunca.
                      Si ese mes se le abonó algo a un torneo por pagar, la
                      resta va debajo — callarla acá dejaría al histórico
                      diciendo una cifra y a su cuenta bancaria otra. */}
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCOP(s.amountCop)}
                    {(abonosByMonth[s.periodMonth] ?? 0) > 0 && (
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        − {formatCOP(abonosByMonth[s.periodMonth])} a tu torneo
                        <br />
                        te transferimos{" "}
                        {formatCOP(
                          Math.max(0, s.amountCop - abonosByMonth[s.periodMonth])
                        )}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant="secondary"
                      className={STATUS_STYLE[s.status]}
                    >
                      {SETTLEMENT_STATUS_LABELS[s.status]}
                    </Badge>
                  </TableCell>
                </TableRow>,

                open ? (
                  <TableRow key={s.id + ":detalle"} className="hover:bg-transparent">
                    <TableCell colSpan={3} className="bg-muted/40">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        De dónde salió
                      </p>
                      {/* La constancia de la transferencia, para que pueda
                          buscarla en su banco en vez de escribirnos a preguntar
                          si ya salió. */}
                      {s.status === "paid" && s.paymentReference && (
                        <p className="mb-3 rounded-md bg-emerald-500/10 px-3 py-2 text-sm">
                          Transferida
                          {s.paidAt && (
                            <> el {new Date(s.paidAt).toLocaleDateString("es-CO")}</>
                          )}
                          . Referencia del banco:{" "}
                          <strong className="tabular-nums">
                            {s.paymentReference}
                          </strong>
                        </p>
                      )}
                      <ul className="space-y-1 text-sm">
                        {s.campaigns.map((c) => (
                          <li
                            key={c.campaignId}
                            className="flex justify-between gap-3"
                          >
                            <span>
                              {campaignNames[c.campaignId] ?? "Campaña eliminada"}
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {personas(c.personDays)} ×{" "}
                              {formatCOP(c.ratePerPersonDay)} ={" "}
                              <span className="text-foreground">
                                {formatCOP(c.amountCop)}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                  </TableRow>
                ) : null,
              ];
            })}
          </TableBody>
        </Table>
      </Card>

      <p className="text-sm text-muted-foreground">
        Acumulado: <strong className="text-foreground">{formatCOP(total)}</strong>
      </p>
    </div>
  );
}
