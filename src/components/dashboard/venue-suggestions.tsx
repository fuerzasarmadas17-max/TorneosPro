"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MapPin, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useVenueSuggestions } from "@/hooks/use-venue-suggestions";

/**
 * "Estas dos canchas parecen la misma. ¿Lo son?"
 *
 * Vive como una tira delgada arriba del calendario, no como un modal al entrar.
 * La diferencia importa: el organizador abre el dashboard para cargar un
 * resultado antes de que empiece el otro partido, y ponerle adelante una tarea
 * de limpieza de datos lo interrumpe en el peor momento. Apurado, le da que sí
 * para sacárselo de encima, y catorce partidos jugados cambian de nombre sin
 * que los haya mirado. Acá la tira espera, y él la toca cuando tiene un minuto.
 *
 * Adentro se pregunta de a una. Cada respuesta cierra ese par para siempre: el
 * "sí" porque las canchas quedan con un solo nombre y ya no hay nada que
 * comparar, el "no" porque se guarda en `venue_merge_dismissals`.
 */
export function VenueSuggestions() {
  const { suggestions, dismiss, merge, loading } = useVenueSuggestions();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Cuál de los dos nombres se conserva. null = todavía no eligió y manda el
  // preseleccionado (el más usado).
  const [keepKey, setKeepKey] = useState<string | null>(null);

  // Siempre se trabaja sobre la primera de la lista. Al responder, esa
  // sugerencia desaparece sola —el "sí" cambia los datos, el "no" queda
  // guardado— y la siguiente pasa al frente. Así no hay un índice que se
  // desincronice cuando unir dos canchas hace desaparecer un par de más abajo.
  const current = suggestions[0];

  if (loading || suggestions.length === 0) return null;

  // Preselección: el nombre que más partidos tiene. Es el que menos sorprende
  // a quien después lee el calendario.
  const suggested =
    current.a.count >= current.b.count ? current.a : current.b;
  const keep = keepKey === current.b.key ? current.b : keepKey === current.a.key ? current.a : suggested;
  const drop = keep.key === current.a.key ? current.b : current.a;

  const closeAndReset = () => {
    setOpen(false);
    setKeepKey(null);
  };

  const handleNo = async () => {
    setBusy(true);
    await dismiss(current);
    setBusy(false);
    setKeepKey(null);
    // Si era la última, se cierra solo: no queda nada que preguntar.
    if (suggestions.length <= 1) setOpen(false);
  };

  const handleYes = async () => {
    setBusy(true);
    const res = await merge(current, keep.key);
    setBusy(false);
    if (!res.ok) {
      toast.error("No pudimos unir las canchas. Probá de nuevo.");
      return;
    }
    setKeepKey(null);
    toast.success(
      `${res.changed} ${res.changed === 1 ? "partido quedó" : "partidos quedaron"} en ${res.keptLabel}`,
      {
        action: {
          label: "Deshacer",
          onClick: () => {
            void res.undo().then((ok) => {
              if (!ok) toast.error("No pudimos deshacerlo.");
            });
          },
        },
      }
    );
    if (suggestions.length <= 1) setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-left text-xs transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:hover:bg-amber-950/60"
      >
        <MapPin className="size-3.5 shrink-0 text-amber-700 dark:text-amber-500" />
        <span className="min-w-0 flex-1 text-amber-900 dark:text-amber-200">
          {suggestions.length === 1 ? (
            <>
              <span className="font-medium">{current.a.label}</span> y{" "}
              <span className="font-medium">{current.b.label}</span> parecen la
              misma cancha.
            </>
          ) : (
            <>
              <span className="font-medium">
                {suggestions.length} canchas parecidas
              </span>{" "}
              entre tus torneos.
            </>
          )}
        </span>
        <span className="shrink-0 font-medium text-amber-900 dark:text-amber-200">
          Revisar
        </span>
        <ChevronRight className="size-4 shrink-0 text-amber-700 dark:text-amber-500" />
      </button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeAndReset())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Es la misma cancha?</DialogTitle>
            <DialogDescription>
              {suggestions.length > 1
                ? `Quedan ${suggestions.length} por revisar.`
                : "Es la última."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-medium">{current.a.label}</span> y{" "}
              <span className="font-medium">{current.b.label}</span> se escriben
              parecido. Si son el mismo lugar, se quedan con un solo nombre.
            </p>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                ¿Con cuál nombre se quedan?
              </p>
              {[current.a, current.b].map((v) => (
                <label
                  key={v.key}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-md border p-2.5 transition-colors hover:bg-muted/50 ${
                    keep.key === v.key ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="cancha-que-queda"
                    className="size-4 shrink-0 accent-primary"
                    checked={keep.key === v.key}
                    onChange={() => setKeepKey(v.key)}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {v.label}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {v.count} {v.count === 1 ? "partido" : "partidos"}
                  </span>
                </label>
              ))}
            </div>

            <p className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
              Los {drop.count} {drop.count === 1 ? "partido" : "partidos"} que
              hoy dicen <span className="font-medium">{drop.label}</span> van a
              pasar a decir <span className="font-medium">{keep.label}</span>,
              jugados y por jugar. Podés deshacerlo.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={handleNo} disabled={busy}>
              No, son distintas
            </Button>
            <Button onClick={handleYes} disabled={busy}>
              {busy ? "Uniendo..." : "Sí, es la misma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
