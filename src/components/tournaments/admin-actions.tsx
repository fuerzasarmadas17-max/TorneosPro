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
import { FastForward, Loader2, Star, Trash2 } from "lucide-react";
import { Tournament } from "@/types";
import { useTournaments } from "@/context/tournament-context";
import { authHeader } from "@/lib/auth-header";
import { toast } from "sonner";

type AdvanceMode = "jornada" | "phase";
type AdvanceStep = "select" | "confirm";

interface AdminActionsProps {
  tournament: Tournament;
}

export function AdminActions({ tournament }: AdminActionsProps) {
  const router = useRouter();
  const { refetch } = useTournaments();

  // Advance dialog
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceMode, setAdvanceMode] = useState<AdvanceMode>("jornada");
  const [advanceStep, setAdvanceStep] = useState<AdvanceStep>("select");
  const [advancing, setAdvancing] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Destacar en la portada
  const [featured, setFeatured] = useState(!!tournament.featured);
  const [featuring, setFeaturing] = useState(false);

  const handleToggleFeatured = async () => {
    const next = !featured;
    setFeaturing(true);
    // Optimista: el interruptor responde de una y se revierte si falla.
    setFeatured(next);
    try {
      const res = await fetch(
        `/api/admin/tournaments/${tournament.id}/featured`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(await authHeader()),
          },
          body: JSON.stringify({ featured: next }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFeatured(!next);
        toast.error(data?.error || "No se pudo cambiar el destacado");
        return;
      }
      await refetch();
      toast.success(
        next
          ? "Destacado en la portada"
          : "Ya no aparece destacado en la portada"
      );
      // La portada se sirve con revalidate de 60s, así que el cambio puede
      // tardar hasta un minuto en verse ahí.
      router.refresh();
    } catch (err) {
      console.error("featured toggle error:", err);
      setFeatured(!next);
      toast.error("No se pudo cambiar el destacado");
    } finally {
      setFeaturing(false);
    }
  };

  const closeAdvance = () => {
    if (advancing) return;
    setAdvanceOpen(false);
    setAdvanceStep("select");
  };

  const handleAdvanceConfirm = async () => {
    setAdvancing(true);
    try {
      const res = await fetch(
        `/api/admin/tournaments/${tournament.id}/advance`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(await authHeader()),
          },
          body: JSON.stringify({ mode: advanceMode }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || "Error al avanzar el torneo");
        setAdvancing(false);
        return;
      }

      const { matchesAffected } = await res.json();
      if (matchesAffected === 0) {
        toast.error("No hay partidos pendientes para completar");
        closeAdvance();
        return;
      }

      // Refresh the local tournaments cache so the UI shows the new state.
      await refetch();
      toast.success(
        `${matchesAffected} ${matchesAffected === 1 ? "partido completado" : "partidos completados"}`
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
      const res = await fetch(`/api/admin/tournaments/${tournament.id}`, {
        method: "DELETE",
        headers: { ...(await authHeader()) },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || "Error al eliminar el torneo");
        setDeleting(false);
        return;
      }
      // Drop it from the local cache too, so back navigation doesn't show it.
      await refetch();
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
          variant={featured ? "default" : "outline"}
          size="sm"
          onClick={handleToggleFeatured}
          disabled={featuring}
          aria-pressed={featured}
        >
          {featuring ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Star
              className={`h-4 w-4 mr-2 ${featured ? "fill-current" : ""}`}
            />
          )}
          {featured ? "Destacado en la portada" : "Destacar en la portada"}
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
