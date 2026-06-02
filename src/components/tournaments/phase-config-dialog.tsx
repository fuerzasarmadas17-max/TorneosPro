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
import { ScrollArea } from "@/components/ui/scroll-area";
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

  const classified = useMemo<ClassifiedTeam[]>(
    () => getClassifiedTeamsRanked(tournament, fromPhase),
    [tournament, fromPhase]
  );

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

  // Default assignments. Groups: round-robin (1°A→Grp A, 1°B→Grp B, 2°A→Grp B,
  // 2°B→Grp A …). Bracket: sequential into slots in order. The organizer can
  // change everything before saving.
  const [assignments, setAssignments] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    if (destinations.length === 0) return out;
    if (mode === "groups") {
      classified.forEach((c, i) => {
        out[c.teamId] = destinations[i % destinations.length].id;
      });
    } else {
      classified.forEach((c, i) => {
        if (i < destinations.length) out[c.teamId] = destinations[i].id;
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
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {mode === "groups"
              ? `Configurar Fase ${fromPhase + 1}`
              : "Configurar Playoffs"}
          </DialogTitle>
          <DialogDescription>
            {mode === "groups"
              ? "Asigná cada clasificado al grupo de la siguiente fase. Por defecto se distribuyen en orden de clasificación; podés ajustar cualquier equipo."
              : "Asigná cada clasificado a un lugar del bracket. Por defecto se asignan en orden; podés intercambiar."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {classified.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Todavía no hay clasificados. Cerrá los partidos pendientes de la fase {fromPhase}.
            </p>
          ) : (
            <div className="space-y-2 py-2">
              {classified.map((c) => (
                <div
                  key={c.teamId}
                  className="flex items-center justify-between gap-3 rounded-md border p-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{nameOf(c.teamId)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {c.position}° de {c.fromGroupName}
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
        </ScrollArea>

        <DialogFooter className="gap-2">
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
