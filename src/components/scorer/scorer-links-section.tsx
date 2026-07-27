"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Share2, ChevronDown, ChevronUp } from "lucide-react";
import { Tournament } from "@/types";
import { useTournaments } from "@/context/tournament-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useScorerLinks,
  scorerLinkTournamentIds,
  CreateLinkResult,
  ScorerLinkRow,
} from "@/hooks/use-scorer-links";
import {
  ShareScorerLinkDialog,
  ScorerLinkRowItem,
} from "@/components/scorer/scorer-link-share";

interface ScorerLinksSectionProps {
  tournament: Tournament;
}

/**
 * Sección que monta el organizador en el tab Calendario:
 *   - Botón "Compartir partidos con anotador" → abre el diálogo de crear.
 *   - Lista de links activos con copiar / WhatsApp / revocar.
 *
 * Alcance: muestra los links que tocan ESTE torneo (un link puede cruzar
 * varios; para armar esos está el botón "Generar links" del dashboard). El
 * cupo, en cambio, es global de la cuenta.
 */
export function ScorerLinksSection({ tournament }: ScorerLinksSectionProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  // Historial = expirados y revocados. Lo escondemos por default porque
  // una vez que un link cumple su propósito (los partidos se cargaron, el
  // link expira) queda como ruido visual permanente. Toggle opt-in para
  // los casos de auditoría.
  const [showHistory, setShowHistory] = useState(false);

  const {
    activeLinks,
    historicalLinks,
    linkedMatchIds,
    loading,
    createLink,
    revokeLink,
    capLabel,
    atCap,
    bestTierLabel,
  } = useScorerLinks();

  const coversThisTournament = useMemo(
    () => (ids: string[]) => ids.includes(tournament.id),
    [tournament.id]
  );

  const tournamentActiveLinks = useMemo(
    () =>
      activeLinks.filter((l) =>
        coversThisTournament(scorerLinkTournamentIds(l))
      ),
    [activeLinks, coversThisTournament]
  );
  const tournamentHistoricalLinks = useMemo(
    () =>
      historicalLinks.filter((l) =>
        coversThisTournament(scorerLinkTournamentIds(l))
      ),
    [historicalLinks, coversThisTournament]
  );

  const handleRevoke = async (token: string) => {
    if (!confirm("¿Revocar este link? El anotador no podrá seguir cargando, y sus partidos vuelven a estar disponibles.")) {
      return;
    }
    const ok = await revokeLink(token);
    toast[ok ? "success" : "error"](
      ok ? "Link revocado" : "No pudimos revocar el link"
    );
  };

  /** Aclara que el link también cubre partidos de otros torneos. */
  const describeLink = (link: ScorerLinkRow) => {
    const others = scorerLinkTournamentIds(link).filter(
      (id) => id !== tournament.id
    ).length;
    if (others === 0) return undefined;
    return others === 1
      ? "También cubre partidos de otro torneo"
      : `También cubre partidos de otros ${others} torneos`;
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Anotadores externos
          </h3>
          <p className="text-xs text-muted-foreground">
            Compartí los partidos con un árbitro vía WhatsApp para que cargue
            los resultados sin necesidad de cuenta.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          disabled={atCap}
          title={atCap ? `Tu plan ${bestTierLabel} permite ${capLabel} links activos en total` : undefined}
        >
          <Share2 className="h-4 w-4 mr-2" />
          Compartir con anotador
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        {tournamentActiveLinks.length} activos en este torneo · {activeLinks.length}/
        {capLabel} en tu cuenta
        {atCap && (
          <span className="ml-2 text-amber-600">
            · Subí de plan o revocá uno para crear más
          </span>
        )}
      </div>

      {/* Lista de links activos. Si no hay activos pero sí historial, se
          esconde toda la lista y solo se muestra el toggle de historial al
          final. */}
      {!loading && tournamentActiveLinks.length > 0 && (
        <div className="border-t pt-3 space-y-1.5">
          {tournamentActiveLinks.map((l) => (
            <ScorerLinkRowItem
              key={l.token}
              link={l}
              subtitle={describeLink(l)}
              onRevoke={() => handleRevoke(l.token)}
            />
          ))}
        </div>
      )}

      {/* Historial colapsado. Solo aparece el toggle si hay algo viejo. */}
      {!loading && tournamentHistoricalLinks.length > 0 && (
        <div className={tournamentActiveLinks.length > 0 ? "pt-1" : "border-t pt-3"}>
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs font-medium flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showHistory ? "Ocultar historial" : "Ver historial"} ({tournamentHistoricalLinks.length})
          </button>
          {showHistory && (
            <div className="space-y-1.5 mt-2">
              {tournamentHistoricalLinks.map((l) => (
                <ScorerLinkRowItem
                  key={l.token}
                  link={l}
                  subtitle={describeLink(l)}
                  onRevoke={() => handleRevoke(l.token)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <CreateScorerLinkDialog
        tournament={tournament}
        open={createOpen}
        onOpenChange={setCreateOpen}
        linkedMatchIds={linkedMatchIds}
        createLink={createLink}
        onCreated={(token) => {
          setCreateOpen(false);
          setCreatedToken(token);
        }}
      />

      <ShareScorerLinkDialog
        token={createdToken}
        onClose={() => setCreatedToken(null)}
      />
    </div>
  );
}

// ============================================================
// Sub-componente: diálogo de crear link
// ============================================================

interface CreateScorerLinkDialogProps {
  tournament: Tournament;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Partidos ya cubiertos por un link vigente — se esconden de la lista. */
  linkedMatchIds: Set<string>;
  /** Viene del hook del padre: usar otra instancia dejaría al padre con la
   *  lista y el cupo desactualizados después de crear. */
  createLink: (matchIds: string[]) => Promise<CreateLinkResult>;
  onCreated: (token: string) => void;
}

function CreateScorerLinkDialog({
  tournament,
  open,
  onOpenChange,
  linkedMatchIds,
  createLink,
  onCreated,
}: CreateScorerLinkDialogProps) {
  const { getTeamById } = useTournaments();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Solo partidos que el anotador puede tocar: scheduled o postponed con
  // fecha + hora, y que no estén ya repartidos a otro anotador.
  const eligibleMatches = useMemo(() => {
    return tournament.matches
      .filter(
        (m) =>
          (m.status === "scheduled" || m.status === "postponed") &&
          m.date &&
          m.time &&
          !linkedMatchIds.has(m.id)
      )
      .sort((a, b) => {
        const aMs = Date.parse(`${a.date}T${a.time}:00`);
        const bMs = Date.parse(`${b.date}T${b.time}:00`);
        return aMs - bMs;
      });
  }, [tournament.matches, linkedMatchIds]);

  // Calcular expires_at preview para los partidos seleccionados.
  const expiresPreview = useMemo(() => {
    if (selected.size === 0) return null;
    let latest = 0;
    for (const id of selected) {
      const m = tournament.matches.find((x) => x.id === id);
      if (!m?.date || !m?.time) continue;
      const ms = Date.parse(`${m.date}T${m.time}:00`);
      if (ms > latest) latest = ms;
    }
    if (latest === 0) return null;
    return new Date(Math.max(latest, Date.now()) + 24 * 60 * 60 * 1000);
  }, [selected, tournament.matches]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (selected.size === 0) {
      toast.error("Seleccioná al menos un partido");
      return;
    }
    setSubmitting(true);
    const result = await createLink(Array.from(selected));
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
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
    onCreated(result.token);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden !flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Compartir partidos con anotador</DialogTitle>
          <DialogDescription>
            Seleccioná los partidos que va a anotar. Se genera un link que
            podés enviar por WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-2 space-y-2">
          {eligibleMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No hay partidos disponibles. Programá un partido con fecha y hora
              desde el tab Fechas o Calendario, o revocá un link existente para
              liberar los suyos.
            </p>
          ) : (
            eligibleMatches.map((m) => {
              const home = m.homeTeamId ? getTeamById(m.homeTeamId) : null;
              const away = m.awayTeamId ? getTeamById(m.awayTeamId) : null;
              const checked = selected.has(m.id);
              return (
                <label
                  key={m.id}
                  className={`flex items-center gap-3 rounded-md border p-2.5 cursor-pointer hover:bg-muted/50 transition-colors ${checked ? "border-primary bg-primary/5" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-primary"
                    checked={checked}
                    onChange={() => toggle(m.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {home?.name || "TBD"}{" "}
                      <span className="text-muted-foreground font-normal">vs</span>{" "}
                      {away?.name || "TBD"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {m.date} · {m.time}
                      {m.venue ? ` · ${m.venue}` : ""}
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>

        {expiresPreview && (
          <div className="px-6 py-2 text-xs text-muted-foreground border-t bg-muted/30">
            El link expirará el{" "}
            <span className="font-medium text-foreground">
              {expiresPreview.toLocaleString("es-CO", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>{" "}
            (24h después del último partido)
          </div>
        )}

        <DialogFooter className="gap-2 px-6 py-4 border-t shrink-0 bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={submitting || selected.size === 0}
          >
            {submitting ? "Generando..." : `Generar link (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
