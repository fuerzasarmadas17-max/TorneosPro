"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Ticket, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatCOP } from "@/lib/pricing";
import { authHeader } from "@/lib/auth-header";
import { redirectToWompiCheckout, paymentReturnUrl } from "@/lib/payments/wompi-redirect";
import { TOURNAMENT_PACKS, pricePerCredit, PACKS_TEST_MODE } from "@/lib/packs";
import { useAuth } from "@/context/auth-context";
import { useTournamentCredits } from "@/hooks/use-tournament-credits";

/**
 * Franja de créditos, arriba del formulario de crear torneo.
 *
 * Dos estados: con saldo muestra cuántos quedan y cuándo vencen; sin saldo
 * ofrece el paquete. Va acá y no en el dashboard porque es el momento exacto en
 * que el dato le sirve — está por crear un torneo y tiene que decidir cómo
 * pagarlo.
 *
 * **La fecha de vencimiento va siempre visible.** Si no la ve cada vez que
 * entra, el día que se le venzan es una discusión.
 */

const PACK = TOURNAMENT_PACKS["pack-5"];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function CreditBalanceBar() {
  const { balance, loading } = useTournamentCredits();
  const { user } = useAuth();
  const [buying, setBuying] = useState(false);

  const buy = async () => {
    setBuying(true);
    try {
      const headers = await authHeader();
      if (!headers.Authorization) {
        toast.error("Tu sesión venció. Vuelve a iniciar sesión.");
        return;
      }
      const res = await fetch("/api/payments/pack-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ packId: PACK.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "No se pudo iniciar el pago");
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;
      if (!publicKey) {
        toast.error("Falta la configuración de pagos");
        return;
      }

      redirectToWompiCheckout({
        publicKey,
        amountInCents: data.amountInCents,
        reference: data.reference,
        integrity: data.integrity,
        redirectUrl: paymentReturnUrl(data.reference),
      });
    } catch (err) {
      console.error("Error comprando el paquete", err);
      toast.error("No se pudo iniciar el pago");
    } finally {
      setBuying(false);
    }
  };

  // Durante la prueba en producción el paquete cuesta $5.000, así que la franja
  // se le esconde a todos menos al admin: un organizador que la viera podría
  // comprar 5 torneos por ese precio y habría que respetárselo.
  if (PACKS_TEST_MODE && user?.role !== "admin") return null;

  // Mientras carga no se muestra nada: una franja que aparece y cambia de
  // contenido a los dos segundos es peor que una que aparece ya resuelta.
  if (loading) return null;

  const total = balance?.total ?? 0;

  return (
    <Card className="mb-6 border-primary/20 bg-primary/5">
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        <Ticket className="h-5 w-5 flex-shrink-0 text-primary" />

        {total > 0 ? (
          <div className="min-w-0">
            <p className="font-semibold">
              Te quedan {total} torneo{total === 1 ? "" : "s"}
            </p>
            {balance?.nextExpiry && (
              <p className="text-xs text-muted-foreground">
                {total === 1 ? "Vence" : "El próximo vence"} el{" "}
                {fmtDate(balance.nextExpiry)}
              </p>
            )}
          </div>
        ) : (
          <div className="min-w-0">
            <p className="font-semibold">
              {PACK.label} · {formatCOP(PACK.priceCop)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatCOP(pricePerCredit(PACK))} por torneo, de hasta{" "}
              {PACK.maxTeams} equipos. Los usás cuando quieras durante{" "}
              {PACK.months} meses.
            </p>
          </div>
        )}

        <Button
          onClick={buy}
          disabled={buying}
          variant={total > 0 ? "outline" : "default"}
          size="sm"
          className="ml-auto flex-shrink-0"
        >
          {buying && <Loader2 className="h-4 w-4 animate-spin" />}
          {total > 0 ? "Comprar más" : "Comprar paquete"}
        </Button>
      </CardContent>
    </Card>
  );
}
