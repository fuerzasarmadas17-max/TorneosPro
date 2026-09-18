"use client";

import { useState } from "react";
import { Tournament, TournamentCup } from "@/types";
import { BracketView } from "./bracket-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTournaments } from "@/context/tournament-context";
import { BracketMatchupBuilder } from "@/components/tournaments/bracket-matchup-builder";
import { PlayoffFinalConfigDialog } from "@/components/tournaments/playoff-final-config-dialog";
import { CupsConfigDialog } from "@/components/tournaments/cups-config-dialog";
import { canEditCups, canUseCups, scopeToCup } from "@/lib/copas";
import { cupNeedsFinalSetup, getCupFinalists } from "@/data/helpers";
import { toast } from "sonner";
import { Settings2, Trophy } from "lucide-react";

interface PlayoffBracketViewProps {
  /** El torneo entero, también cuando se muestra una copa. */
  tournament: Tournament;
  canEdit: boolean;
  /** Torneo con copas: la llave de qué copa. La vista es la misma de la llave
   *  única, recortada a esa copa (ver `CupsView`). */
  cup?: TournamentCup;
}

export function PlayoffBracketView({ tournament: fullTournament, canEdit, cup }: PlayoffBracketViewProps) {
  const { updatePlayoffConfig, generatePlayoffFixture, createPlayoffBracket } =
    useTournaments();
  // Con copa, todo lo de abajo mira solo la llave de esa copa.
  const tournament = cup ? scopeToCup(fullTournament, cup) : fullTournament;
  const [editing, setEditing] = useState(false);
  const [cupsOpen, setCupsOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [finalConfigOpen, setFinalConfigOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [creatingBracket, setCreatingBracket] = useState(false);
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
  // Tournaments whose calendar was built by hand (jornada por jornada) never
  // got the empty bracket that "Generar Aleatorio" creates, so they have zero
  // playoff matches. Without this they fell through to State C and rendered an
  // empty bracket with no way forward — the organizer creates it on demand.
  const bracketMissing = playoffTournament.matches.length === 0;
  const bracketUnconfigured =
    bracketMissing ||
    (round1Matches.length > 0 &&
      round1Matches.every((m) => !m.homeTeamId && !m.awayTeamId));
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

  // Opens the matchup builder. When the bracket rows don't exist yet they're
  // created first — the builder needs round-1 slots to render.
  // Con copa se pasa siempre: si la llave de la copa quedó de otro tamaño
  // (un descalificado le sacó un equipo), createPlayoffBracket la rehace.
  const handleOpenBuilder = async () => {
    if (!bracketMissing && !cup) {
      setBuilderOpen(true);
      return;
    }
    setCreatingBracket(true);
    const ok = await createPlayoffBracket(tournament.id, cup?.id);
    setCreatingBracket(false);
    if (!ok) {
      toast.error(
        cup
          ? `${cup.name} necesita al menos 2 equipos`
          : "Primero definí cuántos equipos clasifican a playoffs"
      );
      return;
    }
    setBuilderOpen(true);
  };

  const handleGenerateFixture = async () => {
    setGenerating(true);
    const ok = await generatePlayoffFixture(tournament.id);
    setGenerating(false);
    if (ok) {
      toast.success(
        (tournament.playoffDoubleLeg
          ? "Fixture generado (ida y vuelta)"
          : "Fixture generado") + (cup ? " para todas las copas" : "")
      );
    } else {
      toast.error("No pudimos generar el fixture");
    }
  };

  // Torneo de una llave que todavía puede pasar a varias copas: nadie puso un
  // equipo en la llave y es de una sola fase de grupos.
  const offerCups =
    !cup && canEdit && canUseCups(fullTournament) && canEditCups(fullTournament);
  const cupsOffer = offerCups ? (
    <div className="rounded-lg border border-dashed p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div className="text-sm">
        <p className="font-medium">¿Querés que todos sigan jugando?</p>
        <p className="text-muted-foreground">
          Repartí a los equipos en varias copas según su puesto: Oro, Plata,
          Bronce. Cada copa tiene su llave y su campeón. Tiene un recargo del
          15% sobre el precio del torneo.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => setCupsOpen(true)} className="shrink-0">
        <Trophy className="h-4 w-4 mr-2" />
        Jugar con varias copas
      </Button>
      {cupsOpen && (
        <CupsConfigDialog open={cupsOpen} onOpenChange={setCupsOpen} tournament={fullTournament} />
      )}
    </div>
  ) : null;

  // Con copas el fixture se genera para todas juntas: se habilita cuando
  // todas tienen sus cruces armados.
  const cupsPending = cup
    ? (fullTournament.cups ?? []).filter(
        (c) =>
          !fullTournament.matches.some(
            (m) =>
              m.phase === "playoff" &&
              m.cupId === c.id &&
              m.round === 1 &&
              (m.homeTeamId || m.awayTeamId)
          )
      )
    : [];

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
        {cupsOffer}
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
              La fase de grupos terminó. Armá los enfrentamientos
              {cup ? ` — ${cup.name}` : " del bracket"}.
            </p>
          </div>
          {canEdit ? (
            <Button onClick={handleOpenBuilder} disabled={creatingBracket}>
              {creatingBracket ? "Preparando..." : "Crear enfrentamientos"}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Esperando que el organizador arme el bracket.
            </p>
          )}
        </div>
        {/* Keyed on the slot count so the builder remounts once the bracket
            is created — its smart-default seeding runs on mount and would
            otherwise see zero slots. */}
        <BracketMatchupBuilder
          key={`builder-${round1Matches.length}`}
          open={builderOpen}
          onOpenChange={setBuilderOpen}
          tournament={tournament}
          fromPhase={lastGroupPhase}
          cup={cup}
        />
        {cupsOffer}
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
                disabled={generating || cupsPending.length > 0}
                onClick={handleGenerateFixture}
              >
                {generating
                  ? "Generando..."
                  : cup
                    ? "Generar fixture de todas las copas"
                    : "Generar fixture"}
              </Button>
            </div>
          )}
          {canEdit && cupsPending.length > 0 && (
            <p className="text-xs text-muted-foreground">
              El fixture se genera para todas las copas juntas. Falta armar los
              cruces de: {cupsPending.map((c) => c.name).join(", ")}.
            </p>
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
          cup={cup}
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
  // Con copas: la primera copa que llega a la final elige el formato de todas;
  // a las otras se les arma la final con ese formato cuando llegan.
  const canConfigureFinal = cup
    ? canEdit &&
      !!getCupFinalists(fullTournament, cup.id) &&
      !finalHasAnyResult &&
      (!fullTournament.playoffFinalFormat ||
        cupNeedsFinalSetup(fullTournament, cup.id))
    : canEdit &&
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
        cup={cup}
      />
      <PlayoffFinalConfigDialog
        key={cup?.id ?? "final"}
        open={finalConfigOpen}
        onOpenChange={setFinalConfigOpen}
        tournament={cup ? fullTournament : tournament}
        cup={cup}
      />
    </div>
  );
}
