"use client";

import { Tournament } from "@/types";
import { getFinalSeriesChampion } from "@/data/helpers";
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
import { Trophy } from "lucide-react";

interface TournamentChampionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament;
}

/**
 * Celebration modal that fires when the tournament transitions to
 * `status === "completed"` during the session — i.e. the organizer just
 * loaded the result that crowned the champion. One-shot per page load to
 * match Pieza F's modal semantics (a reload won't re-fire it).
 */
export function TournamentChampionModal({
  open,
  onOpenChange,
  tournament,
}: TournamentChampionModalProps) {
  const { teams } = useTournaments();

  // Champion comes from the Pieza I helper so the modal works for single,
  // double-leg AND best-of-N final formats uniformly. For the runner-up we
  // pick the other team that played in the final series.
  const championId = getFinalSeriesChampion(tournament);
  const playoff = tournament.matches.filter(
    (m) => m.phase === "playoff" || !m.phase
  );
  const maxRound =
    playoff.length > 0 ? Math.max(...playoff.map((m) => m.round)) : 0;
  const lastRound = playoff
    .filter((m) => m.round === maxRound)
    .sort((a, b) => a.matchNumber - b.matchNumber);
  const firstFinal = lastRound[0];
  const runnerUpId =
    championId && firstFinal
      ? firstFinal.homeTeamId === championId
        ? firstFinal.awayTeamId
        : firstFinal.homeTeamId === null
          ? null
          : firstFinal.homeTeamId
      : null;
  const championName = championId
    ? teams.find((t) => t.id === championId)?.name ?? "El campeón"
    : "El campeón";
  const runnerUpName = runnerUpId
    ? teams.find((t) => t.id === runnerUpId)?.name ?? null
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex flex-col items-center gap-2 text-center pt-2">
            <Trophy className="h-12 w-12 text-amber-500" />
            <DialogTitle className="text-2xl">¡Tenemos campeón!</DialogTitle>
            <DialogDescription className="text-base">
              <span className="font-semibold text-foreground">{championName}</span>{" "}
              se consagró campeón del torneo{" "}
              <span className="font-semibold text-foreground">{tournament.name}</span>.
            </DialogDescription>
          </div>
        </DialogHeader>

        {runnerUpName && (
          <p className="text-sm text-muted-foreground text-center -mt-2">
            Subcampeón: <span className="font-medium text-foreground">{runnerUpName}</span>
          </p>
        )}

        <DialogFooter className="sm:justify-center">
          <Button onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
