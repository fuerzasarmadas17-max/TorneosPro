"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Ticket, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatCOP } from "@/lib/pricing";
import { authHeader } from "@/lib/auth-header";
import { redirectToWompiCheckout, paymentReturnUrl } from "@/lib/payments/wompi-redirect";
import { WhatsappPaymentHelp } from "@/components/ui/whatsapp-payment-help";
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
    // Una franja bajita y de una sola fila, también en el celular: el texto a
    // la izquierda (dos renglones cortos) y a la derecha la ayuda por WhatsApp
    // y el botón. En el celular los textos se acortan para que nada salte de
    // renglón; en la compu se ven completos. Está arriba del formulario de
    // crear torneo: no le puede robar la pantalla.
    <Card className="mb-4 gap-0 py-0 border-primary/20 bg-primary/5">
      <CardContent className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
        <Ticket className="h-4 w-4 flex-shrink-0 text-primary" />

        {total > 0 ? (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">
              Te quedan {total} torneo{total === 1 ? "" : "s"}
            </p>
            {balance?.nextExpiry && (
              <p className="text-xs leading-snug text-muted-foreground">
                {total === 1 ? "Vence" : "El próximo vence"} el{" "}
                {fmtDate(balance.nextExpiry)}
              </p>
            )}
          </div>
        ) : (
          // "Incluye copas": los torneos de Grupos + múltiples copas no pagan el
          // recargo del 15% cuando se crean con un crédito (decisión del
          // 2026-09-18, ver `Por hacer/torneos/grupos-y-copas.md`, 6.4).
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">
              <span className="sm:hidden">{PACK.credits} torneos · {formatCOP(PACK.priceCop)}</span>
              <span className="hidden sm:inline">
                {PACK.label} · {formatCOP(PACK.priceCop)}
              </span>
            </p>
            <p className="text-xs leading-snug text-muted-foreground">
              {formatCOP(pricePerCredit(PACK))}
              <span className="sm:hidden"> c/u · incluye copas</span>
              <span className="hidden sm:inline">
                {" "}por torneo, hasta {PACK.maxTeams} equipos, {PACK.months} meses
                para usarlos. Incluye torneos con copas.
              </span>
            </p>
          </div>
        )}

        {/* El paquete es el producto más caro y el que más se cae: en agosto
            dos organizadores lo intentaron y ninguno completó. La salida por
            WhatsApp va pegada al botón para que no quede escondida. */}
        <WhatsappPaymentHelp
          detalle={`el ${PACK.label.toLowerCase()}`}
          monto={formatCOP(PACK.priceCop)}
          className="flex-shrink-0 pt-0"
          compact
        />
        <Button
          onClick={buy}
          disabled={buying}
          variant={total > 0 ? "outline" : "default"}
          size="sm"
          className="h-8 flex-shrink-0 px-3"
        >
          {buying && <Loader2 className="h-4 w-4 animate-spin" />}
          {total > 0 ? (
            "Comprar más"
          ) : (
            <>
              Comprar<span className="hidden sm:inline">&nbsp;paquete</span>
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
