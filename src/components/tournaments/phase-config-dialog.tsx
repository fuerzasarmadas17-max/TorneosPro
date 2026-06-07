"use client";

import { useMemo, useState } from "react";
import { Tournament } from "@/types";
import { ClassifiedTeam, getClassifiedTeamsRanked } from "@/data/helpers";
import { useTournaments } from "@/context/tournament-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ArrowRightLeft, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Destination {
  /** Stable id for the destination — either a tournament_groups.id or a
   *  bracket-slot id of the form "<matchId>:home" / "<matchId>:away". */
  id: string;
  label: string;
  /** Group destinations only: how many teams already assigned here (used to
   *  show e.g. "Grupo A — 2 equipos" as the user fills it in). */
  count?: number;
}

interface PhaseConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament;
  /** Phase that just finished, whose classified teams are being assigned. */
  fromPhase: number;
  /** "groups" → assigning to next-phase tournament_groups.
   *  "bracket" → assigning to round-1 bracket slots. */
  mode: "groups" | "bracket";
}

/**
 * Resolve a name lookup so the dialog can show "Equipo Atlético" instead of a
 * raw teamId. Falls back to the teamId itself when no team is found.
 */
function useTeamNameLookup(tournament: Tournament) {
  const { teams } = useTournaments();
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teams) map.set(t.id, t.name);
    // tournament.teamIds covers participating teams; the names come from the
    // global teams list.
    for (const id of tournament.teamIds) {
      if (!map.has(id)) map.set(id, id);
    }
    return (id: string) => map.get(id) ?? id;
  }, [teams, tournament.teamIds]);
}

export function PhaseConfigDialog({
  open,
  onOpenChange,
  tournament,
  fromPhase,
  mode,
}: PhaseConfigDialogProps) {
  const { configurePhaseGroups, configureBracketSlots } = useTournaments();
  const nameOf = useTeamNameLookup(tournament);

  // fromPhase === 0 means "edit the initial phase 1 assignment" — there's no
  // previous phase to classify from, so the team list is simply the
  // tournament's participants. Their current group (if any) is used as the
  // meta label so the organizer sees where each one sits today.
  const classified = useMemo<ClassifiedTeam[]>(() => {
    if (fromPhase === 0) {
      const teamGroupName = new Map<string, string>();
      for (const g of tournament.groups ?? []) {
        if ((g.phase ?? 1) !== 1) continue;
        for (const teamId of g.teamIds) teamGroupName.set(teamId, g.name);
      }
      return tournament.teamIds.map((teamId) => ({
        teamId,
        fromGroupId: "",
        fromGroupName: teamGroupName.get(teamId) ?? "Sin asignar",
        // position=0 signals "initial assignment" so the UI hides the "1° de…"
        // prefix and just shows the group name as a meta.
        position: 0,
      }));
    }
    return getClassifiedTeamsRanked(tournament, fromPhase);
  }, [tournament, fromPhase]);

  // Destinations depend on mode.
  // - "groups": every tournament_groups row in (fromPhase + 1).
  // - "bracket": every round-1 playoff match exposes two slots (home / away).
  const destinations = useMemo<Destination[]>(() => {
    if (mode === "groups") {
      return (tournament.groups ?? [])
        .filter((g) => g.phase === fromPhase + 1)
        .map((g) => ({ id: g.id, label: g.name }));
    }
    // mode === "bracket"
    const bracketMatches = tournament.matches
      .filter((m) => m.phase === "playoff" && m.round === 1)
      .sort((a, b) => a.matchNumber - b.matchNumber);
    const dests: Destination[] = [];
    for (const m of bracketMatches) {
      dests.push({ id: `${m.id}:home`, label: `Partido ${m.matchNumber} — Local` });
      dests.push({ id: `${m.id}:away`, label: `Partido ${m.matchNumber} — Visitante` });
    }
    return dests;
  }, [tournament, fromPhase, mode]);

  // Default assignments. If destinations already hold teams (re-edit case),
  // pre-fill with the current assignment so the organizer just tweaks. When
  // empty (first time), use the auto layout — round-robin for groups,
  // sequential seeds for the bracket.
  const [assignments, setAssignments] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    if (destinations.length === 0) return out;

    if (mode === "groups") {
      // Re-edit: walk existing tournament_group_teams for the destination groups
      // and put each classified team where it currently sits.
      const destIds = new Set(destinations.map((d) => d.id));
      const preexisting: Record<string, string> = {};
      for (const g of tournament.groups ?? []) {
        if (!destIds.has(g.id)) continue;
        for (const teamId of g.teamIds) preexisting[teamId] = g.id;
      }
      const hasPreexisting = Object.keys(preexisting).length > 0;
      classified.forEach((c, i) => {
        out[c.teamId] = hasPreexisting
          ? preexisting[c.teamId] ?? destinations[i % destinations.length].id
          : destinations[i % destinations.length].id;
      });
    } else {
      // Bracket: walk round-1 matches and infer which slot each classified
      // team currently occupies.
      const preexisting: Record<string, string> = {};
      for (const m of tournament.matches.filter(
        (x) => x.phase === "playoff" && x.round === 1
      )) {
        if (m.homeTeamId) preexisting[m.homeTeamId] = `${m.id}:home`;
        if (m.awayTeamId) preexisting[m.awayTeamId] = `${m.id}:away`;
      }
      const hasPreexisting = Object.keys(preexisting).length > 0;
      classified.forEach((c, i) => {
        if (hasPreexisting) {
          out[c.teamId] = preexisting[c.teamId] ?? destinations[i]?.id ?? "";
        } else if (i < destinations.length) {
          out[c.teamId] = destinations[i].id;
        }
      });
    }
    return out;
  });

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const destId of Object.values(assignments)) {
      map[destId] = (map[destId] ?? 0) + 1;
    }
    return map;
  }, [assignments]);

  // Groups-mode helpers: inverse view of `assignments` so each group exposes
  // its team list in classification order. Teams without a destination yet
  // land on `unassignedTeamIds` and surface in a dedicated section above the
  // groups so the organizer can't miss them.
  const teamsByGroup = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const d of destinations) map[d.id] = [];
    for (const c of classified) {
      const destId = assignments[c.teamId];
      if (destId && destId in map) map[destId].push(c.teamId);
    }
    return map;
  }, [classified, assignments, destinations]);

  const unassignedTeamIds = useMemo(
    () => classified.filter((c) => !assignments[c.teamId]).map((c) => c.teamId),
    [classified, assignments]
  );

  // Per-group collapsed/expanded state. Default: all collapsed so the
  // organizer sees a compact overview of every group and only opens the
  // ones they want to inspect or edit.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(destinations.map((d) => d.id))
  );
  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleSave = async () => {
    // Every classified team must have a destination chosen.
    const missing = classified.filter((c) => !assignments[c.teamId]);
    if (missing.length > 0) {
      toast.error(`Falta asignar ${missing.length} equipo(s)`);
      return;
    }
    // Bracket mode: no two teams can share the same slot.
    if (mode === "bracket") {
      const used = new Set<string>();
      for (const destId of Object.values(assignments)) {
        if (used.has(destId)) {
          toast.error("Dos equipos no pueden ocupar el mismo lugar del bracket");
          return;
        }
        used.add(destId);
      }
    }

    if (mode === "groups") {
      // Invert assignments to { groupId: teamIds[] } and keep ranking order.
      const byGroup: Record<string, string[]> = {};
      for (const c of classified) {
        const destId = assignments[c.teamId];
        (byGroup[destId] ??= []).push(c.teamId);
      }
      const ok = await configurePhaseGroups(tournament.id, fromPhase + 1, byGroup);
      if (!ok) {
        toast.error("No pudimos guardar la configuración");
        return;
      }
      toast.success(`Fase ${fromPhase + 1} configurada`);
    } else {
      // Bracket mode: each slot id is "<matchId>:home" | "<matchId>:away".
      // Build slotAssignments keyed by matchId with both sides resolved.
      const bySlot: Record<string, { homeTeamId: string | null; awayTeamId: string | null }> = {};
      for (const [teamId, destId] of Object.entries(assignments)) {
        const [matchId, side] = destId.split(":");
        bySlot[matchId] ??= { homeTeamId: null, awayTeamId: null };
        if (side === "home") bySlot[matchId].homeTeamId = teamId;
        else bySlot[matchId].awayTeamId = teamId;
      }
      const ok = await configureBracketSlots(tournament.id, bySlot);
      if (!ok) {
        toast.error("No pudimos guardar la configuración");
        return;
      }
      toast.success("Bracket configurado");
    }
    onOpenChange(false);
  };

  // Build destination options with current count appended in groups mode for
  // visual feedback ("Grupo A — 2 equipos").
  const destinationOptions = useMemo(
    () =>
      destinations.map((d) => ({
        ...d,
        count: mode === "groups" ? counts[d.id] ?? 0 : undefined,
      })),
    [destinations, counts, mode]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Layout: fixed header + scrollable middle + sticky footer. The
          DialogContent default is `display: grid`, we explicitly flip it to
          flex-col so the middle can claim flex-1 and shrink (min-h-0) when
          the team list overflows. */}
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden !flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>
            {mode === "groups"
              ? `Configurar Fase ${fromPhase + 1}`
              : "Configurar Playoffs"}
          </DialogTitle>
          <DialogDescription>
            {mode === "groups"
              ? fromPhase === 0
                ? "Asigná cada equipo al grupo donde va a jugar la fase 1."
                : "Asigná cada clasificado al grupo de la siguiente fase. Por defecto se distribuyen en orden de clasificación; podés ajustar cualquier equipo."
              : "Asigná cada clasificado a un lugar del bracket. Por defecto se asignan en orden; podés intercambiar."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-2">
          {classified.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {fromPhase === 0
                ? "Este torneo no tiene equipos cargados todavía."
                : `Todavía no hay clasificados. Cerrá los partidos pendientes de la fase ${fromPhase}.`}
            </p>
          ) : mode === "groups" ? (
            // GROUPS MODE: collapsible per-group cards with team rows + "Mover"
            // dropdown that lists the other groups. Unassigned teams (if any)
            // get a separate banner above so they're easy to spot.
            <div className="space-y-3 py-2">
              {unassignedTeamIds.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
                    <AlertCircle className="h-4 w-4" />
                    Sin asignar ({unassignedTeamIds.length})
                  </div>
                  <div className="space-y-1.5">
                    {unassignedTeamIds.map((teamId) => (
                      <div
                        key={teamId}
                        className="flex items-center justify-between gap-2 rounded bg-background/60 px-2.5 py-1.5"
                      >
                        <span className="text-sm truncate">{nameOf(teamId)}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                              <ArrowRightLeft className="h-3 w-3 mr-1" />
                              Asignar
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel className="text-xs">
                              Elegí un grupo
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {destinations.map((d) => (
                              <DropdownMenuItem
                                key={d.id}
                                onClick={() =>
                                  setAssignments((prev) => ({
                                    ...prev,
                                    [teamId]: d.id,
                                  }))
                                }
                              >
                                {d.label}
                                <span className="ml-auto text-xs text-muted-foreground">
                                  {teamsByGroup[d.id]?.length ?? 0}
                                </span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {destinations.map((group) => {
                const teamsInGroup = teamsByGroup[group.id] ?? [];
                const collapsed = collapsedGroups.has(group.id);
                const otherGroups = destinations.filter((d) => d.id !== group.id);
                return (
                  <div key={group.id} className="rounded-md border bg-card">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors rounded-t-md"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 transition-transform ${
                            collapsed ? "-rotate-90" : ""
                          }`}
                        />
                        <span className="font-medium text-sm truncate">
                          {group.label}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {teamsInGroup.length}{" "}
                        {teamsInGroup.length === 1 ? "equipo" : "equipos"}
                      </span>
                    </button>

                    {!collapsed && (
                      <div className="border-t px-3 py-2 space-y-1.5">
                        {teamsInGroup.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic py-1.5 text-center">
                            Sin equipos asignados
                          </p>
                        ) : (
                          teamsInGroup.map((teamId) => {
                            const c = classified.find((x) => x.teamId === teamId);
                            return (
                              <div
                                key={teamId}
                                className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2.5 py-1.5"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm truncate">
                                    {nameOf(teamId)}
                                  </div>
                                  {c && c.position > 0 && (
                                    <div className="text-[10px] text-muted-foreground">
                                      {c.position}° de {c.fromGroupName}
                                    </div>
                                  )}
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-xs shrink-0"
                                      disabled={otherGroups.length === 0}
                                    >
                                      <ArrowRightLeft className="h-3 w-3 mr-1" />
                                      Mover
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel className="text-xs">
                                      Mover a…
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {otherGroups.map((d) => (
                                      <DropdownMenuItem
                                        key={d.id}
                                        onClick={() =>
                                          setAssignments((prev) => ({
                                            ...prev,
                                            [teamId]: d.id,
                                          }))
                                        }
                                      >
                                        {d.label}
                                        <span className="ml-auto text-xs text-muted-foreground">
                                          {teamsByGroup[d.id]?.length ?? 0}
                                        </span>
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            // BRACKET MODE: kept as-is — each team picks a 1:1 slot from a
            // Select. The collapsible-by-group layout doesn't apply because
            // bracket slots hold a single team each.
            <div className="space-y-2 py-2">
              {classified.map((c) => (
                <div
                  key={c.teamId}
                  className="flex items-center justify-between gap-3 rounded-md border p-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{nameOf(c.teamId)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {c.position > 0
                        ? `${c.position}° de ${c.fromGroupName}`
                        : c.fromGroupName}
                    </div>
                  </div>
                  <Select
                    value={assignments[c.teamId] ?? ""}
                    onValueChange={(v) =>
                      setAssignments((prev) => ({ ...prev, [c.teamId]: v }))
                    }
                  >
                    <SelectTrigger className="w-[170px] h-9 text-sm">
                      <SelectValue placeholder="Elegí destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {destinationOptions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.label}
                          {d.count !== undefined && d.count > 0
                            ? ` (${d.count})`
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 px-6 py-4 border-t shrink-0 bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={classified.length === 0}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
