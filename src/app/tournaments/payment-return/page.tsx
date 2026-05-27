"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AuthGuard } from "@/components/auth-guard";

type State = "verifying" | "approved" | "failed" | "timeout";

const POLL_INTERVAL = 2500;
const MAX_ATTEMPTS = 24; // ~60s

function PaymentReturnContent() {
  const router = useRouter();
  const params = useSearchParams();
  const reference = params.get("ref");
  const transactionId = params.get("id");

  const [state, setState] = useState<State>("verifying");
  const [failStatus, setFailStatus] = useState<string>("");
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;

    if (!reference) {
      setState("failed");
      setFailStatus("not_found");
      return;
    }

    let attempts = 0;

    const poll = async () => {
      if (cancelled.current) return;
      attempts++;

      try {
        const res = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference, transactionId }),
        });
        const data = await res.json();
        if (cancelled.current) return;

        if (data.status === "approved" && data.tournamentId) {
          setState("approved");
          router.replace(`/tournaments/${data.tournamentId}`);
          return;
        }
        if (["declined", "voided", "error", "not_found"].includes(data.status)) {
          setFailStatus(data.status);
          setState("failed");
          return;
        }
      } catch {
        // transient error — keep polling
      }

      if (attempts >= MAX_ATTEMPTS) {
        setState("timeout");
        return;
      }
      setTimeout(poll, POLL_INTERVAL);
    };

    poll();
    return () => {
      cancelled.current = true;
    };
  }, [reference, transactionId, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          {state === "verifying" && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="space-y-1">
                <h1 className="text-lg font-semibold">Confirmando tu pago…</h1>
                <p className="text-sm text-muted-foreground">
                  Estamos verificando tu pago con Wompi. No cierres esta ventana.
                </p>
              </div>
            </>
          )}

          {state === "approved" && (
            <>
              <CheckCircle2 className="h-10 w-10 text-green-600" />
              <div className="space-y-1">
                <h1 className="text-lg font-semibold">¡Pago aprobado!</h1>
                <p className="text-sm text-muted-foreground">
                  Llevándote a tu torneo…
                </p>
              </div>
            </>
          )}

          {state === "failed" && (
            <>
              <XCircle className="h-10 w-10 text-destructive" />
              <div className="space-y-1">
                <h1 className="text-lg font-semibold">El pago no se completó</h1>
                <p className="text-sm text-muted-foreground">
                  {failStatus === "declined"
                    ? "Tu pago fue rechazado. Intenta con otro medio de pago."
                    : failStatus === "not_found"
                      ? "No encontramos el pago. Si te cobraron, contáctanos."
                      : "No pudimos procesar el pago. Intenta de nuevo."}
                </p>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link href="/dashboard">Ir al dashboard</Link>
                </Button>
                <Button asChild>
                  <Link href="/tournaments/create">Reintentar</Link>
                </Button>
              </div>
            </>
          )}

          {state === "timeout" && (
            <>
              <Loader2 className="h-10 w-10 text-muted-foreground" />
              <div className="space-y-1">
                <h1 className="text-lg font-semibold">
                  Estamos confirmando tu pago
                </h1>
                <p className="text-sm text-muted-foreground">
                  Esto está tardando más de lo normal. Si tu pago fue aprobado,
                  tu torneo aparecerá en tu dashboard en unos minutos.
                </p>
              </div>
              <Button asChild>
                <Link href="/dashboard">Ir al dashboard</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <PaymentReturnContent />
      </Suspense>
    </AuthGuard>
  );
}
