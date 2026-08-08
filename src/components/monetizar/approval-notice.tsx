"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, TriangleAlert } from "lucide-react";
import type { MonetizationRow } from "@/lib/ad-analytics";

/**
 * El estado de la aprobación, arriba de todo.
 *
 * Nadie cobra hasta que un admin revisa sus datos. Eso hay que decirlo antes de
 * que el organizador acumule un mes entero de audiencia creyendo que ya está
 * todo listo — enterarse el día del cierre de que faltaba un paso es la peor
 * versión de esta conversación.
 *
 * Sigue viendo su audiencia y sus requisitos mientras tanto: la aprobación
 * bloquea el pago, no el progreso.
 */
export function ApprovalNotice({
  status,
  onFix,
}: {
  status: MonetizationRow;
  onFix: () => void;
}) {
  if (status.payout_status === "approved") return null;

  if (status.payout_status === "rejected") {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex gap-3 py-5">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="space-y-2 text-sm">
            <p className="font-medium">Tenemos que corregir tus datos de pago</p>
            {/* El motivo es obligatorio del lado del admin justamente para esto:
                un rechazo sin explicación deja al organizador sin nada que
                hacer, y termina en un mensaje de WhatsApp. */}
            <p className="text-muted-foreground">
              {status.rejection_reason ??
                "Revisá que el nombre y el número de cuenta estén correctos."}
            </p>
            <Button variant="outline" size="sm" onClick={onFix}>
              Corregir mis datos
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // pending (y `missing`, que no debería llegar acá: sin datos no se entra).
  return (
    <Card>
      <CardContent className="flex gap-3 py-5">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="space-y-1 text-sm">
          <p className="font-medium">Estamos revisando tus datos</p>
          <p className="text-muted-foreground">
            Hasta que no los aprobemos no te podemos consignar. Mientras tanto tu
            audiencia se sigue contando normalmente, así que no perdés nada de lo
            que generes estos días.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
