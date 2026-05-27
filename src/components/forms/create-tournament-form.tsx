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
import { Sport, TournamentFormat, TournamentScope, Team, Tournament, TournamentGroup, PlayoffConfig, PhaseConfig, MatchEventType, STAT_CATALOG, getDefaultStats } from "@/types";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { getTournamentPriceInfo, TournamentPriceInfo, checkFreeTier, FREE_TIER_LIMITS } from "@/lib/pricing";
import { TournamentCostDialog, FORMAT_LABELS } from "./tournament-cost-dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";

const INDIVIDUAL_SPORTS: Sport[] = ["tenis", "padel", "ping-pong"];

interface GroupEntry {
  name: string;
}

const GROUP_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

const WIZARD_STEPS = [
  { label: "Esencial" },
  { label: "Formato" },
  { label: "Detalles" },
  { label: "Confirmar" },
];

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
  const { addTournament, addTeams, tournaments } = useTournaments();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [sport, setSport] = useState<Sport | "">("");
  const [format, setFormat] = useState<TournamentFormat | "">("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [teamCount, setTeamCount] = useState<string>("");
  const [groups, setGroups] = useState<GroupEntry[]>([]);
  const [advanceCount, setAdvanceCount] = useState<string>("2");
  const [enabledStats, setEnabledStats] = useState<MatchEventType[]>([]);
  const [bestOf, setBestOf] = useState<3 | 5>(3);
  const [hasPhase2, setHasPhase2] = useState(false);
  const [phase1AdvancePerGroup, setPhase1AdvancePerGroup] = useState("2");
  const [phase2GroupCount, setPhase2GroupCount] = useState("2");
  const [phase2AdvancePerGroup, setPhase2AdvancePerGroup] = useState("2");
  const [scope, setScope] = useState<TournamentScope | "">("");
  const [department, setDepartment] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [error, setError] = useState("");
  const [showCostDialog, setShowCostDialog] = useState(false);
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

  const addGroup = () => {
    const letter = GROUP_LETTERS[groups.length] || `${groups.length + 1}`;
    setGroups([...groups, { name: `Grupo ${letter}` }]);
  };

  const removeGroup = (index: number) => {
    setGroups(groups.filter((_, i) => i !== index));
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
        if (format === "group-playoff") {
          const advance = parseInt(advanceCount);
          if (isNaN(advance) || advance < 2) return "Deben clasificar al menos 2";
          if (advance >= count) return "Los que clasifican deben ser menos que el total";
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
    const err = getStepError(step);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length));
  };

  const goBack = () => {
    setError("");
    setStep((s) => Math.max(s - 1, 1));
  };

  // Build tournament data for the payment record (used by webhook recovery)
  const buildTournamentData = (): Record<string, unknown> => {
    const count = parseInt(teamCount);
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
      advanceCount: format === "group-playoff" ? parseInt(advanceCount) : null,
      hasPhase2,
      phase1AdvancePerGroup: hasPhase2 ? parseInt(phase1AdvancePerGroup) : null,
      phase2GroupCount: hasPhase2 ? parseInt(phase2GroupCount) : null,
      phase2AdvancePerGroup: hasPhase2 ? parseInt(phase2AdvancePerGroup) : null,
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

  const createTournament = async (plan: "free" | "paid", couponId?: string, paymentId?: string) => {
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
          toast.error("Este codigo promocional ya fue utilizado");
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

      // Build groups: auto-distribute teams evenly
      if (hasGroups) {
        tournamentGroups = groups.map((g, gIdx) => ({
          id: `temp-group-${gIdx}`,
          name: g.name,
          teamIds: [],
          phase: 1,
        }));
        for (let i = 0; i < dbTeamIds.length; i++) {
          tournamentGroups[i % groups.length].teamIds.push(dbTeamIds[i]);
        }
      }

      if (format === "group-playoff") {
        if (hasPhase2) {
          // Multi-phase: Phase 1 groups + Phase 2 empty groups + playoff bracket
          const p2GroupCount = parseInt(phase2GroupCount);
          const p2Advance = parseInt(phase2AdvancePerGroup);

          // Create Phase 2 empty groups (continue letter naming)
          const phase2Groups: TournamentGroup[] = Array.from({ length: p2GroupCount }, (_, i) => ({
            id: `temp-phase2-group-${i}`,
            name: `Grupo ${GROUP_LETTERS[groups.length + i] || `${groups.length + i + 1}`}`,
            teamIds: [],
            phase: 2,
          }));
          tournamentGroups = [...(tournamentGroups || []), ...phase2Groups];

          phaseConfigs = [
            { phase: 1, advancePerGroup: parseInt(phase1AdvancePerGroup), nextGroupCount: p2GroupCount },
            { phase: 2, advancePerGroup: p2Advance },
          ];

          playoffConfig = {
            advancePerGroup: p2Advance,
            totalAdvancing: p2Advance * p2GroupCount,
          };
        } else {
          playoffConfig = {
            advancePerGroup: parseInt(advanceCount),
            totalAdvancing: parseInt(advanceCount),
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
              <h3 className="font-semibold text-lg">Informacion General</h3>
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
                <Label htmlFor="description">Descripcion (opcional)</Label>
                <Input
                  id="description"
                  placeholder="Descripcion del torneo"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ===================== PASO 2 — Formato ===================== */}
          {step === 2 && (
            <div className="space-y-8">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Formato</h3>
                <div className="space-y-2">
                  <Label>Formato del torneo</Label>
                  <Select
                    value={format}
                    onValueChange={(v) => {
                      const f = v as TournamentFormat;
                      setFormat(f);
                      // Clear group config when switching to a format without
                      // groups, so phantom groups don't contaminate pricing/validation.
                      if (f === "elimination") {
                        setGroups([]);
                        setHasPhase2(false);
                        setAdvanceCount("2");
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar formato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="elimination">
                        Eliminacion Directa
                      </SelectItem>
                      <SelectItem value="round-robin">
                        Liga
                      </SelectItem>
                      <SelectItem value="group-playoff">
                        Fase de Grupos + Playoffs
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Participants */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Participantes</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="teamCount">
                      Cantidad de {participantLabel.toLowerCase()}
                    </Label>
                    <Input
                      id="teamCount"
                      type="number"
                      min="2"
                      placeholder={format === "elimination" ? "2, 4, 8 o 16" : "Minimo 2"}
                      value={teamCount}
                      onChange={(e) => setTeamCount(e.target.value)}
                    />
                    {format === "elimination" && (
                      <p className="text-xs text-muted-foreground">
                        Debe ser potencia de 2 (2, 4, 8, 16)
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Volleyball Sets Config */}
              {sport === "volleyball" && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Formato de Sets</h3>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={bestOf === 3 ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setBestOf(3)}
                    >
                      Mejor de 3
                    </Button>
                    <Button
                      type="button"
                      variant={bestOf === 5 ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setBestOf(5)}
                    >
                      Mejor de 5
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {bestOf === 3
                      ? "Gana el primero en llegar a 2 sets"
                      : "Gana el primero en llegar a 3 sets"}
                  </p>
                </div>
              )}

              {/* Group Configuration */}
              {(format === "group-playoff" || format === "round-robin") && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">Configuracion de Grupos</h3>
                    <span className="text-xs text-muted-foreground">
                      {format === "group-playoff" ? "Minimo 1 grupo" : "Opcional"}
                    </span>
                  </div>

                  {groups.map((group, gIdx) => (
                    <div
                      key={gIdx}
                      className="border rounded-lg p-3 flex items-center justify-between"
                    >
                      <span className="font-medium text-sm">{group.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeGroup(gIdx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}

                  {groups.length < 8 && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={addGroup}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Grupo
                    </Button>
                  )}

                  {teamCount && groups.length >= 1 && (
                    <p className="text-xs text-muted-foreground">
                      Los {participantLabel.toLowerCase()} se distribuiran automaticamente entre los grupos
                    </p>
                  )}

                  {groups.length >= 1 && format === "group-playoff" && !hasPhase2 && (
                    <div className="space-y-2">
                      <Label>Equipos que clasifican a playoffs</Label>
                      <Input
                        type="number"
                        min={2}
                        max={(parseInt(teamCount) || 2) - 1}
                        value={advanceCount}
                        onChange={(e) => setAdvanceCount(e.target.value)}
                      />
                      {advanceCount && !isNaN(parseInt(advanceCount)) && (
                        <p className="text-xs text-muted-foreground">
                          {parseInt(advanceCount)} {participantLabel.toLowerCase()} pasan a playoffs
                          {(() => {
                            const num = parseInt(advanceCount);
                            let p = 1;
                            while (p < num) p *= 2;
                            return p !== num
                              ? ` (${p - num} bye${p - num > 1 ? "s" : ""} para los mejor clasificados)`
                              : "";
                          })()}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Multi-phase: visual flow diagram */}
                  {groups.length >= 1 && format === "group-playoff" && hasPhase2 && (() => {
                    const label = participantLabel.toLowerCase();
                    const p1Advance = parseInt(phase1AdvancePerGroup) || 0;
                    const p1Total = p1Advance * groups.length;
                    const p2Groups = parseInt(phase2GroupCount) || 1;
                    const p2PerGroup = Math.floor(p1Total / p2Groups);
                    const p2Advance = parseInt(phase2AdvancePerGroup) || 0;
                    const playoffTotal = p2Advance * p2Groups;
                    let bracket = 1;
                    while (bracket < playoffTotal) bracket *= 2;
                    const byes = bracket - playoffTotal;

                    // Group name lists
                    const p1Names = groups.map((_, i) => GROUP_LETTERS[i] || `${i + 1}`).join(", ");
                    const p2Names = Array.from({ length: p2Groups }, (_, i) => GROUP_LETTERS[groups.length + i] || `${groups.length + i + 1}`).join(", ");

                    return (
                      <div className="space-y-3 border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold">Estructura del torneo</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive h-7 text-xs"
                            onClick={() => setHasPhase2(false)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Quitar
                          </Button>
                        </div>

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
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-sm">Los mejores</span>
                            <Input
                              type="number"
                              min={1}
                              max={Math.floor((parseInt(teamCount) || 2) / Math.max(groups.length, 1))}
                              value={phase1AdvancePerGroup}
                              onChange={(e) => setPhase1AdvancePerGroup(e.target.value)}
                              className="w-14 h-8 text-center text-sm"
                            />
                            <span className="text-sm">
                              {groups.length === 1 ? "avanzan" : "de cada grupo avanzan"}
                            </span>
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
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-sm">Los mejores</span>
                            <Input
                              type="number"
                              min={1}
                              max={p2PerGroup || 1}
                              value={phase2AdvancePerGroup}
                              onChange={(e) => setPhase2AdvancePerGroup(e.target.value)}
                              className="w-14 h-8 text-center text-sm"
                            />
                            <span className="text-sm">
                              {p2Groups === 1 ? "avanzan" : "de cada grupo avanzan"}
                            </span>
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

                  {/* Add Phase 2 button */}
                  {groups.length >= 1 && format === "group-playoff" && !hasPhase2 && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setHasPhase2(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar otra Fase de Grupos
                    </Button>
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
                <h3 className="font-semibold text-lg">Ubicacion</h3>
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
              {sport && STAT_CATALOG.some((s) => s.sportDefaults.includes(sport as Sport)) && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">Estadisticas del Torneo</h3>
                    <span className="text-xs text-muted-foreground">
                      {enabledStats.length} seleccionadas
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Selecciona que eventos se pueden registrar en los partidos
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {STAT_CATALOG
                      .filter((stat) => stat.sportDefaults.includes(sport as Sport))
                      .map((stat) => {
                        const isEnabled = enabledStats.includes(stat.key);
                        return (
                          <button
                            key={stat.key}
                            type="button"
                            onClick={() =>
                              setEnabledStats((prev) =>
                                isEnabled
                                  ? prev.filter((s) => s !== stat.key)
                                  : [...prev, stat.key]
                              )
                            }
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
                  <SummaryRow label="Clasifican" value={`${advanceCount} ${participantLabel.toLowerCase()}`} />
                )}
                {format === "group-playoff" && hasPhase2 && (
                  <SummaryRow label="Estructura" value="Fase 1 → Fase 2 → Playoffs" />
                )}
                <SummaryRow label="Alcance" value={scopeLabel} />
                {department && <SummaryRow label="Departamento" value={deptLabel} />}
                {municipality && <SummaryRow label="Municipio" value={munLabel} />}
                {enabledStats.length > 0 && (
                  <SummaryRow label="Estadisticas" value={`${enabledStats.length} seleccionadas`} />
                )}
                {description.trim() && (
                  <SummaryRow label="Descripcion" value={description.trim()} />
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

    {priceInfo && (
      <TournamentCostDialog
        open={showCostDialog}
        onOpenChange={setShowCostDialog}
        onConfirm={(couponId, paymentId) => createTournament("paid", couponId, paymentId)}
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
