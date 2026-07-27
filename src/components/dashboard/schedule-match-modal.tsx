"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarCheck, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tournament } from "@/types";
import { DateOrganizer } from "@/components/standings/date-organizer";
import { buildTournamentColorMap } from "@/lib/tournament-colors";

/**
 * Modal de 2 pasos para programar partidos desde el dashboard:
 *  1. Elegir el torneo (de los activos).
 *  2. Reutiliza el DateOrganizer de ese torneo — que ya trae filtro por equipo,
 *     dropdown de rival pendiente y el botón Programar. Al programar, el partido
 *     pasa a "scheduled" y aparece en la agenda (mismo contexto).
 */
export function ScheduleMatchModal({
  open,
  onOpenChange,
  tournaments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournaments: Tournament[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Resumen del último partido programado → dispara el modal de confirmación.
  const [confirmSummary, setConfirmSummary] = useState<string | null>(null);
  const colorMap = buildTournamentColorMap(tournaments.map((t) => t.id));
  const selected = tournaments.find((t) => t.id === selectedId) || null;

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setSelectedId(null); // reset al cerrar
      setConfirmSummary(null);
    }
    onOpenChange(o);
  };

  const hasUnscheduled =
    selected?.matches.some((m) => m.status === "unscheduled") ?? false;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>
            {selected ? selected.name : "Programar partido"}
          </DialogTitle>
          <DialogDescription>
            {selected
              ? "Elegí el equipo y el rival, y asigná fecha, hora y lugar."
              : "Elegí el torneo para el que querés programar partidos."}
          </DialogDescription>
        </DialogHeader>

        {!selected ? (
          <div className="space-y-2 min-w-0">
            {tournaments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No tenés torneos en curso.
              </p>
            ) : (
              tournaments.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: colorMap.get(t.id) }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {t.name}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2"
              onClick={() => setSelectedId(null)}
            >
              <ChevronLeft className="size-4" />
              Cambiar torneo
            </Button>
            {hasUnscheduled ? (
              <DateOrganizer
                tournament={selected}
                onScheduled={(summary) => setConfirmSummary(summary)}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <CalendarCheck className="size-8 opacity-40" />
                <p className="text-sm">
                  Este torneo no tiene partidos pendientes por programar.
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>

      {/* Confirmación al programar: más visible que el toast (que queda tapado
          por el modal). Permite seguir programando o salir. */}
      <Dialog
        open={!!confirmSummary}
        onOpenChange={(o) => !o && setConfirmSummary(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-green-600 dark:text-green-500" />
              ¡Partido programado!
            </DialogTitle>
            <DialogDescription>
              {confirmSummary} quedó agendado. Ya aparece en tu agenda.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmSummary(null);
                handleOpenChange(false);
              }}
            >
              Salir
            </Button>
            <Button onClick={() => setConfirmSummary(null)}>
              Seguir programando
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
