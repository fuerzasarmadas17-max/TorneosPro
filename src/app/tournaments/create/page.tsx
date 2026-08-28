"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { CreateTournamentForm } from "@/components/forms/create-tournament-form";
import { CreditBalanceBar } from "@/components/tournaments/credit-balance-bar";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

/** Aviso de vuelta del pago de un paquete. La página de retorno manda acá con
 *  `?paquete=ok` porque un paquete no deja un torneo al que ir — deja créditos,
 *  y este es el lugar donde se usan. */
function PackPurchased() {
  const paid = useSearchParams().get("paquete") === "ok";
  if (!paid) return null;
  return (
    <Card className="mb-4 border-green-500/30 bg-green-500/5">
      <CardContent className="flex items-center gap-3 py-4">
        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
        <p className="text-sm">
          <strong>Listo, tus torneos ya están disponibles.</strong> Armá el
          primero acá abajo — al pagarlo vas a poder usar uno de tus créditos.
        </p>
      </CardContent>
    </Card>
  );
}

export default function CreateTournamentPage() {
  return (
    <AuthGuard>
      <div className="container mx-auto px-4 py-8">
        <Suspense>
          <PackPurchased />
        </Suspense>
        <CreditBalanceBar />
        <CreateTournamentForm />
      </div>
    </AuthGuard>
  );
}
