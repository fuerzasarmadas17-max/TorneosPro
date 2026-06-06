"use client";

import { useMemo, useState } from "react";
import { Tournament } from "@/types";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trophy } from "lucide-react";
import { toast } from "sonner";

type FinalFormat = NonNullable<Tournament["playoffFinalFormat"]>;

interface PlayoffFinalConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament;
}

const FORMAT_OPTIONS: { value: FinalFormat; label: string; description: string; count: number }[] = [
  {
    value: "single",
    label: "Partido único",
    description: "Un solo partido decide al campeón.",
    count: 1,
  },
  {
    value: "double_leg",
    label: "Ida y vuelta",
    description: "Dos partidos. Gana el de mayor agregado.",
    count: 2,
  },
  {
    value: "best_of_5",
    label: "Mejor de 5",
    description: "Hasta 5 juegos. Gana el primero que llegue a 3 victorias.",
    count: 5,
  },
  {
    value: "best_of_7",
    label: "Mejor de 7",
    description: "Hasta 7 juegos. Gana el primero que llegue a 4 victorias.",
    count: 7,
  },
];

/**
 * Pieza I: shown once both finalists are known, lets the organizer pick the
 * format of the final series and optionally schedule the matches. Submit
 * materializes the series in DB via configurePlayoffFinal.
 */
export function PlayoffFinalConfigDialog({
  open,
  onOpenChange,
  tournament,
}: PlayoffFinalConfigDialogProps) {
  const { configurePlayoffFinal, teams } = useTournaments();
  const [format, setFormat] = useState<FinalFormat>(
    tournament.playoffFinalFormat ??
      (tournament.playoffDoubleLeg ? "double_leg" : "single")
  );
  const [schedules, setSchedules] = useState<
    { date: string; time: string; venue: string }[]
  >(() => Array.from({ length: 7 }, () => ({ date: "", time: "", venue: "" })));
  const [saving, setSaving] = useState(false);

  const matchCount = FORMAT_OPTIONS.find((f) => f.value === format)?.count ?? 1;

  // Surface the finalists in the modal so the organizer sees who's playing.
  // Same double-leg-aware lookup as configurePlayoffFinal: the ida row holds
  // the teams (vuelta keeps null teams until reconfiguration runs).
  const { teamA, teamB } = useMemo(() => {
    const playoff = tournament.matches.filter((m) => m.phase === "playoff");
    if (playoff.length === 0) return { teamA: null, teamB: null };
    const maxRound = Math.max(...playoff.map((m) => m.round));
    const idaRound = tournament.playoffDoubleLeg ? maxRound - 1 : maxRound;
    const ida = playoff
      .filter((m) => m.round === idaRound)
      .sort((a, b) => a.matchNumber - b.matchNumber)[0];
    const teamA = ida?.homeTeamId
      ? teams.find((t) => t.id === ida.homeTeamId)?.name ?? "Finalista A"
      : "Finalista A";
    const teamB = ida?.awayTeamId
      ? teams.find((t) => t.id === ida.awayTeamId)?.name ?? "Finalista B"
      : "Finalista B";
    return { teamA, teamB };
  }, [tournament.matches, tournament.playoffDoubleLeg, teams]);

  const setSchedule = (
    i: number,
    field: "date" | "time" | "venue",
    value: string
  ) => {
    setSchedules((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    // Only pass non-empty schedules; configurePlayoffFinal accepts partials.
    const relevant = schedules.slice(0, matchCount).map((s) => ({
      date: s.date || undefined,
      time: s.time || undefined,
      venue: s.venue || undefined,
    }));
    const ok = await configurePlayoffFinal(tournament.id, format, relevant);
    setSaving(false);
    if (ok) {
      toast.success("Final configurada");
      onOpenChange(false);
    } else {
      toast.error("No pudimos configurar la final");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <DialogTitle>Configurar la final</DialogTitle>
          </div>
          <DialogDescription>
            <span className="font-medium text-foreground">{teamA}</span>{" "}
            vs{" "}
            <span className="font-medium text-foreground">{teamB}</span>
            {" — "}elegí cómo se juega y, si querés, dejá las fechas armadas.
          </DialogDescription>
        </DialogHeader>

        {/* Format selection */}
        <div className="space-y-2">
          <Label className="text-sm">Formato</Label>
          <div className="space-y-2">
            {FORMAT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/40 transition-colors"
              >
                <input
                  type="radio"
                  name="final-format"
                  value={opt.value}
                  checked={format === opt.value}
                  onChange={() => setFormat(opt.value)}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {opt.description}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Schedule inputs per match */}
        <div className="space-y-2">
          <Label className="text-sm">
            Fechas (opcional, podés ajustar después en Calendario)
          </Label>
          <div className="space-y-2">
            {Array.from({ length: matchCount }, (_, i) => (
              <div
                key={i}
                className="rounded-md border bg-muted/30 p-2.5 space-y-2"
              >
                <div className="text-xs font-medium text-muted-foreground">
                  Juego {i + 1}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    type="date"
                    value={schedules[i].date}
                    onChange={(e) => setSchedule(i, "date", e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Input
                    type="time"
                    value={schedules[i].time}
                    onChange={(e) => setSchedule(i, "time", e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Input
                    placeholder="Cancha"
                    value={schedules[i].venue}
                    onChange={(e) => setSchedule(i, "venue", e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Confirmar final"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
