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
  CardFooter,
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
import { useAuth } from "@/context/auth-context";
import { useTournaments } from "@/context/tournament-context";
import { SPORTS } from "@/data/sports";
import { Sport, TournamentFormat, Team, Tournament, TournamentGroup, PlayoffConfig, PhaseConfig, MatchEventType, STAT_CATALOG, getDefaultStats } from "@/types";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { getTournamentPriceInfo, TournamentPriceInfo, distributeTeamsToGroups, checkFreeTier, FREE_TIER_LIMITS } from "@/lib/pricing";
import { TournamentCostDialog } from "./tournament-cost-dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";

const INDIVIDUAL_SPORTS: Sport[] = ["tenis", "padel", "ping-pong"];

interface GroupEntry {
  name: string;
}

const GROUP_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function CreateTournamentForm() {
  const { user } = useAuth();
  const { addTournament, addTeams, tournaments } = useTournaments();
  const router = useRouter();

  const [name, setName] = useState("");
  const [sport, setSport] = useState<Sport | "">("");
  const [format, setFormat] = useState<TournamentFormat | "">("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [teamCount, setTeamCount] = useState<string>("");
  const [groups, setGroups] = useState<GroupEntry[]>([]);
  const [advanceCount, setAdvanceCount] = useState<string>("2");
  const [enabledStats, setEnabledStats] = useState<MatchEventType[]>([]);
  const [maxPlayers, setMaxPlayers] = useState<string>("");
  const [bestOf, setBestOf] = useState<3 | 5>(3);
  const [hasPhase2, setHasPhase2] = useState(false);
  const [phase1AdvancePerGroup, setPhase1AdvancePerGroup] = useState("2");
  const [phase2GroupCount, setPhase2GroupCount] = useState("2");
  const [phase2AdvancePerGroup, setPhase2AdvancePerGroup] = useState("2");
  const [error, setError] = useState("");
  const [showCostDialog, setShowCostDialog] = useState(false);
  const [priceInfo, setPriceInfo] = useState<TournamentPriceInfo | null>(null);

  const isIndividual = sport ? INDIVIDUAL_SPORTS.includes(sport as Sport) : false;
  const participantLabel = isIndividual ? "Jugadores" : "Equipos";
  const participantSingular = isIndividual ? "jugador" : "equipo";

  const teamCountNum = parseInt(teamCount);
  const advanceNum = parseInt(advanceCount);
  const needsGroups = format === "group-playoff";
  const hasGroups = groups.length > 0;
  const needsAdvance = format === "group-playoff" && hasGroups;

  const maxPlayersNum = maxPlayers ? parseInt(maxPlayers) : NaN;

  const validations = {
    name: name.trim() !== "",
    sport: sport !== "",
    format: format !== "",
    startDate: startDate !== "",
    teamCount: !isNaN(teamCountNum) && teamCountNum >= 2,
    maxPlayers: isIndividual || !maxPlayers || (!isNaN(maxPlayersNum) && maxPlayersNum >= 1),
    groups: !needsGroups || hasGroups,
    advance: !needsAdvance || (!isNaN(advanceNum) && advanceNum >= 2),
  };

  const isFormValid = Object.values(validations).every(Boolean);

  // Free tier detection
  const freeTierCheck = checkFreeTier({
    format: (format || "elimination") as TournamentFormat,
    teamCount: teamCountNum || 0,
    maxPlayersPerTeam: isIndividual ? 1 : (maxPlayersNum || 0),
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
      maxPlayersPerTeam: isIndividual ? 1 : (parseInt(maxPlayers) || null),
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
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("El nombre del torneo es obligatorio");
      return;
    }
    if (!sport) {
      setError("Selecciona un deporte");
      return;
    }
    if (!format) {
      setError("Selecciona un formato");
      return;
    }
    if (!startDate) {
      setError("Selecciona una fecha de inicio");
      return;
    }

    const count = parseInt(teamCount);
    if (isNaN(count) || count < 2) {
      setError(`Necesitas al menos 2 ${participantLabel.toLowerCase()}`);
      return;
    }

    if (format === "elimination") {
      const isPowerOf2 = count > 0 && (count & (count - 1)) === 0;
      if (!isPowerOf2) {
        setError(`Para eliminacion directa necesitas 2, 4, 8 o 16 ${participantLabel.toLowerCase()}`);
        return;
      }
    }

    if (format === "round-robin" && count < 3) {
      setError(`Para liga necesitas al menos 3 ${participantLabel.toLowerCase()}`);
      return;
    }

    // Validate groups
    const hasGroups = (format === "round-robin" || format === "group-playoff") && groups.length > 0;
    if (format === "group-playoff" && groups.length < 1) {
      setError("Necesitas al menos 1 grupo");
      return;
    }
    if (hasGroups) {
      const perGroup = Math.floor(count / groups.length);
      if (perGroup < 2) {
        setError(`No hay suficientes ${participantLabel.toLowerCase()} para ${groups.length} grupos (minimo 2 por grupo)`);
        return;
      }
      if (format === "group-playoff") {
        const advance = parseInt(advanceCount);
        if (isNaN(advance) || advance < 2) {
          setError("Deben clasificar al menos 2");
          return;
        }
        if (advance >= count) {
          setError("Los que clasifican deben ser menos que el total");
          return;
        }
      }
    }

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

  const [creating, setCreating] = useState(false);

  const createTournament = async (plan: "free" | "paid", couponId?: string, paymentId?: string) => {
    setCreating(true);
    try {
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
        maxPlayersPerTeam: maxPlayers ? parseInt(maxPlayers) : undefined,
        bestOf: sport === "volleyball" ? bestOf : undefined,
        price: plan === "paid" && priceInfo ? priceInfo.price : undefined,
        tier: plan === "paid" && priceInfo ? priceInfo.tier : undefined,
        couponId: couponId ?? undefined,
        phaseConfigs,
      };

      const newTournament = await addTournament(tournament);

      // Mark coupon as used
      if (couponId && newTournament?.id) {
        await supabase
          .from("coupons")
          .update({
            used_by: user!.id,
            used_at: new Date().toISOString(),
            tournament_id: newTournament.id,
          })
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

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Crear Torneo</CardTitle>
        <CardDescription>
          Configura tu nuevo torneo
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-8">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Basic Info */}
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
              <Label htmlFor="description">Descripcion (opcional)</Label>
              <Input
                id="description"
                placeholder="Descripcion del torneo"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Sport & Format */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Deporte y Formato</h3>
            <div className="grid gap-4 sm:grid-cols-2">
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
                <Label>Formato</Label>
                <Select
                  value={format}
                  onValueChange={(v) => setFormat(v as TournamentFormat)}
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
              {!isIndividual && (
                <div className="space-y-2">
                  <Label htmlFor="maxPlayers">Max. jugadores por {participantSingular} (opcional)</Label>
                  <Input
                    id="maxPlayers"
                    type="number"
                    min="1"
                    placeholder="Ej: 15"
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(e.target.value)}
                  />
                </div>
              )}
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

              {/* Multi-phase: Phase 2 configuration */}
              {groups.length >= 1 && format === "group-playoff" && hasPhase2 && (
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-semibold text-sm">Fase 1 → Fase 2</h4>
                  <div className="space-y-2">
                    <Label>Clasifican por grupo (Fase 1)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={Math.floor((parseInt(teamCount) || 2) / Math.max(groups.length, 1))}
                      value={phase1AdvancePerGroup}
                      onChange={(e) => setPhase1AdvancePerGroup(e.target.value)}
                    />
                    {groups.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {parseInt(phase1AdvancePerGroup) * groups.length} {participantLabel.toLowerCase()} pasan a Fase 2
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Grupos en Fase 2</Label>
                    <Input
                      type="number"
                      min={1}
                      max={4}
                      value={phase2GroupCount}
                      onChange={(e) => setPhase2GroupCount(e.target.value)}
                    />
                  </div>
                  <h4 className="font-semibold text-sm">Fase 2 → Playoffs</h4>
                  <div className="space-y-2">
                    <Label>Clasifican por grupo (Fase 2)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={Math.floor((parseInt(phase1AdvancePerGroup) * groups.length) / Math.max(parseInt(phase2GroupCount), 1))}
                      value={phase2AdvancePerGroup}
                      onChange={(e) => setPhase2AdvancePerGroup(e.target.value)}
                    />
                    {(() => {
                      const total = parseInt(phase2AdvancePerGroup) * parseInt(phase2GroupCount);
                      if (!isNaN(total) && total > 0) {
                        let p = 1;
                        while (p < total) p *= 2;
                        return (
                          <p className="text-xs text-muted-foreground">
                            {total} {participantLabel.toLowerCase()} pasan a playoffs
                            {p !== total ? ` (${p - total} bye${p - total > 1 ? "s" : ""})` : ""}
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setHasPhase2(false)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Quitar Fase 2
                  </Button>
                </div>
              )}

              {/* Add Phase 2 button */}
              {groups.length >= 2 && format === "group-playoff" && !hasPhase2 && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setHasPhase2(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Fase de Grupos
                </Button>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="pt-6 flex-col gap-3">
          {/* Plan indicator */}
          {isFormValid && (
            <div className="w-full text-center">
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
          )}

          {/* Free tier limits hint */}
          {isFormValid && !freeTierCheck.isFree && (
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
          {isFormValid && freeTierCheck.isFree && !canUseFree && (
            <p className="w-full text-xs text-amber-600 bg-amber-500/10 rounded-md p-3">
              Ya tienes {activeFreeCount} torneo gratis activo. Puedes crear mas torneos con el plan pago.
            </p>
          )}

          <Button type="submit" className="w-full" disabled={!isFormValid || creating}>
            {creating ? "Creando..." : canUseFree ? "Crear Torneo Gratis" : "Crear Torneo"}
          </Button>
          {!isFormValid && (
            <p className="text-xs text-muted-foreground">
              Completa todos los campos para crear el torneo
            </p>
          )}
        </CardFooter>
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
