"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreateLinkResult } from "@/hooks/use-scorer-links";
import { ShareScorerLinkDialog } from "@/components/scorer/scorer-link-share";
import { MatchInfo, MatchSummary } from "@/components/dashboard/scorer-match-summary";
import { parseISO, formatDayLabel } from "@/lib/agenda-dates";

/**
 * Diálogo de **crear** un link de anotador, cruzando torneos si hace falta.
 *
 * Solo crea: los links que ya existen se ven y se editan en el panel de la
 * agenda (`ScorerLinksPanel`). Mezclar las dos cosas acá adentro se leía
 * confuso — el botón promete crear y aparecía la administración.
 *
 * No usa `useScorerLinks` directamente: el panel es el dueño del hook y le
 * pasa lo que necesita, para que crear un link refresque su lista.
 */
export function ScorerLinksDialog({
  open,
  onOpenChange,
  availableMatches,
  createLink,
  activeCount,
  capLabel,
  atCap,
  bestTierLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Partidos sin anotador asignado, ya ordenados por fecha y hora. */
  availableMatches: MatchInfo[];
  createLink: (matchIds: string[]) => Promise<CreateLinkResult>;
  activeCount: number;
  capLabel: string;
  atCap: boolean;
  bestTierLabel: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  // Agrupados por día: es como el organizador piensa el reparto ("lo del
  // sábado se lo mando a Pedro").
  const groupedByDate = useMemo(() => {
    const map = new Map<string, MatchInfo[]>();
    for (const m of availableMatches) {
      const arr = map.get(m.date) ?? [];
      arr.push(m);
      map.set(m.date, arr);
    }
    return Array.from(map.entries());
  }, [availableMatches]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDay = (matches: MatchInfo[]) => {
    const allSelected = matches.every((m) => selected.has(m.matchId));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const m of matches) {
        if (allSelected) next.delete(m.matchId);
        else next.add(m.matchId);
      }
      return next;
    });
  };

  // Cuántos torneos toca la selección — lo mostramos para que quede explícito
  // que un mismo link puede cruzarlos.
  const selectedTournamentCount = useMemo(() => {
    const set = new Set<string>();
    for (const m of availableMatches) {
      if (selected.has(m.matchId)) set.add(m.tournamentId);
    }
    return set.size;
  }, [selected, availableMatches]);

  const expiresPreview = useMemo(() => {
    let latest = 0;
    for (const m of availableMatches) {
      if (!selected.has(m.matchId)) continue;
      const ms = Date.parse(`${m.date}T${m.time}:00`);
      if (ms > latest) latest = ms;
    }
    if (latest === 0) return null;
    return new Date(Math.max(latest, Date.now()) + 24 * 60 * 60 * 1000);
  }, [selected, availableMatches]);

  const handleClose = (o: boolean) => {
    if (!o) setSelected(new Set());
    onOpenChange(o);
  };

  const handleCreate = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    const result = await createLink(Array.from(selected));
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      // Si el choque fue por partidos ya repartidos, los sacamos de la
      // selección: `createLink` ya recargó y desaparecieron de la lista, así
      // que dejarlos marcados sería un estado fantasma.
      if (result.takenMatchIds?.length) {
        setSelected((prev) => {
          const next = new Set(prev);
          for (const id of result.takenMatchIds!) next.delete(id);
          return next;
        });
      }
      return;
    }
    setSelected(new Set());
    setCreatedToken(result.token);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden !flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 pt-5 pb-3 shrink-0 sm:px-6 sm:pt-6">
            <DialogTitle>Generar link para anotador</DialogTitle>
            <DialogDescription>
              Elegí los partidos que va a anotar. Podés mezclar torneos en un
              mismo link.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-4 sm:px-6">
            {groupedByDate.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No hay partidos disponibles. Programá partidos con fecha y hora,
                o revocá un link para liberar los suyos.
              </p>
            ) : (
              groupedByDate.map(([date, matches]) => {
                const allSelected = matches.every((m) => selected.has(m.matchId));
                return (
                  <div key={date} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">
                        {formatDayLabel(parseISO(date))}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleDay(matches)}
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        {allSelected ? "Ninguno" : "Todos"}
                      </button>
                    </div>
                    {matches.map((m) => {
                      const checked = selected.has(m.matchId);
                      return (
                        <label
                          key={m.matchId}
                          className={`flex items-center gap-2.5 rounded-md border p-2.5 cursor-pointer hover:bg-muted/50 transition-colors ${checked ? "border-primary bg-primary/5" : ""}`}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 shrink-0 accent-primary"
                            checked={checked}
                            onChange={() => toggle(m.matchId)}
                          />
                          <span
                            className="w-1 self-stretch shrink-0 rounded-full"
                            style={{ backgroundColor: m.color }}
                            aria-hidden
                          />
                          <MatchSummary match={m} />
                        </label>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          <div className="px-4 py-2 text-[11px] text-muted-foreground border-t bg-muted/30 shrink-0 sm:px-6">
            {selected.size > 0 ? (
              <>
                {selected.size} {selected.size === 1 ? "partido" : "partidos"}
                {selectedTournamentCount > 1 && ` de ${selectedTournamentCount} torneos`}
                {expiresPreview && (
                  <>
                    {" · "}expira el{" "}
                    <span className="font-medium text-foreground">
                      {expiresPreview.toLocaleString("es-CO", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </>
                )}
              </>
            ) : (
              <>
                {activeCount}/{capLabel} links activos
                {atCap && (
                  <span className="ml-1 text-amber-600">
                    · plan {bestTierLabel} al tope, revocá uno para crear otro
                  </span>
                )}
              </>
            )}
          </div>

          <DialogFooter className="gap-2 px-4 py-3 border-t shrink-0 bg-background sm:px-6 sm:py-4">
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={submitting || selected.size === 0 || atCap}
              title={atCap ? `Tu plan ${bestTierLabel} permite ${capLabel} links activos` : undefined}
            >
              <Link2 className="h-4 w-4 mr-2" />
              {submitting ? "Generando..." : `Generar link (${selected.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Al cerrar el modal de compartir se cierra también el de generar: el
          trabajo terminó, y dejar el de atrás abierto obliga a un segundo
          click para volver al dashboard. */}
      <ShareScorerLinkDialog
        token={createdToken}
        onClose={() => {
          setCreatedToken(null);
          handleClose(false);
        }}
      />
    </>
  );
}
