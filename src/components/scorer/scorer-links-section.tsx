"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { Share2, Copy, MessageSquare, X, ChevronDown, ChevronUp } from "lucide-react";
import { Tournament } from "@/types";
import { supabase } from "@/lib/supabase";
import { useTournaments } from "@/context/tournament-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MAX_SCORER_LINKS_BY_TIER, TIER_LABELS } from "@/lib/pricing";
import { TournamentTier } from "@/types";

interface ScorerLinkRow {
  token: string;
  tournament_id: string;
  match_ids: string[];
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  usage_count: number;
}

interface ScorerLinksSectionProps {
  tournament: Tournament;
}

/**
 * Sección que monta el organizador en el tab Calendario:
 *   - Botón "Compartir partidos con anotador" → abre el diálogo de crear.
 *   - Lista de links activos con copiar / WhatsApp / revocar.
 *
 * Se carga directo desde la tabla `scorer_links` por RLS (la policy filtra
 * por torneo del organizer). La creación va por el endpoint server-side
 * para que valide tier-cap y calcule expires_at correctamente.
 */
export function ScorerLinksSection({ tournament }: ScorerLinksSectionProps) {
  const { getTeamById } = useTournaments();
  const [links, setLinks] = useState<ScorerLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [showActive, setShowActive] = useState(true);

  // Cap por tier — usado para deshabilitar el botón al tope.
  const tierKey = (tournament.tier as TournamentTier | null) ?? "free";
  const cap =
    MAX_SCORER_LINKS_BY_TIER[tierKey as keyof typeof MAX_SCORER_LINKS_BY_TIER];

  const activeLinks = useMemo(
    () =>
      links.filter(
        (l) =>
          !l.revoked_at && new Date(l.expires_at).getTime() > Date.now()
      ),
    [links]
  );

  const atCap = cap !== Number.POSITIVE_INFINITY && activeLinks.length >= cap;
  const capLabel = cap === Number.POSITIVE_INFINITY ? "∞" : String(cap);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("scorer_links")
      .select("*")
      .eq("tournament_id", tournament.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error loading scorer links", error);
    }
    setLinks((data ?? []) as ScorerLinkRow[]);
    setLoading(false);
  }, [tournament.id]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const handleRevoke = async (token: string) => {
    if (!confirm("¿Revocar este link? El anotador no podrá seguir cargando.")) {
      return;
    }
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      toast.error("Tu sesión expiró. Recargá la página.");
      return;
    }
    const res = await fetch(`/api/scorer/${token}/revoke`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      toast.error("No pudimos revocar el link");
      return;
    }
    toast.success("Link revocado");
    loadLinks();
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
          title={atCap ? `Tu plan ${TIER_LABELS[tierKey as TournamentTier] ?? "Free"} permite ${capLabel} links activos` : undefined}
        >
          <Share2 className="h-4 w-4 mr-2" />
          Compartir con anotador
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        {activeLinks.length} / {capLabel} links activos
        {atCap && (
          <span className="ml-2 text-amber-600">
            · Subí de plan para crear más
          </span>
        )}
      </div>

      {/* Lista de links existentes */}
      {!loading && links.length > 0 && (
        <div className="border-t pt-3 space-y-2">
          <button
            type="button"
            onClick={() => setShowActive(!showActive)}
            className="text-xs font-medium flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            {showActive ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Mis links ({links.length})
          </button>
          {showActive && (
            <div className="space-y-1.5">
              {links.map((l) => (
                <ScorerLinkRowItem
                  key={l.token}
                  link={l}
                  tournament={tournament}
                  getTeamName={(id) => getTeamById(id)?.name ?? "TBD"}
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
        onCreated={(token) => {
          setCreateOpen(false);
          setCreatedToken(token);
          loadLinks();
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
// Sub-componente: fila de un link
// ============================================================

interface ScorerLinkRowItemProps {
  link: ScorerLinkRow;
  tournament: Tournament;
  getTeamName: (id: string) => string;
  onRevoke: () => void;
}

function ScorerLinkRowItem({ link, onRevoke }: ScorerLinkRowItemProps) {
  const isRevoked = !!link.revoked_at;
  const isExpired = !isRevoked && new Date(link.expires_at).getTime() <= Date.now();
  const isActive = !isRevoked && !isExpired;

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/score/${link.token}`
      : `/score/${link.token}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("No pudimos copiar. Probá manualmente.");
    }
  };

  const sendWhatsApp = () => {
    const text = `Hola! Por favor anotá estos partidos: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const expiresLabel = new Date(link.expires_at).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-md border bg-muted/30 p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {isActive && <Badge variant="default" className="text-[10px]">Activo</Badge>}
          {isExpired && <Badge variant="secondary" className="text-[10px]">Expirado</Badge>}
          {isRevoked && <Badge variant="destructive" className="text-[10px]">Revocado</Badge>}
          <span className="text-xs text-muted-foreground">
            {link.match_ids.length} {link.match_ids.length === 1 ? "partido" : "partidos"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isActive && (
            <>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={copyLink}>
                <Copy className="h-3 w-3 mr-1" /> Copiar
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={sendWhatsApp}>
                <MessageSquare className="h-3 w-3 mr-1" /> WhatsApp
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={onRevoke}>
                <X className="h-3 w-3 mr-1" /> Revocar
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground">
        Expira: {expiresLabel} · {link.usage_count} cargas
        {link.last_used_at && (
          <> · Última actividad: {new Date(link.last_used_at).toLocaleString("es-CO", {
            day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
          })}</>
        )}
      </div>
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
  onCreated: (token: string) => void;
}

function CreateScorerLinkDialog({
  tournament,
  open,
  onOpenChange,
  onCreated,
}: CreateScorerLinkDialogProps) {
  const { getTeamById } = useTournaments();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Solo partidos que el anotador puede tocar: scheduled o postponed con
  // fecha + hora. Los unscheduled o sin fecha quedan afuera.
  const eligibleMatches = useMemo(() => {
    return tournament.matches
      .filter(
        (m) =>
          (m.status === "scheduled" || m.status === "postponed") &&
          m.date &&
          m.time
      )
      .sort((a, b) => {
        const aMs = Date.parse(`${a.date}T${a.time}:00`);
        const bMs = Date.parse(`${b.date}T${b.time}:00`);
        return aMs - bMs;
      });
  }, [tournament.matches]);

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
    return new Date(latest + 24 * 60 * 60 * 1000);
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
    try {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess.session?.access_token;
      if (!accessToken) {
        toast.error("Tu sesión expiró. Recargá la página.");
        return;
      }
      const res = await fetch("/api/scorer/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          tournamentId: tournament.id,
          matchIds: Array.from(selected),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.error === "tier-limit") {
          toast.error(
            `Llegaste al máximo de links de tu plan (${json.current}/${json.max ?? "∞"})`
          );
        } else {
          toast.error(json.error || "No pudimos crear el link");
        }
        return;
      }
      onCreated(json.token);
      setSelected(new Set());
    } catch (err) {
      console.error(err);
      toast.error("Error inesperado");
    } finally {
      setSubmitting(false);
    }
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
              No hay partidos programados con fecha y hora. Programá un
              partido desde el tab Fechas o Calendario para poder compartirlo.
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

// ============================================================
// Sub-componente: diálogo de share del link recién creado
// ============================================================

interface ShareScorerLinkDialogProps {
  token: string | null;
  onClose: () => void;
}

function ShareScorerLinkDialog({ token, onClose }: ShareScorerLinkDialogProps) {
  const open = !!token;
  const url = token && typeof window !== "undefined"
    ? `${window.location.origin}/score/${token}`
    : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("No pudimos copiar. Probá manualmente.");
    }
  };

  const sendWhatsApp = () => {
    const text = `Hola! Por favor anotá estos partidos: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>✓ Link creado</DialogTitle>
          <DialogDescription>
            Compartilo con el anotador. Va a poder cargar los resultados sin
            tener que iniciar sesión.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted p-3 text-xs font-mono break-all">
          {url}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={copyLink}>
            <Copy className="h-4 w-4 mr-2" /> Copiar link
          </Button>
          <Button onClick={sendWhatsApp}>
            <MessageSquare className="h-4 w-4 mr-2" /> WhatsApp
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
