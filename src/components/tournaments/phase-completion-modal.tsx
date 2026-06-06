"use client";

import { Tournament } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PartyPopper, ArrowRight } from "lucide-react";

interface PhaseCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament;
  /** Phase that just finished. The modal points the organizer at the next
   *  phase (group stage or playoff bracket) for configuration. */
  finishedPhase: number;
  /** Called when the user clicks the "go to next phase" action. The parent
   *  uses this to switch the controlled Tabs to the correct tab key. */
  onGoToNext: (nextTabValue: string) => void;
}

/**
 * Pieza F: one-shot celebration / hand-off modal. Pops up the moment the last
 * match of a phase is marked completed and points the organizer at the next
 * tab where the real configuration happens. Closing it does nothing destructive
 * — the work all lives in the next phase's tab.
 */
export function PhaseCompletionModal({
  open,
  onOpenChange,
  tournament,
  finishedPhase,
  onGoToNext,
}: PhaseCompletionModalProps) {
  // The next destination depends on whether more group phases follow. If the
  // finished phase is the last one in phaseConfigs (or there's no
  // phaseConfigs at all, i.e. single-phase), the next destination is the
  // playoff bracket. Otherwise it's the next group phase.
  const isLastGroupPhase = !tournament.phaseConfigs?.some(
    (c) => c.phase > finishedPhase
  );
  const nextLabel = isLastGroupPhase ? "Playoffs" : `Fase ${finishedPhase + 1}`;
  const nextTabValue = isLastGroupPhase
    ? "playoffs"
    : `phase${finishedPhase + 1}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <PartyPopper className="h-6 w-6 text-amber-500" />
            <DialogTitle>¡Fase {finishedPhase} completada!</DialogTitle>
          </div>
          <DialogDescription>
            Se cargaron todas las fechas de esta fase. Andá a{" "}
            <strong>{nextLabel}</strong> para configurarla.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button
            onClick={() => {
              onGoToNext(nextTabValue);
              onOpenChange(false);
            }}
          >
            Ir a {nextLabel}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
