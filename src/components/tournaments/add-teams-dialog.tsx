"use client";

import { useEffect, useState } from "react";
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
  TIER_LABELS,
  formatCOP,
} from "@/lib/pricing";
import { generateIncrementalMatchesForGroup } from "@/data/helpers";
import { redirectToWompiCheckout, paymentReturnUrl } from "@/lib/payments/wompi-redirect";
import { Tournament, Team, TournamentGroup } from "@/types";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

interface AddTeamsDialogProps {
  tournament: Tournament;
}

interface UpgradeQuote {
  needsUpgrade: boolean;
  cobro: number;
  newTierLabel: string;
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
  const [groupAssignments, setGroupAssignments] = useState<Record<number, string>>({});
  const [quote, setQuote] = useState<UpgradeQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

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
    if (tournament.phaseConfigs?.length) {
      const activePhase = tournament.phaseConfigs.find((pc) => !pc.complete);
      if (activePhase) {
        return tournament.groups.filter((g) => g.phase === activePhase.phase);
      }
    }
    return tournament.groups;
  })();

  const hasGroups = availableGroups.length > 0;
  const allAssigned =
    count > 0 &&
    Array.from({ length: count }, (_, i) => i).every((i) => groupAssignments[i]);

  const currentTier =
    tournament.plan === "paid" && tournament.tier ? tournament.tier : null;
  const newTierInfo = getTournamentPriceInfo(newTotal);
  const needsUpgrade = quote?.needsUpgrade ?? false;
  const cobro = quote?.cobro ?? 0;

  // Fetch the upgrade quote server-side (honors the original bono) for display.
  useEffect(() => {
    if (!open) {
      setQuote(null);
      return;
    }
    if (step !== "count" || count < 1) return;

    let cancelled = false;
    setQuoteLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/payments/upgrade-quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tournamentId: tournament.id, addCount: count }),
        });
        const data = await res.json();
        if (!cancelled) setQuote(res.ok ? data : null);
      } catch {
        if (!cancelled) setQuote(null);
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, step, count, tournament.id]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setCountStr("1");
      setProcessing(false);
      setStep("count");
      setGroupAssignments({});
      setQuote(null);
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
    const byGroup: Record<string, string[]> = {};
    for (let i = 0; i < teamIds.length; i++) {
      const gId = groupAssignments[i];
      if (!gId) continue;
      if (!byGroup[gId]) byGroup[gId] = [];
      byGroup[gId].push(teamIds[i]);
    }

    for (const [groupId, ids] of Object.entries(byGroup)) {
      await assignTeamsToGroupFn(groupId, ids);
    }

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
        const matches = generateIncrementalMatchesForGroup(
          groupId,
          newIds,
          group.teamIds,
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

  // Free add (no payment): genuine free add, or a 100%-bono upgrade.
  const handleFreeAdd = async (setNewTier: boolean) => {
    setProcessing(true);
    const teamIds = await createAndLinkTeams();
    if (!teamIds) {
      setProcessing(false);
      return;
    }
    if (hasGroups) {
      await assignToGroupsAndGenerateMatches(teamIds);
    }
    if (setNewTier || (currentTier && getTier(newTotal) !== currentTier)) {
      await updateTournamentProps(tournament.id, {
        tier: newTierInfo.tier,
        price: newTierInfo.price,
      });
    }
    toast.success(
      `${count} ${count === 1 ? "equipo agregado" : "equipos agregados"}`
    );
    handleOpenChange(false);
    setProcessing(false);
  };

  // Paid upgrade: compute amount server-side, then redirect to Wompi.
  const handlePayRedirect = async () => {
    if (!user) return;
    setProcessing(true);

    const assignments = hasGroups
      ? Array.from({ length: count }, (_, i) => groupAssignments[i] ?? null)
      : null;

    try {
      const res = await fetch("/api/payments/upgrade-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          tournamentId: tournament.id,
          addCount: count,
          groupAssignments: assignments,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Error al iniciar el pago");
        setProcessing(false);
        return;
      }

      // 100% bono (or no charge needed) → add for free and set the new tier.
      if (!data.needsPayment) {
        await handleFreeAdd(true);
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;
      if (!publicKey) {
        toast.error("Error al cargar el sistema de pago. Intenta de nuevo.");
        setProcessing(false);
        return;
      }

      const returnUrl = paymentReturnUrl(data.reference);

      // Navigating away — keep `processing` true.
      redirectToWompiCheckout({
        publicKey,
        amountInCents: data.amountInCents,
        reference: data.reference,
        integrity: data.integrity,
        redirectUrl: returnUrl,
      });
    } catch (err) {
      console.error("Payment error:", err);
      toast.error("Error al procesar el pago");
      setProcessing(false);
    }
  };

  // Count step: decide whether to go to assignment or act now.
  const handleCountProceed = () => {
    if (hasGroups) {
      setStep("assign");
    } else if (needsUpgrade) {
      handlePayRedirect();
    } else {
      handleFreeAdd(false);
    }
  };

  // Assign step: act now (pay or free), with assignments collected.
  const handleAssignConfirm = () => {
    if (needsUpgrade) {
      handlePayRedirect();
    } else {
      handleFreeAdd(false);
    }
  };

  const countProceedLabel = hasGroups
    ? "Siguiente"
    : needsUpgrade
      ? "Ir a pagar"
      : "Agregar";

  return (
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
                <span className="text-muted-foreground">&rarr;</span>
                <span className="font-medium">
                  {newTotal} {isIndividual ? "jugadores" : "equipos"}
                </span>
              </div>

              {quoteLoading && count >= 1 && (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Calculando costo…
                </p>
              )}

              {!quoteLoading && needsUpgrade && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {currentTier ? (
                        <>
                          {TIER_LABELS[currentTier]} &rarr; {newTierInfo.tierLabel}
                        </>
                      ) : (
                        <>Gratis &rarr; {newTierInfo.tierLabel}</>
                      )}
                    </span>
                    <Badge className="text-xs">Upgrade</Badge>
                  </div>
                  {cobro > 0 ? (
                    <p className="text-2xl font-bold text-primary">
                      {formatCOP(cobro)}
                    </p>
                  ) : (
                    <p className="text-2xl font-bold text-green-600">Gratis</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {cobro > 0
                      ? "Diferencia por cambio de rango (con tu bono aplicado)"
                      : "Cubierto por tu bono"}
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
              <Button
                className="flex-1"
                onClick={handleCountProceed}
                disabled={processing || quoteLoading || count < 1}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {needsUpgrade && !hasGroups ? "Redirigiendo..." : "Procesando..."}
                  </>
                ) : (
                  countProceedLabel
                )}
              </Button>
            </div>
          </>
        ) : (
          /* Step 2: Group Assignment (before payment) */
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
                        setGroupAssignments((prev) => ({ ...prev, [i]: val }))
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
                onClick={handleAssignConfirm}
                disabled={processing || !allAssigned}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {needsUpgrade ? "Redirigiendo..." : "Asignando..."}
                  </>
                ) : needsUpgrade ? (
                  "Ir a pagar"
                ) : (
                  "Confirmar"
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
