"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HandCoins, Users } from "lucide-react";
import { formatCOP } from "@/lib/pricing";
import {
  computeRevenueShare,
  ORGANIZER_SHARE,
  type AdOrganizerRow,
} from "@/lib/ad-analytics";

interface Props {
  organizers: AdOrganizerRow[];
  /** Etiqueta del período que se está mirando, para el encabezado. */
  periodLabel: string;
  /** Proporción de impresiones del período que ya traen persona (0..1).
   *  Por debajo de ~1 el reparto subestima y no se debe liquidar. */
  coverage: number;
  /** Personas-día distintas en toda la plataforma. Se muestra al lado de la
   *  suma repartible para explicar por qué no son el mismo número. */
  globalPersonDays: number;
}

/**
 * Reparto del fondo de publicidad entre organizadores, proporcional a las
 * personas-día que cada uno aportó en el período.
 *
 * El fondo se escribe a mano: de dónde sale (lo cobrado, lo facturado, lo
 * efectivamente recaudado) es una decisión comercial todavía abierta, y
 * cablearla a `ad_payments` ahora sería adivinar. Ver el plan en
 * `Por hacer/monetizacion-analitica-publicidad.md`.
 *
 * OJO: esto se calcula EN VIVO, así que el número cambia mientras el mes
 * corre. El corte congelado —guardar personas-día, tarifa y monto como fila
 * inmutable a la que apunta la cuenta de cobro— es el Paso 3, y es lo que
 * hace falta antes de prometerle una cifra a alguien.
 */
export function AdRevenueShare({
  organizers,
  periodLabel,
  coverage,
  globalPersonDays,
}: Props) {
  const [fundInput, setFundInput] = useState("");

  // Se escribe con puntos y comas ("600.000"); nos quedamos con los dígitos.
  const fundCop = useMemo(() => {
    const digits = fundInput.replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : 0;
  }, [fundInput]);

  const share = useMemo(
    () => computeRevenueShare(organizers, fundCop),
    [organizers, fundCop]
  );

  const hasData = share.totalPersonDays > 0;

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

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="ad-fund">Fondo del período (COP)</Label>
            <Input
              id="ad-fund"
              inputMode="numeric"
              placeholder="600.000"
              value={fundInput}
              onChange={(e) => setFundInput(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">
              Para organizadores ({Math.round(ORGANIZER_SHARE * 100)}%)
            </p>
            <p className="text-lg font-semibold">{formatCOP(share.pool)}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Por persona-día</p>
            <p className="text-lg font-semibold">
              {hasData && share.pool > 0
                ? formatCOP(Math.round(share.ratePerPersonDay))
                : "—"}
            </p>
          </div>
        </div>

        {/* Por qué la suma de la tabla no coincide con el total global. Sin
            esto el admin ve dos cifras distintas de "personas-día" en la misma
            pantalla y asume que una está mal. */}
        {hasData && (
          <p className="text-xs text-muted-foreground">
            Se reparte sobre{" "}
            <span className="font-medium text-foreground">
              {share.totalPersonDays.toLocaleString()}
            </span>{" "}
            personas-día sumadas por organizador. La plataforma alcanzó{" "}
            {globalPersonDays.toLocaleString()} personas-día distintas: la
            diferencia es gente que el mismo día vio torneos de dos
            organizadores y le cuenta a cada uno. Para repartir se usa la suma,
            que es la única que da 100% exacto.
          </p>
        )}

        {coverage < 0.99 && hasData && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <p className="font-medium text-amber-700">
              No liquidar con estas cifras todavía
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Solo el {Math.round(coverage * 100)}% de las impresiones del
              período tienen persona identificada, así que las personas-día de
              abajo están subestimadas — y no parejo entre organizadores.
            </p>
          </div>
        )}

        {!hasData ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-1.5 h-4 w-4" />
            Todavía no hay personas-día en este período. Aparecen cuando los
            espectadores vean publicidad en torneos con organizador.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organizador</TableHead>
                  <TableHead className="text-right">Torneos</TableHead>
                  <TableHead className="text-right">Personas-día</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">A transferir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {share.rows.map((r) => (
                  <TableRow key={r.organizer_id}>
                    <TableCell className="font-medium">
                      {r.organizer_name || "Organizador sin nombre"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.tournaments}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.person_days.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {(r.share * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {share.pool > 0 ? formatCOP(r.amountCop) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {share.totalPersonDays.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">100%</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {share.pool > 0 ? formatCOP(share.pool) : "—"}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Cálculo en vivo: mientras el mes corra, estas cifras cambian. El corte
          mensual congelado y el estado de la cuenta de cobro son el Paso 3.
        </p>
      </CardContent>
    </Card>
  );
}
