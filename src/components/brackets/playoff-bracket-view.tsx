"use client";

import { useState } from "react";
import { Tournament } from "@/types";
import { BracketView } from "./bracket-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTournaments } from "@/context/tournament-context";
import { PhaseConfigDialog } from "@/components/tournaments/phase-config-dialog";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";

interface PlayoffBracketViewProps {
  tournament: Tournament;
  canEdit: boolean;
}

export function PlayoffBracketView({ tournament, canEdit }: PlayoffBracketViewProps) {
  const { updatePlayoffConfig } = useTournaments();
  const [editing, setEditing] = useState(false);
  const [bracketConfigOpen, setBracketConfigOpen] = useState(false);
  const [advanceCount, setAdvanceCount] = useState(
    String(tournament.playoffConfig?.totalAdvancing || "")
  );

  const playoffTournament: Tournament = {
    ...tournament,
    matches: tournament.matches.filter((m) => m.phase === "playoff"),
  };

  // The "last group phase" — fromPhase for getClassifiedTeamsRanked. For
  // single-phase tournaments this is 1; for multi-phase it's the highest
  // phase number in phaseConfigs.
  const lastGroupPhase = tournament.phaseConfigs?.length
    ? Math.max(...tournament.phaseConfigs.map((c) => c.phase))
    : 1;

  // A round-1 bracket is "unconfigured" when every match has neither home nor
  // away set. As soon as the organizer assigns one team via the dialog it
  // becomes configured. Used to gate the configure button.
  const bracketMatches = playoffTournament.matches.filter((m) => m.round === 1);
  const bracketUnconfigured =
    bracketMatches.length > 0 &&
    bracketMatches.every((m) => !m.homeTeamId && !m.awayTeamId);

  const handleSave = async () => {
    const value = parseInt(advanceCount);
    if (!value || value < 2) {
      toast.error("Minimo 2 equipos deben clasificar");
      return;
    }
    if (value > tournament.teamIds.length) {
      toast.error("No puede ser mayor al total de equipos");
      return;
    }

    // Distribute the total evenly across groups; surplus slots go to the
    // first groups (so 8 across 3 → {3,3,2}). This keeps sum(perGroup) ===
    // totalAdvancing — the bracket size and per-group advancement rule stay
    // in sync. The Configuration dialog lets the user refine per group.
    const groups = tournament.groups ?? [];
    const groupCount = groups.length || 1;
    const base = Math.floor(value / groupCount);
    const remainder = value % groupCount;
    const perGroup: Record<string, number> = {};
    groups.forEach((g, i) => {
      perGroup[g.id] = base + (i < remainder ? 1 : 0);
    });

    await updatePlayoffConfig(tournament.id, base, value, perGroup);
    toast.success(`Playoffs actualizados: ${value} equipos clasifican`);
    setEditing(false);
  };

  // Group stage finished, bracket created but no teams assigned yet — the
  // organizer needs to map classified teams to bracket slots via the dialog.
  if (tournament.groupStageComplete && bracketUnconfigured) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div>
            <p className="text-base font-medium">Playoffs pendientes de configuración</p>
            <p className="text-sm text-muted-foreground">
              La fase de grupos terminó. Asigná los clasificados a los lugares del bracket.
            </p>
          </div>
          {canEdit ? (
            <Button onClick={() => setBracketConfigOpen(true)}>
              Configurar playoffs
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Esperando que el organizador arme el bracket.
            </p>
          )}
        </div>
        <PhaseConfigDialog
          open={bracketConfigOpen}
          onOpenChange={setBracketConfigOpen}
          tournament={tournament}
          fromPhase={lastGroupPhase}
          mode="bracket"
        />
      </div>
    );
  }

  if (!tournament.groupStageComplete) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium mb-2">Playoffs pendientes</p>
          <p className="text-sm">
            Una vez termine la fase de grupos vas a poder armar el bracket de playoffs.
          </p>
        </div>

        {canEdit && tournament.playoffConfig && (
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="text-muted-foreground">Equipos que clasifican: </span>
                <span className="font-medium">{tournament.playoffConfig.totalAdvancing}</span>
              </div>
              {!editing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(true)}
                >
                  <Settings2 className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
            </div>
            {editing && (
              <div className="flex items-end gap-2">
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">Equipos que clasifican a playoffs</Label>
                  <Input
                    type="number"
                    min={2}
                    max={tournament.teamIds.length}
                    value={advanceCount}
                    onChange={(e) => setAdvanceCount(e.target.value)}
                    className="h-9"
                  />
                </div>
                <Button size="sm" className="h-9" onClick={handleSave}>
                  Guardar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => {
                    setAdvanceCount(String(tournament.playoffConfig?.totalAdvancing || ""));
                    setEditing(false);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return <BracketView tournament={playoffTournament} canEdit={canEdit} />;
}
