"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stepper } from "@/components/ui/stepper";
import { useAuth } from "@/context/auth-context";
import { useTournaments } from "@/context/tournament-context";
import { SPORTS } from "@/data/sports";
import { SCOPES, DEPARTMENTS, getDepartment } from "@/data/colombia";
import { Sport, TournamentFormat, TournamentScope, Team, Tournament, TournamentGroup, PlayoffConfig, PhaseConfig, MatchEventType, getAvailableStats, getDefaultStats, getWinPoints, FAIR_PLAY_POINTS } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Minus, Trophy, ListOrdered, Network } from "lucide-react";
import { getTournamentPriceInfo, TournamentPriceInfo, checkFreeTier, FREE_TIER_LIMITS, distributeTeamsToGroups } from "@/lib/pricing";
import { TournamentCostDialog, FORMAT_LABELS } from "./tournament-cost-dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";

const INDIVIDUAL_SPORTS: Sport[] = ["tenis", "padel", "ping-pong"];

interface GroupEntry {
  /** Stable client-side id. Becomes the "temp id" passed to createTournament,
   *  which the DB layer translates to a real UUID. */
  id: string;
  name: string;
}

const phase2GroupId = (i: number) => `temp-phase2-group-${i}`;

const GROUP_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

/** Visual format picker options — plain-language explanation of each format so
 *  organizers don't need to know the technical jargon. `paid` marks formats not
 *  available on the free tier (only "elimination" is free; see FREE_TIER_LIMITS). */
const FORMAT_OPTIONS: {
  value: TournamentFormat;
  icon: typeof Trophy;
  title: string;
  tagline: string;
  description: string;
  paid: boolean;
}[] = [
  {
    value: "elimination",
    icon: Trophy,
    title: "Eliminación directa",
    tagline: "Estilo copa",
    description: "El que pierde queda fuera. Se juega por rondas hasta la final.",
    paid: false,
  },
  {
    value: "round-robin",
    icon: ListOrdered,
    title: "Liga",
    tagline: "Todos contra todos",
    description: "Todos juegan contra todos. Gana el que sume más puntos en la tabla.",
    paid: true,
  },
  {
    value: "group-playoff",
    icon: Network,
    title: "Grupos + Playoffs",
    tagline: "Fase de grupos y luego copa",
    description: "Primero grupos (todos contra todos) y los mejores pasan a una llave de eliminación.",
    paid: true,
  },
];

const WIZARD_STEPS = [
  { label: "Esencial" },
  { label: "Formato" },
  { label: "Detalles" },
  { label: "Confirmar" },
];

/** Big +/- counter, friendlier than a tiny number input for older users.
 *  Shows "—" while the value is still below `min` (i.e. not chosen yet). */
function CountStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  size = "lg",
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  size?: "lg" | "sm";
}) {
  const dec = () => onChange(value <= min ? min : value - 1);
  const inc = () => onChange(value < min ? min : Math.min(max, value + 1));
  const big = size === "lg";
  const btn = big ? "h-14 w-14" : "h-10 w-10";
  const icon = big ? "h-6 w-6" : "h-4 w-4";
  const num = big ? "min-w-[2.5rem] text-4xl" : "min-w-[1.75rem] text-2xl";
  const gap = big ? "gap-5" : "gap-2";
  return (
    <div className={`flex items-center ${gap}`}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={`${btn} rounded-full shrink-0`}
        onClick={dec}
        disabled={value <= min}
        aria-label="Quitar uno"
      >
        <Minus className={icon} />
      </Button>
      <span className={`${num} text-center font-bold tabular-nums`}>
        {value >= min && value > 0 ? value : "—"}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={`${btn} rounded-full shrink-0`}
        onClick={inc}
        disabled={value >= max}
        aria-label="Agregar uno"
      >
        <Plus className={icon} />
      </Button>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

export function CreateTournamentForm() {
  const { user } = useAuth();
  const { addTournament, addTeams, tournaments, removeTournament } = useTournaments();
  const router = useRouter();

  const [step, setStep] = useState(1);
  // Sub-step within the "Formato" step: 1 = pick the format card, 2 = configure
  // participants + groups. Keeps each screen focused and easy to read.
  const [formatSubStep, setFormatSubStep] = useState(1);
  const [name, setName] = useState("");
  const [sport, setSport] = useState<Sport | "">("");
  const [format, setFormat] = useState<TournamentFormat | "">("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [teamCount, setTeamCount] = useState<string>("");
  const [groups, setGroups] = useState<GroupEntry[]>([]);
  // Per-group advancement counts keyed by group id (stable client-side uuid for
  // phase 1, or `temp-phase2-group-${i}` for phase 2). Read-time helpers fall
  // back to a uniform default when a key is missing — this lets the user start
  // with all groups equal and only override the ones that need to differ.
  const [advance1Map, setAdvance1Map] = useState<Record<string, string>>({});
  const [advance2Map, setAdvance2Map] = useState<Record<string, string>>({});
  const [enabledStats, setEnabledStats] = useState<MatchEventType[]>([]);
  const [bestOf, setBestOf] = useState<3 | 5>(3);
  const [hasPhase2, setHasPhase2] = useState(false);
  const [phase2GroupCount, setPhase2GroupCount] = useState("2");

  // Default cupo that fills any group whose value isn't explicitly set.
  const DEFAULT_ADVANCE = "2";
  const readAdvance1 = (groupId: string) => advance1Map[groupId] ?? DEFAULT_ADVANCE;
  const readAdvance2 = (groupId: string) => advance2Map[groupId] ?? DEFAULT_ADVANCE;
  const setAdvance1 = (groupId: string, val: string) =>
    setAdvance1Map((m) => ({ ...m, [groupId]: val }));
  const setAdvance2 = (groupId: string, val: string) =>
    setAdvance2Map((m) => ({ ...m, [groupId]: val }));
  const applyAdvance1ToAll = (val: string) =>
    setAdvance1Map(Object.fromEntries(groups.map((g) => [g.id, val])));
  const applyAdvance2ToAll = (val: string) => {
    const p2 = parseInt(phase2GroupCount) || 0;
    setAdvance2Map(
      Object.fromEntries(Array.from({ length: p2 }, (_, i) => [phase2GroupId(i), val]))
    );
  };

  // Totals derived from the per-group maps. When a key is missing the default
  // (2) is used, so the totals reflect what would be submitted right now.
  const advance1Total = groups.reduce(
    (sum, g) => sum + (parseInt(readAdvance1(g.id)) || 0),
    0
  );
  const advance2Total = (() => {
    const p2 = parseInt(phase2GroupCount) || 0;
    let sum = 0;
    for (let i = 0; i < p2; i++) sum += parseInt(readAdvance2(phase2GroupId(i))) || 0;
    return sum;
  })();
  const [scope, setScope] = useState<TournamentScope | "">("");
  const [department, setDepartment] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [error, setError] = useState("");
  const [showCostDialog, setShowCostDialog] = useState(false);
  // Confirmación de "Juego Limpio": prenderla cambia la puntuación del torneo.
  const [confirmFairPlay, setConfirmFairPlay] = useState(false);
  const [priceInfo, setPriceInfo] = useState<TournamentPriceInfo | null>(null);
  const [creating, setCreating] = useState(false);

  const isIndividual = sport ? INDIVIDUAL_SPORTS.includes(sport as Sport) : false;
  const participantLabel = isIndividual ? "Jugadores" : "Equipos";

  const teamCountNum = parseInt(teamCount);

  // Free tier detection
  const freeTierCheck = checkFreeTier({
    format: (format || "elimination") as TournamentFormat,
    teamCount: teamCountNum || 0,
    enabledStatsCount: enabledStats.length,
    groupCount: groups.length,
  });

  const activeFreeCount = tournaments.filter(
    (t) => t.plan === "free" && t.createdBy === user?.id && t.status !== "completed"
  ).length;
  const canUseFree = freeTierCheck.isFree && activeFreeCount < FREE_TIER_LIMITS.maxActiveFree;

  // Grow/shrink the groups list to an exact count (driven by the +/- stepper).
  // Adds new groups at the end, or trims from the end and cleans their cupos.
  const setGroupCount = (target: number) => {
    const n = Math.max(0, target);
    if (n > groups.length) {
      const next = [...groups];
      while (next.length < n) {
        const letter = GROUP_LETTERS[next.length] || `${next.length + 1}`;
        next.push({ id: crypto.randomUUID(), name: `Grupo ${letter}` });
      }
      setGroups(next);
    } else if (n < groups.length) {
      const removed = groups.slice(n);
      setGroups(groups.slice(0, n));
      setAdvance1Map((m) => {
        const next = { ...m };
        removed.forEach((g) => delete next[g.id]);
        return next;
      });
    }
  };

  // Per-step validation — reuses the exact same checks/messages as the final
  // submit so gating "Siguiente" and the final create stay consistent.
  const getStepError = (s: number): string | null => {
    const count = parseInt(teamCount);

    if (s === 1) {
      if (!name.trim()) return "El nombre del torneo es obligatorio";
      if (!sport) return "Selecciona un deporte";
      if (!startDate) return "Selecciona una fecha de inicio";
      return null;
    }

    if (s === 2) {
      if (!format) return "Selecciona un formato";
      if (isNaN(count) || count < 2) {
        return `Necesitas al menos 2 ${participantLabel.toLowerCase()}`;
      }
      if (format === "elimination") {
        const isPowerOf2 = count > 0 && (count & (count - 1)) === 0;
        if (!isPowerOf2) {
          return `Para eliminacion directa necesitas 2, 4, 8 o 16 ${participantLabel.toLowerCase()}`;
        }
      }
      if (format === "round-robin" && count < 3) {
        return `Para liga necesitas al menos 3 ${participantLabel.toLowerCase()}`;
      }
      if (format === "group-playoff" && groups.length < 1) {
        return "Necesitas al menos 1 grupo";
      }
      const hasGroups = (format === "round-robin" || format === "group-playoff") && groups.length > 0;
      if (hasGroups) {
        const perGroup = Math.floor(count / groups.length);
        if (perGroup < 2) {
          return `No hay suficientes ${participantLabel.toLowerCase()} para ${groups.length} grupos (minimo 2 por grupo)`;
        }
        if (format === "group-playoff" && !hasPhase2) {
          // Validate per-group cupos for single-phase format.
          for (const g of groups) {
            const n = parseInt(readAdvance1(g.id));
            if (isNaN(n) || n < 1) return `Cupo invalido en ${g.name}`;
          }
          if (advance1Total < 2) return "Deben clasificar al menos 2 en total";
          if (advance1Total > count) {
            return "Los que clasifican no pueden superar el total de equipos";
          }
        }
        if (format === "group-playoff" && hasPhase2) {
          // Phase 1: each group needs a valid cupo.
          for (const g of groups) {
            const n = parseInt(readAdvance1(g.id));
            if (isNaN(n) || n < 1) return `Cupo invalido en ${g.name} (fase 1)`;
          }
          if (advance1Total < 2) return "En fase 1 deben clasificar al menos 2 en total";
          // Phase 2: each phase-2 group needs a valid cupo, and the count must
          // be enough to receive the phase 1 advancers.
          const p2 = parseInt(phase2GroupCount) || 0;
          if (p2 < 1) return "Fase 2 necesita al menos 1 grupo";
          if (advance1Total < p2 * 2) {
            return `Fase 2 necesita al menos 2 ${participantLabel.toLowerCase()} por grupo`;
          }
          for (let i = 0; i < p2; i++) {
            const n = parseInt(readAdvance2(phase2GroupId(i)));
            if (isNaN(n) || n < 1) return `Cupo invalido en grupo de fase 2`;
          }
          if (advance2Total < 2) return "A playoffs deben pasar al menos 2";
        }
      }
      return null;
    }

    if (s === 3) {
      if (!scope) return "Selecciona el alcance del torneo";
      if ((scope === "departamental" || scope === "municipal") && !department) {
        return "Selecciona un departamento";
      }
      if (scope === "municipal" && !municipality) return "Selecciona un municipio";
      return null;
    }

    return null;
  };

  const getAllErrors = (): { step: number; message: string } | null => {
    for (let s = 1; s <= 3; s++) {
      const message = getStepError(s);
      if (message) return { step: s, message };
    }
    return null;
  };

  const goNext = () => {
    // "Formato" is split into two sub-screens. From the format picker, advance to
    // the configuration sub-screen instead of jumping to the next wizard step.
    if (step === 2 && formatSubStep === 1) {
      if (!format) {
        setError("Selecciona un formato");
        return;
      }
      setError("");
      setFormatSubStep(2);
      return;
    }
    const err = getStepError(step);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    // Entering "Formato" from step 1 always starts on the format picker.
    if (step === 1) setFormatSubStep(1);
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length));
  };

  const goBack = () => {
    setError("");
    // From the configuration sub-screen, go back to the format picker first.
    if (step === 2 && formatSubStep === 2) {
      setFormatSubStep(1);
      return;
    }
    // Returning to "Formato" from a later step lands on the configuration screen.
    if (step === 3) setFormatSubStep(2);
    setStep((s) => Math.max(s - 1, 1));
  };

  // Build tournament data for the payment record (used by webhook recovery)
  const buildTournamentData = (): Record<string, unknown> => {
    const count = parseInt(teamCount);
    const p2Count = parseInt(phase2GroupCount) || 0;

    // Per-group cupos keyed by index (group position). The server side
    // (fulfill.ts) re-keys these by its own temp group ids when rebuilding
    // the tournament. Legacy uniform fields are also sent so older payments
    // can still be fulfilled if the payload format changes again.
    const advance1ByIdx: Record<number, number> = {};
    groups.forEach((g, i) => {
      advance1ByIdx[i] = parseInt(readAdvance1(g.id)) || 0;
    });
    const advance2ByIdx: Record<number, number> = {};
    for (let i = 0; i < p2Count; i++) {
      advance2ByIdx[i] = parseInt(readAdvance2(phase2GroupId(i))) || 0;
    }
    const legacy1 = groups.length > 0 ? Math.round(advance1Total / groups.length) : 0;
    const legacy2 = p2Count > 0 ? Math.round(advance2Total / p2Count) : 0;

    return {
      name: name.trim(),
      sport,
      format,
      description: description.trim() || null,
      startDate,
      teamCount: count,
      isIndividual,
      enabledStats: enabledStats.length > 0 ? enabledStats : null,
      bestOf: sport === "volleyball" ? bestOf : null,
      groups: groups.map((g) => ({ name: g.name })),
      // New: per-group cupos by index.
      advance1ByIdx: format === "group-playoff" ? advance1ByIdx : null,
      advance2ByIdx: format === "group-playoff" && hasPhase2 ? advance2ByIdx : null,
      // Legacy uniform fields (kept for back-compat with in-flight payments).
      advanceCount: format === "group-playoff" ? (hasPhase2 ? legacy2 : legacy1) : null,
      hasPhase2,
      phase1AdvancePerGroup: hasPhase2 ? legacy1 : null,
      phase2GroupCount: hasPhase2 ? p2Count : null,
      phase2AdvancePerGroup: hasPhase2 ? legacy2 : null,
      price: priceInfo?.price ?? null,
      tier: priceInfo?.tier ?? null,
      scope: scope || null,
      department: department || null,
      municipality: municipality || null,
    };
  };

  const handleFinalSubmit = () => {
    setError("");

    const err = getAllErrors();
    if (err) {
      setStep(err.step);
      // If the error is in "Formato", land on the right sub-screen: the picker
      // when no format is chosen, otherwise the configuration screen.
      if (err.step === 2) setFormatSubStep(format ? 2 : 1);
      setError(err.message);
      return;
    }

    const count = parseInt(teamCount);

    // Free tier: create directly without cost dialog
    if (canUseFree) {
      createTournament("free");
      return;
    }

    // Paid: calculate tier price and show confirmation dialog
    const info = getTournamentPriceInfo(count);
    setPriceInfo(info);
    setShowCostDialog(true);
  };

  const createTournament = async (
    plan: "free" | "paid",
    couponId?: string,
    paymentId?: string,
    useCredit = false
  ) => {
    setCreating(true);
    try {
      // Claim coupon atomically BEFORE creating anything
      if (couponId) {
        const { data: claimed, error: claimError } = await supabase
          .from("coupons")
          .update({
            used_by: user!.id,
            used_at: new Date().toISOString(),
          })
          .eq("id", couponId)
          .is("used_by", null)
          .select("id")
          .single();

        if (claimError || !claimed) {
          toast.error("Este código promocional ya fue utilizado");
          setCreating(false);
          return;
        }
      }

      const count = parseInt(teamCount);
      const hasGroups = (format === "round-robin" || format === "group-playoff") && groups.length > 0;

      // Auto-generate teams with placeholder names
      const newTeams: Team[] = Array.from({ length: count }, (_, i) => ({
        id: `temp-${i}`,
        name: isIndividual ? `Jugador ${i + 1}` : `Equipo ${i + 1}`,
        players: [],
      }));

      // Insert teams into DB and get DB-generated IDs
      const dbTeamIds = await addTeams(newTeams);
      if (dbTeamIds.length !== count) {
        toast.error("Error al crear los equipos");
        setCreating(false);
        return;
      }

      let tournamentGroups: TournamentGroup[] | undefined;
      let playoffConfig: PlayoffConfig | undefined;
      let phaseConfigs: PhaseConfig[] | undefined;

      // Build groups: keep the stable client-side id from the wizard so the
      // perGroup maps below reference the same ids the DB layer will translate
      // to real UUIDs in createTournament().
      if (hasGroups) {
        tournamentGroups = groups.map((g) => ({
          id: g.id,
          name: g.name,
          teamIds: [],
          phase: 1,
        }));
        for (let i = 0; i < dbTeamIds.length; i++) {
          tournamentGroups[i % groups.length].teamIds.push(dbTeamIds[i]);
        }
      }

      // Build the perGroup map for phase 1 (also used as the playoff perGroup
      // when there's no phase 2). Legacy advancePerGroup is kept as the average
      // for clients that still read the uniform field.
      const perGroup1: Record<string, number> = Object.fromEntries(
        groups.map((g) => [g.id, parseInt(readAdvance1(g.id)) || 0])
      );
      const legacy1 = groups.length > 0 ? Math.round(advance1Total / groups.length) : 0;

      if (format === "group-playoff") {
        if (hasPhase2) {
          const p2GroupCount = parseInt(phase2GroupCount);

          // Create Phase 2 empty groups using the same id convention the
          // perGroup map uses (`temp-phase2-group-${i}`).
          const phase2Groups: TournamentGroup[] = Array.from({ length: p2GroupCount }, (_, i) => ({
            id: phase2GroupId(i),
            name: `Grupo ${GROUP_LETTERS[groups.length + i] || `${groups.length + i + 1}`}`,
            teamIds: [],
            phase: 2,
          }));
          tournamentGroups = [...(tournamentGroups || []), ...phase2Groups];

          const perGroup2: Record<string, number> = Object.fromEntries(
            phase2Groups.map((g) => [g.id, parseInt(readAdvance2(g.id)) || 0])
          );
          const legacy2 = p2GroupCount > 0 ? Math.round(advance2Total / p2GroupCount) : 0;

          phaseConfigs = [
            { phase: 1, advancePerGroup: legacy1, perGroup: perGroup1, nextGroupCount: p2GroupCount },
            { phase: 2, advancePerGroup: legacy2, perGroup: perGroup2 },
          ];

          playoffConfig = {
            advancePerGroup: legacy2,
            perGroup: perGroup2,
            totalAdvancing: advance2Total,
          };
        } else {
          // Single-phase group-playoff: phase 1 cupos go straight to playoffs.
          playoffConfig = {
            advancePerGroup: legacy1,
            perGroup: perGroup1,
            totalAdvancing: advance1Total,
          };
        }
      }

      const tournament: Tournament = {
        id: "temp",
        name: name.trim(),
        sport: sport as Sport,
        format: format as TournamentFormat,
        plan,
        status: "upcoming",
        description: description.trim() || undefined,
        createdBy: user!.id,
        teamIds: dbTeamIds,
        matches: [],
        createdAt: new Date().toISOString().split("T")[0],
        startDate,
        groups: tournamentGroups,
        playoffConfig,
        groupStageComplete: false,
        enabledStats: enabledStats.length > 0 ? enabledStats : undefined,
        bestOf: sport === "volleyball" ? bestOf : undefined,
        price: plan === "paid" && priceInfo ? priceInfo.price : undefined,
        tier: plan === "paid" && priceInfo ? priceInfo.tier : undefined,
        couponId: couponId ?? undefined,
        phaseConfigs,
        scope: scope as TournamentScope,
        department: department || undefined,
        municipality: municipality || undefined,
      };

      const newTournament = await addTournament(tournament);

      // Link coupon to tournament (used_by/used_at already set above)
      if (couponId && newTournament?.id) {
        await supabase
          .from("coupons")
          .update({ tournament_id: newTournament.id })
          .eq("id", couponId);
      }

      // Pagado con un crédito del paquete: se consume DESPUÉS de crear porque
      // el crédito necesita el id del torneo al que se ata.
      //
      // Si el consumo falla —otra pestaña se llevó el último, o venció entre
      // que se abrió el diálogo y se confirmó— el torneo se borra. Dejarlo
      // sería regalarlo: quedaría creado y pago sin que nadie haya pagado.
      if (useCredit && newTournament?.id) {
        const { data: creditId, error: creditError } = await supabase.rpc(
          "consume_tournament_credit",
          {
            p_user_id: user!.id,
            p_tournament_id: newTournament.id,
            p_team_count: parseInt(teamCount) || 1,
          }
        );

        if (creditError || !creditId) {
          console.error("No se pudo consumir el crédito", creditError);
          await removeTournament(newTournament.id);
          toast.error(
            "No se pudo usar tu crédito. Revisá tu saldo e intentá de nuevo."
          );
          setCreating(false);
          return;
        }
      }

      // Link payment to tournament
      if (paymentId && newTournament?.id) {
        await supabase
          .from("payments")
          .update({
            tournament_id: newTournament.id,
            status: "approved",
          })
          .eq("id", paymentId);
      }

      setShowCostDialog(false);
      toast.success("Torneo creado correctamente");
      router.push("/dashboard");
    } catch {
      toast.error("Error al crear el torneo");
    } finally {
      setCreating(false);
    }
  };

  // Summary labels (step 4)
  const sportInfo = SPORTS.find((s) => s.key === sport);
  const sportLabel = sportInfo ? `${sportInfo.emoji} ${sportInfo.label}` : "";
  const scopeLabel = SCOPES.find((s) => s.key === scope)?.label ?? "";
  const deptLabel = DEPARTMENTS.find((d) => d.key === department)?.label ?? "";
  const munLabel =
    getDepartment(department)?.municipalities.find((m) => m.key === municipality)?.label ?? "";

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Crear Torneo</CardTitle>
        <CardDescription>
          Configura tu nuevo torneo
        </CardDescription>
      </CardHeader>
      <form onSubmit={(e) => e.preventDefault()}>
        <CardContent className="space-y-6">
          <Stepper steps={WIZARD_STEPS} current={step} />

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* ===================== PASO 1 — Esencial ===================== */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Información General</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del Torneo</Label>
                  <Input
                    id="name"
                    placeholder="Ej: Copa Primavera 2025"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startDate">Fecha de Inicio</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Deporte</Label>
                <Select
                  value={sport}
                  onValueChange={(v) => {
                    const s = v as Sport;
                    setSport(s);
                    setEnabledStats(getDefaultStats(s));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar deporte" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPORTS.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.emoji} {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción (opcional)</Label>
                <Input
                  id="description"
                  placeholder="Descripción del torneo"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ===================== PASO 2 — Formato ===================== */}
          {step === 2 && (
            <div className="space-y-8">
              {/* Sub-step indicator: Formato › Configuración */}
              <div className="flex items-center gap-2 text-xs font-medium">
                <span className={formatSubStep === 1 ? "text-primary" : "text-muted-foreground"}>
                  1. Formato
                </span>
                <span className="text-border">›</span>
                <span className={formatSubStep === 2 ? "text-primary" : "text-muted-foreground"}>
                  2. Configuración
                </span>
              </div>

              {formatSubStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg">¿Cómo se va a jugar?</h3>
                  <p className="text-sm text-muted-foreground">
                    Elegí la forma en que se decide el campeón.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {FORMAT_OPTIONS.map((opt) => {
                    const selected = format === opt.value;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setFormat(opt.value);
                          // Only "group-playoff" uses groups. For elimination and liga,
                          // clear any group config so phantom groups don't contaminate
                          // pricing/validation/creation.
                          if (opt.value !== "group-playoff") {
                            setGroups([]);
                            setHasPhase2(false);
                            setAdvance1Map({});
                            setAdvance2Map({});
                          }
                        }}
                        className={`relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
                          selected
                            ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                            : "border-border hover:border-primary/50 hover:bg-muted/40"
                        }`}
                      >
                        {opt.paid && (
                          <Badge
                            variant="secondary"
                            className="absolute right-2 top-2 text-[10px]"
                          >
                            Plan pago
                          </Badge>
                        )}
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-full ${
                            selected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="space-y-0.5">
                          <p className="font-semibold leading-tight">{opt.title}</p>
                          <p className="text-xs font-medium text-primary/80">{opt.tagline}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{opt.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
              )}

              {formatSubStep === 2 && (
              <div className="space-y-8">
                {/* Recap of the chosen format + quick way back to change it */}
                {format && (() => {
                  const opt = FORMAT_OPTIONS.find((o) => o.value === format);
                  if (!opt) return null;
                  const Icon = opt.icon;
                  return (
                    <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold leading-tight">{opt.title}</p>
                          <p className="text-xs text-muted-foreground">{opt.tagline}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          setError("");
                          setFormatSubStep(1);
                        }}
                      >
                        Cambiar
                      </Button>
                    </div>
                  );
                })()}

              {/* Participants */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <h3 className="font-semibold text-xl">
                    ¿Cuántos {participantLabel.toLowerCase()} van a participar?
                  </h3>
                  {format === "elimination" && (
                    <p className="text-sm text-muted-foreground">
                      En eliminación directa deben ser 2, 4, 8 o 16.
                    </p>
                  )}
                </div>

                {format === "elimination" ? (
                  <div className="grid grid-cols-4 gap-2">
                    {[2, 4, 8, 16].map((n) => {
                      const selected = parseInt(teamCount) === n;
                      return (
                        <Button
                          key={n}
                          type="button"
                          variant={selected ? "default" : "outline"}
                          className="h-16 text-2xl font-bold"
                          onClick={() => setTeamCount(String(n))}
                        >
                          {n}
                        </Button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center rounded-lg border bg-muted/20 py-5">
                    <CountStepper
                      value={parseInt(teamCount) || 0}
                      min={2}
                      max={64}
                      onChange={(n) => setTeamCount(String(n))}
                    />
                  </div>
                )}
              </div>

              {/* Volleyball Sets Config */}
              {sport === "volleyball" && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-xl">¿A cuántos sets se juega?</h3>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={bestOf === 3 ? "default" : "outline"}
                      className="flex-1 h-12 text-base"
                      onClick={() => setBestOf(3)}
                    >
                      Mejor de 3
                    </Button>
                    <Button
                      type="button"
                      variant={bestOf === 5 ? "default" : "outline"}
                      className="flex-1 h-12 text-base"
                      onClick={() => setBestOf(5)}
                    >
                      Mejor de 5
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {bestOf === 3
                      ? "Gana el primero en llegar a 2 sets"
                      : "Gana el primero en llegar a 3 sets"}
                  </p>
                </div>
              )}

              {/* Liga = una sola tabla, sin grupos */}
              {format === "round-robin" && (
                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="text-sm text-muted-foreground">
                    En la liga todos juegan contra todos en una sola tabla. El que quede primero es el campeón.
                  </p>
                </div>
              )}

              {/* Group Configuration (solo Grupos + Playoffs) */}
              {format === "group-playoff" && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-xl">
                      ¿En cuántos grupos los dividimos?
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Mínimo 1 grupo. Los {participantLabel.toLowerCase()} se reparten solos entre los grupos.
                    </p>
                  </div>

                  <div className="flex items-center justify-center rounded-lg border bg-muted/20 py-5">
                    <CountStepper
                      value={groups.length}
                      min={1}
                      max={8}
                      onChange={setGroupCount}
                    />
                  </div>

                  {groups.length > 0 && (() => {
                    // Mirror the real distribution: teams are dealt round-robin, so the
                    // first groups get the extra when the count doesn't divide evenly.
                    const total = parseInt(teamCount) || 0;
                    const sizes = total > 0 ? distributeTeamsToGroups(total, groups.length) : [];
                    return (
                      <div className="flex flex-wrap gap-2">
                        {groups.map((group, gIdx) => {
                          const perGroup = sizes[gIdx]?.teamCount ?? 0;
                          return (
                            <span
                              key={group.id}
                              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium"
                            >
                              {group.name}
                              {perGroup > 0 && (
                                <span className="text-muted-foreground">
                                  · {perGroup} {participantLabel.toLowerCase()}
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Phases: one (groups → playoffs) vs two (groups → groups → playoffs) */}
                  {groups.length >= 1 && format === "group-playoff" && (
                    <div className="space-y-3 pt-2">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-xl">¿Cómo quieres la estructura?</h3>
                        <p className="text-sm text-muted-foreground">
                          Después de los grupos, ¿se juega directo la eliminación o hay otra ronda de grupos?
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          aria-pressed={!hasPhase2}
                          onClick={() => setHasPhase2(false)}
                          className={`flex flex-col items-start gap-1.5 rounded-lg border p-4 text-left transition-colors ${
                            !hasPhase2
                              ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                              : "border-border hover:border-primary/50 hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">Una fase</span>
                            <Badge variant="secondary" className="text-[10px]">
                              Lo más común
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Grupos → Playoffs (eliminación directa).
                          </p>
                        </button>
                        <button
                          type="button"
                          aria-pressed={hasPhase2}
                          onClick={() => setHasPhase2(true)}
                          className={`flex flex-col items-start gap-1.5 rounded-lg border p-4 text-left transition-colors ${
                            hasPhase2
                              ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                              : "border-border hover:border-primary/50 hover:bg-muted/40"
                          }`}
                        >
                          <span className="font-semibold">Dos fases</span>
                          <p className="text-xs text-muted-foreground">
                            Grupos → otra ronda de grupos → Playoffs.
                          </p>
                        </button>
                      </div>
                    </div>
                  )}

                  {groups.length >= 1 && format === "group-playoff" && !hasPhase2 && (
                    <div className="space-y-3 pt-2">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-xl">
                          ¿Cuántos pasan a la siguiente ronda?
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Los mejores de cada grupo pasan a los playoffs (eliminación).
                        </p>
                      </div>
                      {groups.length > 1 && (
                        <button
                          type="button"
                          className="text-sm font-medium text-primary hover:underline"
                          onClick={() => applyAdvance1ToAll(DEFAULT_ADVANCE)}
                        >
                          Pasar {DEFAULT_ADVANCE} en todos los grupos
                        </button>
                      )}
                      <div className="space-y-2 rounded-lg border p-3">
                        {groups.map((g) => (
                          <div key={g.id} className="flex items-center justify-between gap-3">
                            <span className="text-base font-medium">{g.name}</span>
                            <CountStepper
                              value={parseInt(readAdvance1(g.id)) || 0}
                              min={1}
                              max={parseInt(teamCount) || 2}
                              size="sm"
                              onChange={(n) => setAdvance1(g.id, String(n))}
                            />
                          </div>
                        ))}
                      </div>
                      {advance1Total > 0 && (
                        <p className="text-sm text-muted-foreground">
                          En total, {advance1Total} {participantLabel.toLowerCase()} pasan a playoffs
                          {(() => {
                            let p = 1;
                            while (p < advance1Total) p *= 2;
                            return p !== advance1Total
                              ? ` (${p - advance1Total} ${(p - advance1Total) > 1 ? "avanzan" : "avanza"} directo a la siguiente ronda)`
                              : "";
                          })()}
                          .
                        </p>
                      )}
                    </div>
                  )}

                  {/* Multi-phase: visual flow diagram */}
                  {groups.length >= 1 && format === "group-playoff" && hasPhase2 && (() => {
                    const label = participantLabel.toLowerCase();
                    const p1Total = advance1Total;
                    const p2Groups = parseInt(phase2GroupCount) || 1;
                    const p2PerGroup = Math.floor(p1Total / p2Groups);
                    const playoffTotal = advance2Total;
                    let bracket = 1;
                    while (bracket < playoffTotal) bracket *= 2;
                    const byes = bracket - playoffTotal;

                    // Group name lists
                    const p1Names = groups.map((_, i) => GROUP_LETTERS[i] || `${i + 1}`).join(", ");
                    const p2Names = Array.from({ length: p2Groups }, (_, i) => GROUP_LETTERS[groups.length + i] || `${groups.length + i + 1}`).join(", ");

                    return (
                      <div className="space-y-3 border rounded-lg p-4">
                        <h4 className="text-sm font-semibold">Así quedaría el torneo</h4>

                        {/* Fase 1 */}
                        <div className="rounded-md bg-muted/40 p-3 space-y-2">
                          <p className="text-sm font-medium">
                            {groups.length === 1
                              ? "Fase 1 — Liga (todos contra todos)"
                              : `Fase 1 — Grupos ${p1Names}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {groups.length === 1
                              ? "Todos los equipos juegan entre si."
                              : "Todos contra todos dentro de cada grupo."}
                          </p>
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {groups.length === 1
                                  ? "Cuántos avanzan a fase 2"
                                  : "Cupos a fase 2 por grupo"}
                              </span>
                              {groups.length > 1 && (
                                <button
                                  type="button"
                                  className="text-xs text-primary hover:underline"
                                  onClick={() => applyAdvance1ToAll(DEFAULT_ADVANCE)}
                                >
                                  Aplicar {DEFAULT_ADVANCE} a todos
                                </button>
                              )}
                            </div>
                            {groups.map((g) => (
                              <div key={g.id} className="flex items-center justify-between gap-2">
                                <span className="text-sm">{g.name}</span>
                                <Input
                                  type="number"
                                  min={1}
                                  max={Math.floor((parseInt(teamCount) || 2) / Math.max(groups.length, 1))}
                                  value={readAdvance1(g.id)}
                                  onChange={(e) => setAdvance1(g.id, e.target.value)}
                                  className="w-14 h-8 text-center text-sm"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Connector */}
                        <div className="flex flex-col items-center gap-0.5 text-muted-foreground">
                          <div className="w-px h-2 bg-border" />
                          <span className="text-xs font-medium">{p1Total} {label} pasan</span>
                          <div className="w-px h-2 bg-border" />
                        </div>

                        {/* Fase 2 */}
                        <div className="rounded-md bg-muted/40 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Fase 2 —</span>
                            <Input
                              type="number"
                              min={1}
                              max={4}
                              value={phase2GroupCount}
                              onChange={(e) => setPhase2GroupCount(e.target.value)}
                              className="w-14 h-8 text-center text-sm"
                            />
                            <span className="text-sm font-medium">
                              {p2Groups === 1 ? "grupo (todos contra todos)" : `grupos nuevos (${p2Names})`}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {p2Groups === 1
                              ? `Los ${p1Total} ${label} clasificados juegan todos entre si en una sola tabla.`
                              : `Se arman ${p2Groups} grupos nuevos de ${p2PerGroup} ${label} cada uno. Vuelven a jugar todos contra todos.`}
                          </p>
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {p2Groups === 1
                                  ? "Cuántos avanzan a playoffs"
                                  : "Cupos a playoffs por grupo"}
                              </span>
                              {p2Groups > 1 && (
                                <button
                                  type="button"
                                  className="text-xs text-primary hover:underline"
                                  onClick={() => applyAdvance2ToAll(DEFAULT_ADVANCE)}
                                >
                                  Aplicar {DEFAULT_ADVANCE} a todos
                                </button>
                              )}
                            </div>
                            {Array.from({ length: p2Groups }, (_, i) => {
                              const id = phase2GroupId(i);
                              const groupName = `Grupo ${GROUP_LETTERS[groups.length + i] || `${groups.length + i + 1}`}`;
                              return (
                                <div key={id} className="flex items-center justify-between gap-2">
                                  <span className="text-sm">{groupName}</span>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={p2PerGroup || 1}
                                    value={readAdvance2(id)}
                                    onChange={(e) => setAdvance2(id, e.target.value)}
                                    className="w-14 h-8 text-center text-sm"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Connector */}
                        <div className="flex flex-col items-center gap-0.5 text-muted-foreground">
                          <div className="w-px h-2 bg-border" />
                          <span className="text-xs font-medium">{playoffTotal} {label} pasan</span>
                          <div className="w-px h-2 bg-border" />
                        </div>

                        {/* Playoffs */}
                        <div className="rounded-md bg-muted/40 p-3">
                          <p className="text-sm font-medium">Playoffs — Eliminacion directa</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {playoffTotal} {label} se enfrentan en eliminacion directa
                            {byes > 0 ? `. ${byes} ${label} avanzan directo a la siguiente ronda (byes).` : " hasta definir al campeon."}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              </div>
              )}
            </div>
          )}

          {/* ===================== PASO 3 — Detalles ===================== */}
          {step === 3 && (
            <div className="space-y-8">
              {/* Location / Scope */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Ubicación</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Alcance del Torneo</Label>
                    <Select
                      value={scope}
                      onValueChange={(v) => {
                        setScope(v as TournamentScope);
                        setDepartment("");
                        setMunicipality("");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar alcance" />
                      </SelectTrigger>
                      <SelectContent>
                        {SCOPES.map((s) => (
                          <SelectItem key={s.key} value={s.key}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {(scope === "departamental" || scope === "municipal") && (
                    <div className="space-y-2">
                      <Label>Departamento</Label>
                      <Select
                        value={department}
                        onValueChange={(v) => {
                          setDepartment(v);
                          setMunicipality("");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar departamento" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEPARTMENTS.map((d) => (
                            <SelectItem key={d.key} value={d.key}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {scope === "municipal" && department && (
                    <div className="space-y-2">
                      <Label>Municipio / Ciudad</Label>
                      <Select
                        value={municipality}
                        onValueChange={setMunicipality}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar municipio" />
                        </SelectTrigger>
                        <SelectContent>
                          {(getDepartment(department)?.municipalities ?? []).map((m) => (
                            <SelectItem key={m.key} value={m.key}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Selection */}
              {sport && getAvailableStats(sport as Sport).length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">Estadísticas del Torneo</h3>
                    <span className="text-xs text-muted-foreground">
                      {enabledStats.length} seleccionadas
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Selecciona que eventos se pueden registrar en los partidos
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {getAvailableStats(sport as Sport)
                      .map((stat) => {
                        const isEnabled = enabledStats.includes(stat.key);
                        return (
                          <button
                            key={stat.key}
                            type="button"
                            onClick={() => {
                              // Juego limpio cambia cómo se puntúa el torneo
                              // entero, así que se confirma antes de prender.
                              // Apagarlo no pregunta nada.
                              if (stat.key === "fair_play" && !isEnabled) {
                                setConfirmFairPlay(true);
                                return;
                              }
                              setEnabledStats((prev) =>
                                isEnabled
                                  ? prev.filter((s) => s !== stat.key)
                                  : [...prev, stat.key]
                              );
                            }}
                            className={`text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                              isEnabled
                                ? "bg-primary/10 border-primary text-primary font-medium"
                                : "border-border hover:border-muted-foreground/50"
                            }`}
                          >
                            {stat.label}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===================== PASO 4 — Confirmar ===================== */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Resumen</h3>
              <div className="rounded-lg border divide-y text-sm">
                <SummaryRow label="Nombre" value={name} />
                <SummaryRow label="Deporte" value={sportLabel} />
                <SummaryRow label="Fecha de inicio" value={startDate} />
                <SummaryRow label="Formato" value={format ? FORMAT_LABELS[format] : ""} />
                <SummaryRow label={participantLabel} value={teamCount} />
                {sport === "volleyball" && (
                  <SummaryRow label="Sets" value={`Mejor de ${bestOf}`} />
                )}
                {groups.length > 0 && (
                  <SummaryRow label="Grupos" value={`${groups.length}`} />
                )}
                {format === "group-playoff" && !hasPhase2 && (
                  <SummaryRow label="Clasifican" value={`${advance1Total} ${participantLabel.toLowerCase()}`} />
                )}
                {format === "group-playoff" && hasPhase2 && (
                  <SummaryRow label="Estructura" value="Fase 1 → Fase 2 → Playoffs" />
                )}
                <SummaryRow label="Alcance" value={scopeLabel} />
                {department && <SummaryRow label="Departamento" value={deptLabel} />}
                {municipality && <SummaryRow label="Municipio" value={munLabel} />}
                {enabledStats.length > 0 && (
                  <SummaryRow label="Estadísticas" value={`${enabledStats.length} seleccionadas`} />
                )}
                {description.trim() && (
                  <SummaryRow label="Descripción" value={description.trim()} />
                )}
              </div>

              {/* Plan indicator */}
              <div className="text-center">
                {canUseFree ? (
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                    Gratis
                  </Badge>
                ) : (
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    Plan Pago
                  </Badge>
                )}
              </div>

              {/* Free tier limits hint */}
              {!freeTierCheck.isFree && (
                <div className="w-full text-xs text-muted-foreground bg-muted/50 rounded-md p-3 space-y-1">
                  <p className="font-medium">Este torneo requiere plan pago porque:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {freeTierCheck.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                  <p className="pt-1 text-muted-foreground/70">
                    Gratis: hasta {FREE_TIER_LIMITS.maxTeams} equipos, eliminacion directa, sin estadisticas
                  </p>
                </div>
              )}

              {/* Active free limit warning */}
              {freeTierCheck.isFree && !canUseFree && (
                <p className="w-full text-xs text-amber-600 bg-amber-500/10 rounded-md p-3">
                  Ya tienes {activeFreeCount} torneo gratis activo. Puedes crear mas torneos con el plan pago.
                </p>
              )}
            </div>
          )}

          {/* ===================== Navegacion (sticky) ===================== */}
          <div className="sticky bottom-0 z-30 -mx-6 flex gap-2 border-t bg-background/95 px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={goBack}
                disabled={creating}
              >
                Atras
              </Button>
            )}
            {step < WIZARD_STEPS.length ? (
              <Button type="button" className="flex-1" onClick={goNext}>
                Siguiente
              </Button>
            ) : (
              <Button
                type="button"
                className="flex-1"
                onClick={handleFinalSubmit}
                disabled={creating}
              >
                {creating ? "Creando..." : canUseFree ? "Crear Torneo Gratis" : "Crear Torneo"}
              </Button>
            )}
          </div>
        </CardContent>
      </form>
    </Card>

    <Dialog open={confirmFairPlay} onOpenChange={setConfirmFairPlay}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Juego Limpio suma puntos en la tabla</DialogTitle>
          <DialogDescription>
            No es una estadística más: cambia cómo se puntúa el torneo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>
            En cada partido, el que carga el resultado puede darle el juego
            limpio a uno de los dos equipos (o a ninguno). Ese equipo se lleva{" "}
            <span className="font-semibold">
              {FAIR_PLAY_POINTS} punto extra
            </span>{" "}
            encima de lo que haya hecho en la cancha:
          </p>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 text-xs">
                  <th className="text-left px-3 py-1.5 font-medium">
                    Resultado
                  </th>
                  <th className="text-center px-3 py-1.5 font-medium">
                    Normal
                  </th>
                  <th className="text-center px-3 py-1.5 font-medium">
                    Con juego limpio
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Gana", base: sport ? getWinPoints(sport as Sport) : 3 },
                  { label: "Empata", base: 1 },
                  { label: "Pierde", base: 0 },
                ].map((r) => (
                  <tr key={r.label} className="border-t">
                    <td className="px-3 py-1.5">{r.label}</td>
                    <td className="text-center px-3 py-1.5 text-muted-foreground">
                      {r.base}
                    </td>
                    <td className="text-center px-3 py-1.5 font-bold text-emerald-600">
                      {r.base + FAIR_PLAY_POINTS}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground text-xs">
            La tabla de posiciones va a mostrar una columna JL con los juegos
            limpios de cada equipo, para que se entienda de dónde salen los
            puntos. Activala solo si tu torneo premia el juego limpio.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setConfirmFairPlay(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              setEnabledStats((prev) =>
                prev.includes("fair_play") ? prev : [...prev, "fair_play"]
              );
              setConfirmFairPlay(false);
            }}
          >
            Entiendo, activar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {priceInfo && (
      <TournamentCostDialog
        open={showCostDialog}
        onOpenChange={setShowCostDialog}
        onConfirm={(couponId, paymentId, useCredit) =>
          createTournament("paid", couponId, paymentId, useCredit)
        }
        priceInfo={priceInfo}
        tournamentName={name}
        format={format as TournamentFormat}
        teamCount={parseInt(teamCount)}
        sport={sport as Sport}
        userId={user!.id}
        tournamentData={buildTournamentData()}
      />
    )}
    </>
  );
}
