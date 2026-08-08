"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { monthLabel } from "@/lib/month-label";
import {
  buildRequirements,
  monthProgress,
} from "@/lib/monetizar-requirements";
import type { MonetizationConfig, MonetizationRow } from "@/lib/ad-analytics";

/**
 * La barra grande: si este mes ya alcanzó la meta, o por dónde va.
 *
 * El número es el requisito que va MÁS ATRÁS, no un promedio: hay que cumplirlos
 * todos, así que el que va último es el que manda. Y se nombra, para que la
 * barra diga qué hacer y no solo cómo va.
 */
export function MonthGoal({
  row,
  config,
  month,
}: {
  row: MonetizationRow;
  config: MonetizationConfig;
  month: string;
}) {
  // La cuenta excluida no llega acá: la página corta antes y muestra un solo
  // aviso. Enseñarle una meta a quien no puede cobrar es una burla.
  const requirements = buildRequirements(row, config);
  const { pct, met, blocking } = monthProgress(requirements);
  const falta = blocking ? Math.max(0, blocking.target - blocking.current) : 0;

  return (
    <Card>
      <CardContent className="space-y-3 py-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium">
            {met ? "Ya alcanzaste la meta de este mes" : "Cómo vas este mes"}
          </p>
          <p className="text-sm text-muted-foreground">{monthLabel(month)}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                met ? "bg-emerald-500" : "bg-primary"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span
            className={cn(
              "w-12 shrink-0 text-right text-sm font-semibold tabular-nums",
              met && "text-emerald-600 dark:text-emerald-500"
            )}
          >
            {pct}%
          </span>
        </div>

        {met ? (
          <p className="text-sm text-muted-foreground">
            Tu corte de este mes se liquida mientras sigas así hasta que termine
            el mes.
          </p>
        ) : blocking ? (
          <p className="text-sm text-muted-foreground">
            Lo que más te frena:{" "}
            <span className="font-medium text-foreground">
              {blocking.boolean
                ? blocking.label.toLowerCase()
                : `te faltan ${falta} · ${blocking.label.toLowerCase()}`}
            </span>
            . El detalle completo está abajo.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
