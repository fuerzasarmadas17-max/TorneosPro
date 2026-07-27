"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  Plus,
  X,
  Copy,
  MessageSquare,
  Trash2,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tournament } from "@/types";
import { useTournaments } from "@/context/tournament-context";
import {
  useScorerLinks,
  scorerLinkTournamentIds,
  ScorerLinkRow,
} from "@/hooks/use-scorer-links";
import {
  copyScorerLink,
  shareScorerLinkOnWhatsApp,
} from "@/components/scorer/scorer-link-share";
import { MatchInfo, MatchSummary } from "@/components/dashboard/scorer-match-summary";
import { ScorerLinksDialog } from "@/components/dashboard/scorer-links-dialog";
import { buildTournamentColorMap } from "@/lib/tournament-colors";

/**
 * Panel de anotadores que vive **en la agenda**, debajo del calendario.
 *
 * Separa estado de acción: acá se ve y se edita lo ya repartido; el botón
 * "Generar links" del header abre un diálogo que solo crea. Antes las dos
 * cosas vivían dentro del mismo modal y se leía confuso.
 *
 * Es dueño del `useScorerLinks` y se lo presta al diálogo: con dos instancias
 * del hook, crear un link desde el modal dejaría esta lista desactualizada.
 */
export function ScorerLinksPanel({
  tournaments,
  createOpen,
  onCreateOpenChange,
}: {
  tournaments: Tournament[];
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}) {
  const { tournaments: allTournaments, getTeamById } = useTournaments();
  const {
    activeLinks,
    linkedMatchIds,
    createLink,
    updateLinkMatches,
    revokeLink,
    capLabel,
    atCap,
    bestTierLabel,
  } = useScorerLinks();

  const [expanded, setExpanded] = useState(false);

  const colorMap = useMemo(
    () => buildTournamentColorMap(tournaments.map((t) => t.id)),
    [tournaments]
  );

  // Índice de TODOS los partidos visibles (no solo los de torneos en curso):
  // un link viejo puede tocar un torneo ya terminado y igual hay que poder
  // mostrar sus partidos al desplegarlo.
  const matchInfoById = useMemo(() => {
    const map = new Map<string, MatchInfo>();
    for (const t of allTournaments) {
      for (const m of t.matches) {
        if (!m.date || !m.time) continue;
        map.set(m.id, {
          matchId: m.id,
          tournamentId: t.id,
          tournamentName: t.name,
          color: colorMap.get(t.id) ?? "#94a3b8",
          date: m.date,
          time: m.time,
          venue: m.venue,
          homeName: (m.homeTeamId && getTeamById(m.homeTeamId)?.name) || "Por definir",
          awayName: (m.awayTeamId && getTeamById(m.awayTeamId)?.name) || "Por definir",
          isCompleted: m.status === "completed",
        });
      }
    }
    return map;
  }, [allTournaments, colorMap, getTeamById]);

  // Disponibles para repartir: de los torneos en curso, programados o
  // aplazados, con fecha y hora, y sin anotador asignado.
  const availableMatches = useMemo(() => {
    const out: MatchInfo[] = [];
    for (const t of tournaments) {
      for (const m of t.matches) {
        if (m.status !== "scheduled" && m.status !== "postponed") continue;
        if (!m.date || !m.time) continue;
        if (linkedMatchIds.has(m.id)) continue;
        const info = matchInfoById.get(m.id);
        if (info) out.push(info);
      }
    }
    out.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    return out;
  }, [tournaments, linkedMatchIds, matchInfoById]);

  const handleRevoke = async (token: string) => {
    if (!confirm("¿Revocar este link? El anotador no podrá seguir cargando, y sus partidos vuelven a estar disponibles.")) {
      return;
    }
    const ok = await revokeLink(token);
    toast[ok ? "success" : "error"](
      ok ? "Link revocado" : "No pudimos revocar el link"
    );
  };

  return (
    <>
      {/* Sin links activos no mostramos nada: un panel que dice "0" es ruido.
          El camino para crear el primero es el botón del header. */}
      {activeLinks.length > 0 && (
        <div className="rounded-lg border bg-card">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 rounded-lg"
            aria-expanded={expanded}
          >
            <Share2 className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 text-xs">
              <span className="font-medium">Anotadores</span>
              <span className="text-muted-foreground">
                {" · "}
                {activeLinks.length}{" "}
                {activeLinks.length === 1 ? "link activo" : "links activos"}
              </span>
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {activeLinks.length}/{capLabel}
            </span>
            <ChevronDown
              className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>

          {expanded && (
            <div className="border-t p-3 space-y-1.5">
              {atCap && (
                <p className="text-[11px] text-amber-600 pb-0.5">
                  Tu plan {bestTierLabel} llegó al tope de {capLabel} links.
                  Revocá uno para poder crear otro.
                </p>
              )}
              {activeLinks.map((l) => (
                <ActiveLinkRow
                  key={l.token}
                  link={l}
                  matchInfoById={matchInfoById}
                  availableMatches={availableMatches}
                  onUpdate={(ids) => updateLinkMatches(l.token, ids)}
                  onRevoke={() => handleRevoke(l.token)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <ScorerLinksDialog
        open={createOpen}
        onOpenChange={onCreateOpenChange}
        availableMatches={availableMatches}
        createLink={createLink}
        activeCount={activeLinks.length}
        capLabel={capLabel}
        atCap={atCap}
        bestTierLabel={bestTierLabel}
      />
    </>
  );
}

// ============================================================
// Fila desplegable de un link activo
// ============================================================

function ActiveLinkRow({
  link,
  matchInfoById,
  availableMatches,
  onUpdate,
  onRevoke,
}: {
  link: ScorerLinkRow;
  matchInfoById: Map<string, MatchInfo>;
  /** Partidos sin anotador — los candidatos a sumar a este link. */
  availableMatches: MatchInfo[];
  onUpdate: (matchIds: string[]) => Promise<{ ok: boolean; error?: string }>;
  onRevoke: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const matches = useMemo(
    () =>
      link.match_ids
        .map((id) => matchInfoById.get(id))
        .filter((m): m is MatchInfo => !!m)
        .sort((a, b) =>
          `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
        ),
    [link.match_ids, matchInfoById]
  );

  const tournamentCount = scorerLinkTournamentIds(link).length;
  const expiresLabel = new Date(link.expires_at).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const mutate = async (matchIds: string[]) => {
    setBusy(true);
    const res = await onUpdate(matchIds);
    setBusy(false);
    if (!res.ok) toast.error(res.error ?? "No pudimos actualizar el link");
  };

  const removeMatch = (id: string) => {
    if (link.match_ids.length <= 1) {
      toast.error(
        "Un link necesita al menos un partido. Revocalo si ya no lo usás."
      );
      return;
    }
    mutate(link.match_ids.filter((m) => m !== id));
  };

  return (
    <div className="rounded-md border bg-muted/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 p-2.5 text-left hover:bg-muted/50 transition-colors"
        aria-expanded={expanded}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium truncate">
            {link.match_ids.length}{" "}
            {link.match_ids.length === 1 ? "partido" : "partidos"}
            {tournamentCount > 1 && ` · ${tournamentCount} torneos`}
          </span>
          <span className="block text-[11px] text-muted-foreground truncate">
            Expira {expiresLabel} · {link.usage_count} cargas
          </span>
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="border-t p-2.5 space-y-2.5">
          {/* Partidos del link */}
          <div className="space-y-1">
            {matches.map((m) => (
              <div
                key={m.matchId}
                className="flex items-center gap-2 rounded border bg-background p-2"
              >
                <span
                  className="w-1 self-stretch shrink-0 rounded-full"
                  style={{ backgroundColor: m.color }}
                  aria-hidden
                />
                <MatchSummary match={m} />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={busy}
                  onClick={() => removeMatch(m.matchId)}
                  aria-label="Quitar del link"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
            {matches.length < link.match_ids.length && (
              <p className="text-[11px] text-muted-foreground px-1">
                {link.match_ids.length - matches.length} partido(s) de un torneo
                que ya no ves.
              </p>
            )}
          </div>

          {/* Sumar partidos */}
          {adding ? (
            <div className="space-y-1 rounded border bg-background p-2">
              <div className="flex items-center justify-between gap-2 pb-1">
                <span className="text-[11px] font-medium">
                  Agregar un partido
                </span>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Listo
                </button>
              </div>
              {availableMatches.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-1">
                  No quedan partidos sin anotador.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {availableMatches.map((m) => (
                    <button
                      key={m.matchId}
                      type="button"
                      disabled={busy}
                      onClick={() => mutate([...link.match_ids, m.matchId])}
                      className="flex w-full items-center gap-2 rounded border p-2 text-left hover:bg-muted/50 transition-colors disabled:opacity-50"
                    >
                      <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                      <MatchSummary match={m} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-full text-xs"
              disabled={busy}
              onClick={() => setAdding(true)}
            >
              <Plus className="size-3.5 mr-1" />
              Agregar partido
            </Button>
          )}

          {/* Acciones del link */}
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => copyScorerLink(link.token)}
            >
              <Copy className="size-3 mr-1" /> Copiar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => shareScorerLinkOnWhatsApp(link.token)}
            >
              <MessageSquare className="size-3 mr-1" /> WhatsApp
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-destructive ml-auto"
              disabled={busy}
              onClick={onRevoke}
            >
              <Trash2 className="size-3 mr-1" /> Revocar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
