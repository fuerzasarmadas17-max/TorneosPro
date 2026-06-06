"use client";

import { useMemo, useState } from "react";
import { Tournament, Match } from "@/types";
import { getClassifiedTeamsRanked, getRoundLabel } from "@/data/helpers";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface BracketMatchupBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament;
  /** Last group phase that feeds the playoffs (1 for single-phase, max
   *  phaseConfigs.phase for multi-phase). Used to compute the classified
   *  team list. */
  fromPhase: number;
}

/**
 * Pieza G: bracket-shaped matchup builder. Mirrors the layout of BracketView
 * (rounds as columns, matches stacked vertically) so the organizer sees the
 * actual fixture they're configuring. Only round-1 slots are editable — later
 * rounds render as read-only placeholders pointing at their feeder matches.
 * Below the bracket: "Ida y vuelta" checkbox that flips a tournament-level
 * flag without generating the return-leg matches yet.
 */
export function BracketMatchupBuilder({
  open,
  onOpenChange,
  tournament,
  fromPhase,
}: BracketMatchupBuilderProps) {
  const { configureBracketSlots, updateTournamentProps, teams } = useTournaments();

  const classified = useMemo(
    () => getClassifiedTeamsRanked(tournament, fromPhase),
    [tournament, fromPhase]
  );

  const nameOf = (id: string | null) =>
    id ? teams.find((t) => t.id === id)?.name ?? id : "";

  // Bracket matches grouped by round. We only render single-leg here even
  // when the tournament will be ida y vuelta — the doubled matches don't
  // exist until "Generar fixture" runs (see PlayoffBracketView).
  const round1Matches = useMemo(
    () =>
      tournament.matches
        .filter((m) => m.phase === "playoff" && m.round === 1)
        .sort((a, b) => a.matchNumber - b.matchNumber),
    [tournament.matches]
  );

  const rounds = useMemo(() => {
    const playoff = tournament.matches.filter((m) => m.phase === "playoff");
    if (playoff.length === 0) return [] as { roundNumber: number; roundLabel: string; matches: Match[] }[];
    const total = Math.max(...playoff.map((m) => m.round));
    const out: { roundNumber: number; roundLabel: string; matches: Match[] }[] = [];
    for (let r = 1; r <= total; r++) {
      const matches = playoff
        .filter((m) => m.round === r)
        .sort((a, b) => a.matchNumber - b.matchNumber);
      if (matches.length === 0) continue;
      out.push({
        roundNumber: r,
        roundLabel: getRoundLabel(r, total),
        matches,
      });
    }
    return out;
  }, [tournament.matches]);

  // Per-slot assignment, keyed by `${matchId}:${side}`.
  const slotKey = (matchId: string, side: "home" | "away") => `${matchId}:${side}`;
  const [assignments, setAssignments] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};

    // Re-edit case: bracket already has team assignments saved. Seed the
    // dropdowns from current state so the organizer just tweaks.
    const hasPreexisting = round1Matches.some(
      (m) => m.homeTeamId || m.awayTeamId
    );
    if (hasPreexisting) {
      for (const m of round1Matches) {
        if (m.homeTeamId) out[slotKey(m.id, "home")] = m.homeTeamId;
        if (m.awayTeamId) out[slotKey(m.id, "away")] = m.awayTeamId;
      }
      return out;
    }

    // First-time case: smart default that pre-places byes. Pick which cards
    // get byes (top seeds pass directly to the next round) and which are
    // play-in matches. Byes spread evenly across the bracket halves —
    // first the even-indexed cards (top of each half), then odd-indexed —
    // so the structure stays balanced. Top classified seeds get the byes.
    const totalSlots = round1Matches.length * 2;
    const byeCount = Math.max(0, totalSlots - classified.length);
    const byeCardIdx = new Set<number>();
    for (
      let i = 0;
      i < round1Matches.length && byeCardIdx.size < byeCount;
      i += 2
    ) {
      byeCardIdx.add(i);
    }
    for (
      let i = 1;
      i < round1Matches.length && byeCardIdx.size < byeCount;
      i += 2
    ) {
      byeCardIdx.add(i);
    }
    let teamIdx = 0;
    for (let cardIdx = 0; cardIdx < round1Matches.length; cardIdx++) {
      const card = round1Matches[cardIdx];
      if (byeCardIdx.has(cardIdx)) {
        // Bye card: one team on home, away stays empty (= the team
        // auto-advances).
        if (teamIdx < classified.length) {
          out[slotKey(card.id, "home")] = classified[teamIdx].teamId;
          teamIdx++;
        }
      } else {
        if (teamIdx < classified.length) {
          out[slotKey(card.id, "home")] = classified[teamIdx].teamId;
          teamIdx++;
        }
        if (teamIdx < classified.length) {
          out[slotKey(card.id, "away")] = classified[teamIdx].teamId;
          teamIdx++;
        }
      }
    }
    return out;
  });
  const [doubleLeg, setDoubleLeg] = useState<boolean>(
    tournament.playoffDoubleLeg ?? false
  );
  const [saving, setSaving] = useState(false);

  // Per-card bye flag. Source of truth is THIS set only — the auto-detect
  // "one slot filled, one empty" pattern would re-trigger the badge after
  // the user unmarked a card, so we ignore it in the UI and trust the
  // explicit toggle instead. At save time the server-side resolver still
  // sees the pattern and propagates the lone team to the next round, so
  // unmarked-but-half-filled cards still work correctly (just without the
  // visual cue).
  //
  // Initialized from the smart default: any card that opens with one slot
  // filled lands here so the badge appears immediately.
  const [byeCards, setByeCards] = useState<Set<string>>(() => {
    const out = new Set<string>();
    for (const m of round1Matches) {
      const home = assignments[slotKey(m.id, "home")];
      const away = assignments[slotKey(m.id, "away")];
      if ((!!home && !away) || (!home && !!away)) {
        out.add(m.id);
      }
    }
    return out;
  });
  const isCardBye = (matchId: string) => byeCards.has(matchId);

  const toggleBye = (matchId: string) => {
    if (byeCards.has(matchId)) {
      // Turning bye OFF: drop the flag; visitante stays empty until the
      // user picks a team (or leaves it as a passive bye at save time).
      setByeCards((prev) => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
    } else {
      // Turning bye ON: clear visitante so the local pick auto-advances.
      setByeCards((prev) => new Set(prev).add(matchId));
      setAssignments((prev) => {
        const next = { ...prev };
        delete next[slotKey(matchId, "away")];
        return next;
      });
    }
  };

  const usedTeamIds = useMemo(() => {
    const used = new Set<string>();
    for (const id of Object.values(assignments)) used.add(id);
    return used;
  }, [assignments]);

  const setSlot = (matchId: string, side: "home" | "away", value: string) => {
    setAssignments((prev) => {
      const next = { ...prev };
      const key = slotKey(matchId, side);
      if (!value) {
        delete next[key];
        return next;
      }
      // Auto-vacate any other slot that had this team.
      for (const [k, v] of Object.entries(next)) {
        if (v === value && k !== key) delete next[k];
      }
      next[key] = value;
      return next;
    });
  };

  const handleSave = async () => {
    const bySlot: Record<
      string,
      { homeTeamId: string | null; awayTeamId: string | null }
    > = {};
    for (const m of round1Matches) {
      bySlot[m.id] = {
        homeTeamId: assignments[slotKey(m.id, "home")] ?? null,
        awayTeamId: assignments[slotKey(m.id, "away")] ?? null,
      };
    }

    setSaving(true);
    const okSlots = await configureBracketSlots(tournament.id, bySlot);
    if (!okSlots) {
      setSaving(false);
      toast.error("No pudimos guardar los enfrentamientos");
      return;
    }
    if (doubleLeg !== !!tournament.playoffDoubleLeg) {
      await updateTournamentProps(tournament.id, {
        playoffDoubleLeg: doubleLeg,
      });
    }
    setSaving(false);
    toast.success("Enfrentamientos guardados");
    onOpenChange(false);
  };

  // Lookup so a later-round slot can show "Ganador Partido 1" instead of an
  // empty placeholder. nextMatchId is set on round-1 matches, so we invert
  // it: feedersByNextMatch[nextMatchId] = [feeder matchNumber, ...].
  const feedersByNextMatch = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const m of tournament.matches.filter((x) => x.phase === "playoff")) {
      if (m.nextMatchId) {
        const arr = map.get(m.nextMatchId) ?? [];
        arr.push(m.matchNumber);
        map.set(m.nextMatchId, arr);
      }
    }
    // Stable order: ascending match number.
    for (const list of map.values()) list.sort((a, b) => a - b);
    return map;
  }, [tournament.matches]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Same layout pattern as PhaseConfigDialog: fixed header + scrollable
          middle + sticky footer. Override DialogContent's default grid with
          !flex so the middle can claim flex-1 and shrink (min-h-0) when the
          bracket overflows. */}
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden !flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Crear enfrentamientos</DialogTitle>
          <DialogDescription>
            Asigná los clasificados a los lugares del bracket. El mismo equipo
            no se puede repetir.
            {round1Matches.length * 2 > classified.length && (
              <>
                {" "}Tenés{" "}
                <strong>
                  {round1Matches.length * 2 - classified.length} bye
                  {round1Matches.length * 2 - classified.length === 1 ? "" : "s"}
                </strong>
                {" "}disponible
                {round1Matches.length * 2 - classified.length === 1 ? "" : "s"}:
                si querés que un equipo pase directo a la siguiente ronda,
                dejá el otro slot de su partido sin asignar.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-2">
          {round1Matches.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              El bracket todavía no existe. Generá primero el fixture de la
              fase {fromPhase} para crearlo.
            </p>
          ) : (
            <>
              {/* Bracket layout — rounds in columns, matches stacked. Mirrors
                  BracketView so the organizer sees what they're shaping. The
                  inner div handles its own horizontal scroll when the bracket
                  has many rounds. */}
              <div className="overflow-x-auto -mx-6 px-6">
                <div className="flex gap-6 py-3 min-w-max">
                  {rounds.map((round) => (
                    <div
                      key={round.roundNumber}
                      className="flex flex-col gap-3 min-w-[200px]"
                    >
                      <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wide text-center">
                        {round.roundLabel}
                      </div>
                      <div className="flex flex-col gap-4 flex-1 justify-around">
                        {round.matches.map((m) => (
                          <BracketSlotCard
                            key={m.id}
                            match={m}
                            isRound1={round.roundNumber === 1}
                            assignments={assignments}
                            slotKeyOf={slotKey}
                            setSlot={setSlot}
                            classified={classified}
                            usedTeamIds={usedTeamIds}
                            nameOf={nameOf}
                            feeders={feedersByNextMatch.get(m.id) ?? []}
                            isBye={isCardBye(m.id)}
                            onToggleBye={() => toggleBye(m.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ida y vuelta toggle, sits below the bracket as requested. */}
              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer mt-3">
                <input
                  type="checkbox"
                  checked={doubleLeg}
                  onChange={(e) => setDoubleLeg(e.target.checked)}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Ida y vuelta</div>
                  <div className="text-xs text-muted-foreground">
                    Cada llave del bracket se juega a dos partidos. Los partidos
                    de vuelta se crean cuando hagas click en{" "}
                    <strong>Generar fixture</strong>.
                  </div>
                </div>
              </label>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 px-6 py-4 border-t shrink-0 bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || round1Matches.length === 0}
          >
            {saving ? "Guardando..." : "Guardar enfrentamientos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One match cell in the bracket grid. For round 1 it's two Selects (Local /
 * Visitante). For later rounds it's a read-only placeholder pointing at the
 * feeder matches ("Ganador Partido 1 / Ganador Partido 2") so the organizer
 * sees the structure even before the bracket has any results.
 */
function BracketSlotCard({
  match,
  isRound1,
  assignments,
  slotKeyOf,
  setSlot,
  classified,
  usedTeamIds,
  nameOf,
  feeders,
  isBye,
  onToggleBye,
}: {
  match: Match;
  isRound1: boolean;
  assignments: Record<string, string>;
  slotKeyOf: (matchId: string, side: "home" | "away") => string;
  setSlot: (matchId: string, side: "home" | "away", value: string) => void;
  classified: ReturnType<typeof getClassifiedTeamsRanked>;
  usedTeamIds: Set<string>;
  nameOf: (id: string | null) => string;
  feeders: number[];
  isBye?: boolean;
  onToggleBye?: () => void;
}) {
  if (!isRound1) {
    return (
      <div className="rounded-md border bg-muted/30 overflow-hidden">
        <div className="bg-muted/50 px-2.5 py-1 text-[10px] uppercase text-muted-foreground tracking-wide border-b">
          Partido {match.matchNumber}
        </div>
        <div className="divide-y text-xs">
          <div className="px-2.5 py-2 text-muted-foreground">
            {feeders[0] != null ? `Ganador Partido ${feeders[0]}` : "—"}
          </div>
          <div className="px-2.5 py-2 text-muted-foreground">
            {feeders[1] != null ? `Ganador Partido ${feeders[1]}` : "—"}
          </div>
        </div>
      </div>
    );
  }

  const renderOption = (teamId: string, label: string, currentValue: string) => {
    const usedElsewhere = usedTeamIds.has(teamId) && teamId !== currentValue;
    return (
      <SelectItem key={teamId} value={teamId}>
        <span className={usedElsewhere ? "text-muted-foreground" : ""}>
          {label}
          {usedElsewhere ? " · en uso" : ""}
        </span>
      </SelectItem>
    );
  };

  const homeValue = assignments[slotKeyOf(match.id, "home")] ?? "";
  const awayValue = assignments[slotKeyOf(match.id, "away")] ?? "";

  const optionLabel = (teamId: string) => {
    const c = classified.find((x) => x.teamId === teamId);
    const meta = c && c.position > 0 ? ` · ${c.position}° ${c.fromGroupName}` : "";
    return `${nameOf(teamId)}${meta}`;
  };

  return (
    <div
      className={cn(
        "rounded-md border bg-card overflow-hidden",
        isBye && "border-amber-500/40"
      )}
    >
      <div className="bg-muted/40 px-2.5 py-1 text-[10px] uppercase text-muted-foreground tracking-wide border-b flex items-center justify-between gap-2">
        <span>Partido {match.matchNumber}</span>
        {onToggleBye && (
          <button
            type="button"
            onClick={onToggleBye}
            className={cn(
              "normal-case rounded px-2 py-0.5 text-[10px] font-medium border transition-colors",
              isBye
                ? "bg-amber-500/15 border-amber-500/40 text-amber-700"
                : "bg-background border-border text-muted-foreground hover:bg-accent"
            )}
            aria-pressed={isBye}
          >
            {isBye ? "✓ Bye" : "Marcar bye"}
          </button>
        )}
      </div>
      <div className="divide-y">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="text-[10px] uppercase text-muted-foreground tracking-wide w-10 shrink-0">
            Local
          </span>
          <Select value={homeValue} onValueChange={(v) => setSlot(match.id, "home", v)}>
            <SelectTrigger className="flex-1 h-8 text-xs">
              <SelectValue placeholder="Elegir" />
            </SelectTrigger>
            <SelectContent>
              {classified.map((c) =>
                renderOption(c.teamId, optionLabel(c.teamId), homeValue)
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="text-[10px] uppercase text-muted-foreground tracking-wide w-10 shrink-0">
            Visit.
          </span>
          {isBye ? (
            <div className="flex-1 h-8 px-2.5 flex items-center text-xs text-amber-700 bg-amber-500/5 rounded border border-amber-500/20">
              Bye — el local pasa directo
            </div>
          ) : (
            <Select value={awayValue} onValueChange={(v) => setSlot(match.id, "away", v)}>
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue placeholder="Elegir" />
              </SelectTrigger>
              <SelectContent>
                {classified.map((c) =>
                  renderOption(c.teamId, optionLabel(c.teamId), awayValue)
                )}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    </div>
  );
}
