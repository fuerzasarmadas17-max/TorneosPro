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
import {
  ALL_VENUES,
  NO_VENUE,
  collectVenues,
  isInVenue,
} from "@/lib/venues";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Valor del desplegable de día para "todos los días". */
const ALL_DAYS = "__todos__";

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
  // Día y cancha: es como se reparte de verdad ("lo del sábado en la 2 se lo
  // mando a Pedro"). Filtrar no desmarca nada, así se puede armar un link
  // juntando dos canchas si hace falta.
  const [dayFilter, setDayFilter] = useState<string>(ALL_DAYS);
  const [venueFilter, setVenueFilter] = useState<string>(ALL_VENUES);

  const days = useMemo(
    () => Array.from(new Set(availableMatches.map((m) => m.date))).sort(),
    [availableMatches]
  );
  const venues = useMemo(() => collectVenues(availableMatches), [availableMatches]);
  const someWithoutVenue = useMemo(
    () => availableMatches.some((m) => !m.venue),
    [availableMatches]
  );

  const filteredMatches = useMemo(
    () =>
      availableMatches.filter(
        (m) =>
          (dayFilter === ALL_DAYS || m.date === dayFilter) &&
          isInVenue(m.venue, venueFilter)
      ),
    [availableMatches, dayFilter, venueFilter]
  );

  // Marcados que el filtro de ahora esconde. Se avisa, porque el botón dice
  // "Generar link (5)" y en pantalla podrían verse solo dos.
  const hiddenSelectedCount = useMemo(() => {
    const visible = new Set(filteredMatches.map((m) => m.matchId));
    let n = 0;
    for (const id of selected) if (!visible.has(id)) n++;
    return n;
  }, [selected, filteredMatches]);

  // Agrupados por día: es como el organizador piensa el reparto ("lo del
  // sábado se lo mando a Pedro").
  const groupedByDate = useMemo(() => {
    const map = new Map<string, MatchInfo[]>();
    for (const m of filteredMatches) {
      const arr = map.get(m.date) ?? [];
      arr.push(m);
      map.set(m.date, arr);
    }
    return Array.from(map.entries());
  }, [filteredMatches]);

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
      // Hora de Colombia, igual que el servidor en validate-link-matches.
      const ms = Date.parse(`${m.date}T${m.time}:00-05:00`);
      if (ms > latest) latest = ms;
    }
    if (latest === 0) return null;
    return new Date(Math.max(latest, Date.now()) + 72 * 60 * 60 * 1000);
  }, [selected, availableMatches]);

  const handleClose = (o: boolean) => {
    if (!o) {
      setSelected(new Set());
      setDayFilter(ALL_DAYS);
      setVenueFilter(ALL_VENUES);
    }
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

          {/* Filtros. Cada uno aparece solo si hay algo que filtrar. */}
          {(days.length > 1 || venues.length > 1) && (
            <div className="flex gap-2 px-4 pb-2 shrink-0 sm:px-6">
              {days.length > 1 && (
                <Select value={dayFilter} onValueChange={setDayFilter}>
                  <SelectTrigger className="h-8 flex-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_DAYS}>Todos los días</SelectItem>
                    {days.map((d) => (
                      <SelectItem key={d} value={d}>
                        {formatDayLabel(parseISO(d))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {venues.length > 1 && (
                <Select value={venueFilter} onValueChange={setVenueFilter}>
                  <SelectTrigger className="h-8 flex-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VENUES}>Todas las canchas</SelectItem>
                    {venues.map((v) => (
                      <SelectItem key={v.key} value={v.key}>
                        {v.label}
                      </SelectItem>
                    ))}
                    {someWithoutVenue && (
                      <SelectItem value={NO_VENUE}>Sin cancha asignada</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-4 sm:px-6">
            {groupedByDate.length === 0 ? (
              availableMatches.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No hay partidos disponibles. Programá partidos con fecha y hora,
                  o revocá un link para liberar los suyos.
                </p>
              ) : (
                <div className="py-8 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Ningún partido disponible con este filtro.
                  </p>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => {
                      setDayFilter(ALL_DAYS);
                      setVenueFilter(ALL_VENUES);
                    }}
                  >
                    Ver los {availableMatches.length} disponibles
                  </button>
                </div>
              )
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
                {hiddenSelectedCount > 0 && (
                  <span className="text-amber-600">
                    {" · "}
                    {hiddenSelectedCount} que el filtro no muestra
                  </span>
                )}
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
