"use client";

import { useRef, useState } from "react";
import Script from "next/script";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { generateIncrementalMatchesForGroup } from "@/data/helpers";
import { Tournament, Team, TournamentGroup } from "@/types";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

interface AddTeamsDialogProps {
  tournament: Tournament;
}

export function AddTeamsDialog({ tournament }: AddTeamsDialogProps) {
  const {
    addTeams,
    addTeamsToTournament,
    updateTournamentProps,
    assignTeamsToGroupFn,
    addMatchesToTournament,
  } = useTournaments();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"count" | "assign">("count");
  const [countStr, setCountStr] = useState("1");
  const [processing, setProcessing] = useState(false);
  const [wompiReady, setWompiReady] = useState(false);
  const [groupAssignments, setGroupAssignments] = useState<Record<number, string>>({});
  const pendingTeamIdsRef = useRef<string[] | null>(null);

  const count = parseInt(countStr) || 0;
  const currentCount = tournament.teamIds.length;
  const newTotal = currentCount + count;
  const isIndividual =
    tournament.sport === "ping-pong" ||
    tournament.sport === "tenis" ||
    tournament.sport === "padel";

  // Groups available for assignment
  const availableGroups: TournamentGroup[] = (() => {
    if (!tournament.groups || tournament.groups.length === 0) return [];
    // For multi-phase: only show groups from the active (first incomplete) phase
    if (tournament.phaseConfigs?.length) {
      const activePhase = tournament.phaseConfigs.find((pc) => !pc.complete);
      if (activePhase) {
        return tournament.groups.filter((g) => g.phase === activePhase.phase);
      }
    }
    // Single-phase or no phases: show all groups
    return tournament.groups;
  })();

  const hasGroups = availableGroups.length > 0;
  const allAssigned =
    count > 0 &&
    Array.from({ length: count }, (_, i) => i).every(
      (i) => groupAssignments[i]
    );

  // Tier calculations
  const currentTier =
    tournament.plan === "paid" && tournament.tier ? tournament.tier : null;
  const currentTierPrice = currentTier ? TIER_PRICES[currentTier] : 0;
  const newTierInfo = getTournamentPriceInfo(newTotal);
  const needsUpgrade = currentTier
    ? newTierInfo.price > currentTierPrice
    : tournament.plan === "free" && newTotal > 10;
  const upgradeCost = currentTier
    ? newTierInfo.price - currentTierPrice
    : newTierInfo.price;

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setCountStr("1");
      setProcessing(false);
      setStep("count");
      setGroupAssignments({});
    }
    setOpen(isOpen);
  };

  const createAndLinkTeams = async (): Promise<string[] | null> => {
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
      return null;
    }

    const ok = await addTeamsToTournament(tournament.id, teamIds);
    if (!ok) {
      toast.error("Error al agregar equipos al torneo");
      return null;
    }

    return teamIds;
  };

  const assignToGroupsAndGenerateMatches = async (teamIds: string[]) => {
    // Group teamIds by their assigned groupId
    const byGroup: Record<string, string[]> = {};
    for (let i = 0; i < teamIds.length; i++) {
      const gId = groupAssignments[i];
      if (!gId) continue;
      if (!byGroup[gId]) byGroup[gId] = [];
      byGroup[gId].push(teamIds[i]);
    }

    // Assign teams to groups in DB
    for (const [groupId, ids] of Object.entries(byGroup)) {
      await assignTeamsToGroupFn(groupId, ids);
    }

    // Generate incremental matches if calendar already exists
    const hasMatches = tournament.matches.some((m) => m.phase === "group");
    if (hasMatches) {
      const maxMatchNumber = Math.max(
        ...tournament.matches.map((m) => m.matchNumber),
        0
      );
      let counter = maxMatchNumber + 1;
      const allNewMatches = [];

      for (const [groupId, newIds] of Object.entries(byGroup)) {
        const group = availableGroups.find((g) => g.id === groupId);
        if (!group) continue;
        const existingTeamIds = group.teamIds; // teams already in the group
        const matches = generateIncrementalMatchesForGroup(
          groupId,
          newIds,
          existingTeamIds,
          tournament.id,
          counter,
          tournament.doubleRoundRobin
        );
        allNewMatches.push(...matches);
        counter += matches.length;
      }

      if (allNewMatches.length > 0) {
        await addMatchesToTournament(tournament.id, allNewMatches);
        toast.success(`${allNewMatches.length} partidos nuevos generados`);
      }
    }
  };

  const finishAdd = async (teamIds: string[]) => {
    if (hasGroups) {
      await assignToGroupsAndGenerateMatches(teamIds);
    }

    // Update tier/price if needed
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
  };

  // Step 1 → proceed to step 2 or directly add
  const handleProceed = () => {
    if (hasGroups) {
      setStep("assign");
    } else {
      handleAddFree();
    }
  };

  const handleAddFree = async () => {
    setProcessing(true);
    const teamIds = await createAndLinkTeams();
    if (teamIds) {
      await finishAdd(teamIds);
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

          const teamIds = await createAndLinkTeams();
          if (teamIds) {
            await updateTournamentProps(tournament.id, {
              tier: newTierInfo.tier,
              price: newTierInfo.price,
              plan: "paid",
            });

            await fetch("/api/payments/link-tournament", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paymentId,
                tournamentId: tournament.id,
              }),
            }).catch(() => {});

            if (hasGroups) {
              // After payment, go to assignment step
              setProcessing(false);
              setStep("assign");
              pendingTeamIdsRef.current = teamIds;
              return;
            }

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

  const handleConfirmAssignment = async () => {
    setProcessing(true);
    // Check if we have pending team IDs from a payment flow
    const pendingIds = pendingTeamIdsRef.current;
    if (pendingIds) {
      pendingTeamIdsRef.current = null;
      await assignToGroupsAndGenerateMatches(pendingIds);
      toast.success(
        `${count} ${count === 1 ? "equipo agregado" : "equipos agregados"}`
      );
      handleOpenChange(false);
      setProcessing(false);
      return;
    }

    // Free flow: create teams then assign
    const teamIds = await createAndLinkTeams();
    if (teamIds) {
      await finishAdd(teamIds);
    }
    setProcessing(false);
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
            <DialogTitle>
              {step === "count" ? "Agregar Equipos" : "Asignar a Grupos"}
            </DialogTitle>
            <DialogDescription>{tournament.name}</DialogDescription>
          </DialogHeader>

          {step === "count" ? (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">
                    Cantidad de {isIndividual ? "jugadores" : "equipos"} a
                    agregar
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
                  <span className="text-muted-foreground">&rarr;</span>
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
                            {TIER_LABELS[currentTier]} &rarr;{" "}
                            {newTierInfo.tierLabel}
                          </>
                        ) : (
                          <>Gratis &rarr; {newTierInfo.tierLabel}</>
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
                    onClick={handleProceed}
                    disabled={processing || count < 1}
                  >
                    {processing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Agregando...
                      </>
                    ) : hasGroups ? (
                      "Siguiente"
                    ) : (
                      "Agregar"
                    )}
                  </Button>
                )}
              </div>
            </>
          ) : (
            /* Step 2: Group Assignment */
            <>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Elige a que grupo asignar cada{" "}
                  {isIndividual ? "jugador" : "equipo"} nuevo.
                </p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {Array.from({ length: count }, (_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm w-28 shrink-0 truncate">
                        {isIndividual
                          ? `Jugador ${currentCount + i + 1}`
                          : `Equipo ${currentCount + i + 1}`}
                      </span>
                      <Select
                        value={groupAssignments[i] || ""}
                        onValueChange={(val) =>
                          setGroupAssignments((prev) => ({
                            ...prev,
                            [i]: val,
                          }))
                        }
                      >
                        <SelectTrigger className="h-9 flex-1">
                          <SelectValue placeholder="Seleccionar grupo" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableGroups.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name} ({g.teamIds.length} equipos)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setStep("count");
                    setGroupAssignments({});
                  }}
                  disabled={processing}
                >
                  Atras
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleConfirmAssignment}
                  disabled={processing || !allAssigned}
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Asignando...
                    </>
                  ) : (
                    "Confirmar"
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
