"use client";

import { useState } from "react";
import { Tournament } from "@/types";
import { BracketView } from "./bracket-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTournaments } from "@/context/tournament-context";
import { BracketMatchupBuilder } from "@/components/tournaments/bracket-matchup-builder";
import { PlayoffFinalConfigDialog } from "@/components/tournaments/playoff-final-config-dialog";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";

interface PlayoffBracketViewProps {
  tournament: Tournament;
  canEdit: boolean;
}

export function PlayoffBracketView({ tournament, canEdit }: PlayoffBracketViewProps) {
  const { updatePlayoffConfig, generatePlayoffFixture } = useTournaments();
  const [editing, setEditing] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [finalConfigOpen, setFinalConfigOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
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

  // Round-1 matches are the matchup slots. A bracket is "unconfigured" when
  // every round-1 match has no teams; "configured" once at least one slot has
  // been filled (the user can save partial work and come back).
  const round1Matches = playoffTournament.matches.filter((m) => m.round === 1);
  const bracketUnconfigured =
    round1Matches.length > 0 &&
    round1Matches.every((m) => !m.homeTeamId && !m.awayTeamId);
  const bracketConfigured =
    round1Matches.length > 0 &&
    round1Matches.some((m) => m.homeTeamId || m.awayTeamId);

  const handleSave = async () => {
    const value = parseInt(advanceCount);
    if (!value || value < 2) {
      toast.error("Mínimo 2 equipos deben clasificar");
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

  const handleGenerateFixture = async () => {
    setGenerating(true);
    const ok = await generatePlayoffFixture(tournament.id);
    setGenerating(false);
    if (ok) {
      toast.success(
        tournament.playoffDoubleLeg
          ? "Fixture generado (ida y vuelta)"
          : "Fixture generado"
      );
    } else {
      toast.error("No pudimos generar el fixture");
    }
  };

  // ============================================================
  // STATE: group stage not finished yet
  // ============================================================
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
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
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

  // ============================================================
  // STATE A: bracket exists but no team assignments yet
  // ============================================================
  if (bracketUnconfigured) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div>
            <p className="text-base font-medium">Playoffs pendientes de configuración</p>
            <p className="text-sm text-muted-foreground">
              La fase de grupos terminó. Armá los enfrentamientos del bracket.
            </p>
          </div>
          {canEdit ? (
            <Button onClick={() => setBuilderOpen(true)}>
              Crear enfrentamientos
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Esperando que el organizador arme el bracket.
            </p>
          )}
        </div>
        <BracketMatchupBuilder
          open={builderOpen}
          onOpenChange={setBuilderOpen}
          tournament={tournament}
          fromPhase={lastGroupPhase}
        />
      </div>
    );
  }

  // ============================================================
  // STATE B: matchups configured, fixture not generated yet
  // ============================================================
  if (bracketConfigured && !tournament.playoffFixtureGenerated) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-center">
          <div>
            <p className="text-base font-medium">
              Enfrentamientos del bracket
            </p>
            <p className="text-sm text-muted-foreground">
              {tournament.playoffDoubleLeg
                ? "Modalidad: ida y vuelta. Cuando generes el fixture se van a crear los partidos de vuelta."
                : "Modalidad: a un solo partido."}
            </p>
          </div>
          {canEdit && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBuilderOpen(true)}
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Editar enfrentamientos
              </Button>
              <Button
                size="sm"
                disabled={generating}
                onClick={handleGenerateFixture}
              >
                {generating ? "Generando..." : "Generar fixture"}
              </Button>
            </div>
          )}
        </div>

        {/* Preview of the round-1 matchups so the organizer sees what they
            saved before committing. */}
        <BracketView tournament={playoffTournament} canEdit={false} />

        <BracketMatchupBuilder
          open={builderOpen}
          onOpenChange={setBuilderOpen}
          tournament={tournament}
          fromPhase={lastGroupPhase}
        />
      </div>
    );
  }

  // ============================================================
  // STATE C: fixture generated — regular bracket view
  // ============================================================
  // Lock "Editar enfrentamientos" once any bracket match has a result loaded.
  // Re-assigning round-1 slots after results exist would corrupt the winner
  // propagation chain. Match schedule changes (dates) still leave editing
  // available — the organizer can rearrange matchups until somebody plays.
  const bracketHasResults = playoffTournament.matches.some(
    (m) => m.homeScore != null || m.awayScore != null || m.winnerId != null
  );

  // Pieza I follow-up: re-entry point for the "Configurar final" modal.
  // The auto-trigger in TournamentDetail only fires once per session, so if
  // the organizer dismissed it (or the trigger missed for any reason) the
  // button here gives them a way back. Visible when both finalists are
  // known, no final result is loaded yet, and the format is still
  // unconfigured.
  // For double-leg brackets the finalists' teams live on the IDA round
  // (maxRound-1), not the vuelta. Same fix as the modal trigger in
  // TournamentDetail and configurePlayoffFinal.
  const maxBracketRound = playoffTournament.matches.length > 0
    ? Math.max(...playoffTournament.matches.map((m) => m.round))
    : 0;
  const finalsIdaRound = tournament.playoffDoubleLeg
    ? maxBracketRound - 1
    : maxBracketRound;
  const finalIdaMatches = playoffTournament.matches
    .filter((m) => m.round === finalsIdaRound)
    .sort((a, b) => a.matchNumber - b.matchNumber);
  const finalAllMatches = playoffTournament.matches.filter(
    (m) =>
      m.round === maxBracketRound ||
      (tournament.playoffDoubleLeg && m.round === finalsIdaRound)
  );
  const finalsKnown =
    finalIdaMatches.length > 0 &&
    !!finalIdaMatches[0].homeTeamId &&
    !!finalIdaMatches[0].awayTeamId;
  const finalHasAnyResult = finalAllMatches.some(
    (m) => m.homeScore != null || m.awayScore != null || m.winnerId != null
  );
  const canConfigureFinal =
    canEdit &&
    finalsKnown &&
    !finalHasAnyResult &&
    !tournament.playoffFinalFormat;

  return (
    <div className="space-y-3">
      {(canEdit && !bracketHasResults) || canConfigureFinal ? (
        <div className="flex justify-end gap-2 flex-wrap">
          {canConfigureFinal && (
            <Button size="sm" onClick={() => setFinalConfigOpen(true)}>
              Configurar final
            </Button>
          )}
          {canEdit && !bracketHasResults && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBuilderOpen(true)}
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Editar enfrentamientos
            </Button>
          )}
        </div>
      ) : null}
      {/* Playoff bracket is view-only — match results are loaded from the
          Calendario tab and dates from the Fechas tab, same UX as the rest
          of the matchdays. The "Editar enfrentamientos" and "Configurar
          final" buttons above keep the structural editing entrypoint. */}
      <BracketView tournament={playoffTournament} canEdit={false} />
      <BracketMatchupBuilder
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        tournament={tournament}
        fromPhase={lastGroupPhase}
      />
      <PlayoffFinalConfigDialog
        open={finalConfigOpen}
        onOpenChange={setFinalConfigOpen}
        tournament={tournament}
      />
    </div>
  );
}
