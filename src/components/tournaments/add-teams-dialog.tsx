"use client";

import { useState } from "react";
import Script from "next/script";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTournaments } from "@/context/tournament-context";
import { useAuth } from "@/context/auth-context";
import {
  getTier,
  getTournamentPriceInfo,
  TIER_PRICES,
  TIER_LABELS,
  formatCOP,
} from "@/lib/pricing";
import { Tournament, Team } from "@/types";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

interface AddTeamsDialogProps {
  tournament: Tournament;
}

export function AddTeamsDialog({ tournament }: AddTeamsDialogProps) {
  const { addTeams, addTeamsToTournament, updateTournamentProps } =
    useTournaments();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [countStr, setCountStr] = useState("1");
  const [processing, setProcessing] = useState(false);
  const [wompiReady, setWompiReady] = useState(false);

  const count = parseInt(countStr) || 0;
  const currentCount = tournament.teamIds.length;
  const newTotal = currentCount + count;
  const isIndividual = tournament.sport === "ping-pong" || tournament.sport === "tenis" || tournament.sport === "padel";

  // Tier calculations
  const currentTier = tournament.plan === "paid" && tournament.tier
    ? tournament.tier
    : null;
  const currentTierPrice = currentTier ? TIER_PRICES[currentTier] : 0;
  const newTierInfo = getTournamentPriceInfo(newTotal);
  const needsUpgrade = currentTier
    ? newTierInfo.price > currentTierPrice
    : tournament.plan === "free" && newTotal > 10; // free → paid
  const upgradeCost = currentTier
    ? newTierInfo.price - currentTierPrice
    : newTierInfo.price;

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setCountStr("1");
      setProcessing(false);
    }
    setOpen(isOpen);
  };

  const createAndLinkTeams = async () => {
    const newTeams: Team[] = Array.from({ length: count }, (_, i) => ({
      id: `temp-${Date.now()}-${i}`,
      name: isIndividual
        ? `Jugador ${currentCount + i + 1}`
        : `Equipo ${currentCount + i + 1}`,
      players: [],
    }));

    const teamIds = await addTeams(newTeams);
    if (teamIds.length === 0) {
      toast.error("Error al crear los equipos");
      return false;
    }

    const ok = await addTeamsToTournament(tournament.id, teamIds);
    if (!ok) {
      toast.error("Error al agregar equipos al torneo");
      return false;
    }

    return true;
  };

  const handleAddFree = async () => {
    setProcessing(true);
    const ok = await createAndLinkTeams();
    if (ok) {
      // Update tier/price if tournament was already paid
      if (currentTier && getTier(newTotal) !== currentTier) {
        await updateTournamentProps(tournament.id, {
          tier: newTierInfo.tier,
          price: newTierInfo.price,
        });
      }
      toast.success(
        `${count} ${count === 1 ? "equipo agregado" : "equipos agregados"}`
      );
      handleOpenChange(false);
    }
    setProcessing(false);
  };

  const handlePayAndAdd = async () => {
    if (!user) return;
    setProcessing(true);

    try {
      const response = await fetch("/api/payments/create-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          amountCop: upgradeCost,
          tournamentData: {
            type: "upgrade",
            tournamentId: tournament.id,
            newTier: newTierInfo.tier,
            newPrice: newTierInfo.price,
            teamsToAdd: count,
            isIndividual,
            currentCount,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Error al iniciar el pago");
        setProcessing(false);
        return;
      }

      const { reference, amountInCents, integrity, paymentId } =
        await response.json();

      const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;

      if (!publicKey || !window.WidgetCheckout) {
        toast.error("Error al cargar el sistema de pago. Intenta de nuevo.");
        setProcessing(false);
        return;
      }

      const checkout = new window.WidgetCheckout({
        currency: "COP",
        amountInCents,
        reference,
        publicKey,
        signature: { integrity },
      });

      checkout.open(async (result: WompiTransactionResult) => {
        const transaction = result?.transaction;

        if (!transaction) {
          toast.error("No se recibio respuesta del pago");
          setProcessing(false);
          return;
        }

        if (transaction.status === "APPROVED") {
          toast.success("Pago aprobado");

          // Create teams and link
          const ok = await createAndLinkTeams();
          if (ok) {
            // Update tournament tier/price/plan
            await updateTournamentProps(tournament.id, {
              tier: newTierInfo.tier,
              price: newTierInfo.price,
              plan: "paid",
            });

            // Update payment with tournament_id
            await fetch("/api/payments/link-tournament", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paymentId,
                tournamentId: tournament.id,
              }),
            }).catch(() => {});

            toast.success(
              `${count} ${count === 1 ? "equipo agregado" : "equipos agregados"}`
            );
          }
          handleOpenChange(false);
        } else if (transaction.status === "DECLINED") {
          toast.error("Pago rechazado. Intenta con otro metodo de pago.");
        } else {
          toast.error("Error en el pago. Intenta de nuevo.");
        }
        setProcessing(false);
      });
    } catch (err) {
      console.error("Payment error:", err);
      toast.error("Error al procesar el pago");
      setProcessing(false);
    }
  };

  return (
    <>
      <Script
        src="https://checkout.wompi.co/widget.js"
        strategy="lazyOnload"
        onReady={() => setWompiReady(true)}
      />
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Agregar Equipos
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Agregar Equipos</DialogTitle>
            <DialogDescription>{tournament.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">
                Cantidad de {isIndividual ? "jugadores" : "equipos"} a agregar
              </Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={countStr}
                onChange={(e) => setCountStr(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {currentCount} {isIndividual ? "jugadores" : "equipos"}
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium">
                {newTotal} {isIndividual ? "jugadores" : "equipos"}
              </span>
            </div>

            {needsUpgrade && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {currentTier ? (
                      <>
                        {TIER_LABELS[currentTier]} → {newTierInfo.tierLabel}
                      </>
                    ) : (
                      <>Gratis → {newTierInfo.tierLabel}</>
                    )}
                  </span>
                  <Badge className="text-xs">Upgrade</Badge>
                </div>
                <p className="text-2xl font-bold text-primary">
                  {formatCOP(upgradeCost)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {currentTier
                    ? "Diferencia de precio por cambio de rango"
                    : "Pago unico por el torneo"}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
              disabled={processing}
            >
              Cancelar
            </Button>
            {needsUpgrade ? (
              <Button
                className="flex-1"
                onClick={handlePayAndAdd}
                disabled={processing || !wompiReady || count < 1}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  "Pagar y Agregar"
                )}
              </Button>
            ) : (
              <Button
                className="flex-1"
                onClick={handleAddFree}
                disabled={processing || count < 1}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Agregando...
                  </>
                ) : (
                  "Agregar"
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
