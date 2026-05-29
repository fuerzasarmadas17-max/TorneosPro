"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FastForward, Loader2, Trash2 } from "lucide-react";
import { Tournament } from "@/types";
import { useTournaments } from "@/context/tournament-context";
import { toast } from "sonner";
import {
  generateRandomResult,
  getCurrentPhaseMatches,
  getNextJornadaMatches,
  shouldForceWinner,
} from "@/lib/admin/auto-advance";

type AdvanceMode = "jornada" | "phase";
type AdvanceStep = "select" | "confirm";

interface AdminActionsProps {
  tournament: Tournament;
}

export function AdminActions({ tournament }: AdminActionsProps) {
  const router = useRouter();
  const { updateMatch, removeTournament } = useTournaments();

  // Advance dialog
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceMode, setAdvanceMode] = useState<AdvanceMode>("jornada");
  const [advanceStep, setAdvanceStep] = useState<AdvanceStep>("select");
  const [advancing, setAdvancing] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const closeAdvance = () => {
    if (advancing) return;
    setAdvanceOpen(false);
    setAdvanceStep("select");
  };

  const handleAdvanceConfirm = async () => {
    const matches =
      advanceMode === "jornada"
        ? getNextJornadaMatches(tournament)
        : getCurrentPhaseMatches(tournament);

    if (matches.length === 0) {
      toast.error("No hay partidos pendientes para completar");
      closeAdvance();
      return;
    }

    setAdvancing(true);
    try {
      // Sequential so the downstream hooks (group stage complete → playoff
      // bracket generation, winner propagation) fire in the right order.
      for (const m of matches) {
        const result = generateRandomResult(
          tournament.sport,
          tournament.bestOf,
          shouldForceWinner(tournament, m)
        );
        await updateMatch(
          tournament.id,
          m.id,
          result.homeScore,
          result.awayScore,
          undefined,
          result.sets
        );
      }
      toast.success(
        `${matches.length} ${matches.length === 1 ? "partido completado" : "partidos completados"}`
      );
      closeAdvance();
    } catch (err) {
      console.error("auto-advance error:", err);
      toast.error("Error al avanzar el torneo");
    } finally {
      setAdvancing(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      const ok = await removeTournament(tournament.id);
      if (!ok) {
        toast.error("Error al eliminar el torneo");
        setDeleting(false);
        return;
      }
      toast.success("Torneo eliminado");
      router.push("/dashboard");
    } catch (err) {
      console.error("delete tournament error:", err);
      toast.error("Error al eliminar el torneo");
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setAdvanceStep("select");
            setAdvanceOpen(true);
          }}
        >
          <FastForward className="h-4 w-4 mr-2" />
          Avanzar
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Eliminar torneo
        </Button>
      </div>

      {/* Avanzar dialog */}
      <Dialog
        open={advanceOpen}
        onOpenChange={(o) => {
          if (advancing) return;
          if (o) setAdvanceOpen(true);
          else closeAdvance();
        }}
      >
        <DialogContent className="sm:max-w-md">
          {advanceStep === "select" ? (
            <>
              <DialogHeader>
                <DialogTitle>Avanzar torneo</DialogTitle>
                <DialogDescription>
                  Genera resultados aleatorios para los partidos pendientes (solo
                  scores, sin eventos).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-1">
                <label className="flex items-start gap-3 cursor-pointer rounded-md border p-3 hover:bg-accent/40 transition-colors">
                  <input
                    type="radio"
                    name="advance-mode"
                    value="jornada"
                    checked={advanceMode === "jornada"}
                    onChange={() => setAdvanceMode("jornada")}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <div className="font-medium text-sm">Avanzar fecha</div>
                    <div className="text-xs text-muted-foreground">
                      Llena la próxima jornada pendiente.
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer rounded-md border p-3 hover:bg-accent/40 transition-colors">
                  <input
                    type="radio"
                    name="advance-mode"
                    value="phase"
                    checked={advanceMode === "phase"}
                    onChange={() => setAdvanceMode("phase")}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <div className="font-medium text-sm">Avanzar fase</div>
                    <div className="text-xs text-muted-foreground">
                      Llena todos los partidos de la fase actual. Si la fase termina, se dispara la siguiente (próxima fase de grupos / playoffs).
                    </div>
                  </div>
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeAdvance}>
                  Cancelar
                </Button>
                <Button onClick={() => setAdvanceStep("confirm")}>Guardar</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>¿Seguro?</DialogTitle>
                <DialogDescription>
                  Esto hará cambios <strong>irreversibles</strong> en el torneo:
                  se generarán resultados aleatorios para los partidos seleccionados ({advanceMode === "jornada" ? "próxima jornada" : "fase actual"}).
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={closeAdvance}
                  disabled={advancing}
                >
                  Cancelar
                </Button>
                <Button onClick={handleAdvanceConfirm} disabled={advancing}>
                  {advancing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Avanzando...
                    </>
                  ) : (
                    "Confirmar"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Eliminar dialog */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => {
          if (deleting) return;
          setDeleteOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar torneo</DialogTitle>
            <DialogDescription>
              Vas a eliminar <strong>{tournament.name}</strong> y{" "}
              <strong>todos sus datos asociados</strong> (equipos del torneo,
              partidos, eventos, grupos). Esta acción <strong>no se puede deshacer</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
