"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildRequirements,
  requirementPct,
} from "@/lib/monetizar-requirements";
import type { MonetizationConfig, MonetizationRow } from "@/lib/ad-analytics";

/**
 * El detalle de los requisitos del mes.
 *
 * El punto es que sea ACCIONABLE. No dice "no clasificás", dice "te faltan 120
 * personas y 2 días con audiencia". El requisito deja de ser un muro y pasa a
 * ser una lista de qué hacer.
 *
 * Cuando ya clasifica se muestra igual, todo en verde: sirve para que sepa que
 * sigue cumpliendo y no se sorprenda el mes que deje de hacerlo.
 */
export function RequirementsProgress({
  row,
  config,
}: {
  row: MonetizationRow;
  config: MonetizationConfig;
}) {
  const requirements = buildRequirements(row, config);
  const pending = requirements.filter((r) => r.current < r.target);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {pending.length === 0
            ? "Cumplís todos los requisitos"
            : "Qué te falta este mes"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Se miden mes a mes. Si este mes no llegás, el otro arranca de nuevo.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {requirements.map((r) => {
          const met = r.current >= r.target;
          return (
            <div key={r.label} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className={cn(met && "text-muted-foreground")}>
                  {r.label}
                </span>
                <span
                  className={cn(
                    "shrink-0 font-medium tabular-nums",
                    met && "text-emerald-600 dark:text-emerald-500"
                  )}
                >
                  {met ? (
                    <Check className="inline h-4 w-4" />
                  ) : r.boolean ? (
                    "Falta"
                  ) : (
                    `${r.current} / ${r.target}`
                  )}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    met ? "bg-emerald-500" : "bg-primary"
                  )}
                  style={{ width: `${requirementPct(r)}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
