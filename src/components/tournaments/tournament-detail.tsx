"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BracketView } from "@/components/brackets/bracket-view";
import { PlayoffBracketView } from "@/components/brackets/playoff-bracket-view";
import { StandingsTable } from "@/components/standings/standings-table";
import { BaseballStandingsTable } from "@/components/standings/baseball-standings-table";
import { BasketballStandingsTable } from "@/components/standings/basketball-standings-table";
import { VolleyballStandingsTable } from "@/components/standings/volleyball-standings-table";
import { GroupStageView } from "@/components/standings/group-stage-view";
import { PhaseConfigDialog } from "@/components/tournaments/phase-config-dialog";
import { PhaseCompletionModal } from "@/components/tournaments/phase-completion-modal";
import { TournamentChampionModal } from "@/components/tournaments/tournament-champion-modal";
import { TournamentChampionViewerModal } from "@/components/tournaments/tournament-champion-viewer-modal";
import { PlayoffFinalConfigDialog } from "@/components/tournaments/playoff-final-config-dialog";
import { MatchSchedule } from "@/components/standings/match-schedule";
import { ScorerLinksSection } from "@/components/scorer/scorer-links-section";
import { DateOrganizer } from "@/components/standings/date-organizer";
import { TournamentStats } from "@/components/standings/tournament-stats";
import { TeamRosterDialog } from "@/components/tournaments/team-roster-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTournaments } from "@/context/tournament-context";
import { useAuth } from "@/context/auth-context";
import { AdminActions } from "@/components/tournaments/admin-actions";
import { getSportInfo } from "@/data/sports";
import { getDepartmentLabel, getMunicipalityLabel } from "@/data/colombia";
import { getSportCategory, Tournament, Sponsor, Match } from "@/types";
import { supabase } from "@/lib/supabase";
import { SponsorBanner } from "@/components/sponsors/sponsor-banner";
import { SponsorForm } from "@/components/sponsors/sponsor-form";
import { SponsorPicker } from "@/components/sponsors/sponsor-picker";
import { ensureLibrarySponsor } from "@/lib/db/sponsors";
import { TeamMark } from "@/components/teams/team-mark";
import { AddTeamsDialog } from "@/components/tournaments/add-teams-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Settings, MoreVertical, Trash2, Ban, ChevronLeft, ChevronRight, CheckCircle2, Trophy, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
// xlsx pesa ~700KB y solo se usa cuando el organizador descarga la
// plantilla de jugadores. Dynamic import dentro del handler para que
// no se incluya en el bundle inicial que descarga TODO visitante del
// detalle del torneo.

const statusLabels: Record<string, string> = {
  upcoming: "Próximo",
  "in-progress": "En Curso",
  completed: "Completado",
};

const statusColors: Record<string, string> = {
  upcoming: "bg-blue-500/10 text-blue-500",
  "in-progress": "bg-green-500/10 text-green-500",
  completed: "bg-zinc-500/10 text-zinc-500",
};

const formatLabels: Record<string, string> = {
  elimination: "Eliminacion Directa",
  "round-robin": "Liga",
  "group-playoff": "Fase de Grupos + Playoffs",
};

const OPTIONAL_COLUMNS = [
  { key: "fechaNacimiento", label: "Fecha de nacimiento", width: 18 },
  { key: "documento", label: "Número de documento", width: 22 },
  { key: "residencia", label: "Lugar de residencia", width: 22 },
  { key: "eps", label: "EPS", width: 15 },
] as const;

function TemplateDownloadDialog() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDownload = async () => {
    // Dynamic import: la librería de Excel solo se descarga cuando el
    // organizer clickea "Descargar plantilla". Cero peso en el bundle
    // inicial para visitantes públicos que nunca usan esta función.
    // Usamos `xlsx-js-style` (fork de SheetJS) porque el `xlsx` base no
    // escribe estilos de fuente y necesitamos agrandar los títulos.
    const XLSX = await import("xlsx-js-style");
    const wb = XLSX.utils.book_new();
    // Una sola columna "Nombre Completo" en lugar del split antiguo en
    // "Nombre / Apellido 1 / Apellido 2". El organizador escribe el
    // nombre tal como aparece en la planilla y el import lo guarda en
    // `players.name` sin transformación.
    const baseHeaders = ["Nombre Completo"];
    const extras = OPTIONAL_COLUMNS.filter((c) => selected.has(c.key));
    const allHeaders = [...baseHeaders, ...extras.map((c) => c.label)];

    // Fila de ejemplo (fila 3 visualmente). Sirve de referencia para
    // que el organizador vea el formato esperado — sobre todo la fecha
    // de nacimiento en ISO YYYY-MM-DD (10 caracteres). El organizador
    // la borra o la reemplaza por el primer jugador real.
    const exampleValues: Record<string, string> = {
      "Nombre Completo": "Juan Pérez García",
      "Fecha de nacimiento": "1995-06-15",
      "Número de documento": "1234567890",
      "Lugar de residencia": "Sincelejo",
      EPS: "Nueva EPS",
    };
    const exampleRow = allHeaders.map((h) => exampleValues[h] || "");

    const emptyRows = Array.from({ length: 19 }, () =>
      Array(allHeaders.length).fill("")
    );
    // La primera fila con "Nombre del equipo" se eliminó: no se usaba y
    // confundía. Los títulos de columna quedan ahora en la fila 1.
    // (El importador sigue detectando y saltando esa fila en planillas
    // viejas ya repartidas — ver team-roster-dialog.tsx.)
    const sheetData: (string | undefined)[][] = [
      allHeaders,
      exampleRow,
      ...emptyRows,
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Títulos de columna (fila 0) con letra más grande y en negrita para
    // que los couches identifiquen de un vistazo la fila de encabezados.
    for (let c = 0; c < allHeaders.length; c++) {
      const ref = XLSX.utils.encode_cell({ c, r: 0 });
      if (ws[ref]) {
        ws[ref].s = {
          font: { sz: 14, bold: true },
          alignment: { vertical: "center" },
        };
      }
    }
    ws["!cols"] = allHeaders.map((h, i) => ({
      // Primera columna (nombre) más ancha porque va el nombre completo.
      // Fecha de nacimiento: 14 para que entren cómodos los 10 chars ISO.
      wch:
        i === 0
          ? 32
          : h === "Fecha de nacimiento"
            ? 14
            : extras.find((c) => c.label === h)?.width || 15,
    }));

    // Aplica formato yyyy-mm-dd a las 20 filas de la columna de fecha
    // de nacimiento. Si el organizador escribe la fecha como número o
    // la pega de otra hoja, Excel respeta el formato visual de 10
    // caracteres. La celda ejemplo ya viene con el string ISO.
    const dobIdx = allHeaders.indexOf("Fecha de nacimiento");
    if (dobIdx >= 0) {
      // Fila 0 = títulos, fila 1 = ejemplo, filas 2..20 = vacías.
      for (let r = 1; r <= 20; r++) {
        const ref = XLSX.utils.encode_cell({ c: dobIdx, r });
        if (ws[ref]) {
          ws[ref].z = "yyyy-mm-dd";
        } else {
          ws[ref] = { t: "s", v: "", z: "yyyy-mm-dd" };
        }
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, "Jugadores");

    XLSX.writeFile(wb, "Plantilla_Jugadores.xlsx");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Descargar plantilla Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar plantilla</DialogTitle>
          <DialogDescription>
            Elige los campos adicionales para la plantilla de jugadores.
            Envia la misma plantilla a cada equipo para que la llenen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Campos incluidos siempre:</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Nombre Completo</Badge>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Campos opcionales:</p>
            <div className="flex flex-wrap gap-2">
              {OPTIONAL_COLUMNS.map((col) => (
                <Button
                  key={col.key}
                  variant={selected.has(col.key) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggle(col.key)}
                >
                  {col.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleDownload}>
            Descargar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TeamsRosterSection({
  teamIds,
  canEdit,
  tournament,
}: {
  teamIds: string[];
  canEdit: boolean;
  tournament?: Tournament;
}) {
  const { getTeamById, removeTeamFromTournament, disqualifyTeam } = useTournaments();
  const [confirmAction, setConfirmAction] = useState<{ type: "delete" | "disqualify"; teamId: string; teamName: string } | null>(null);

  const isDisqualified = (teamId: string) =>
    tournament?.disqualifiedTeamIds?.includes(teamId) ?? false;

  const handleConfirm = async () => {
    if (!confirmAction || !tournament) return;
    if (confirmAction.type === "delete") {
      await removeTeamFromTournament(tournament.id, confirmAction.teamId);
      toast.success(`${confirmAction.teamName} eliminado del torneo`);
    } else {
      await disqualifyTeam(tournament.id, confirmAction.teamId);
      toast.success(`${confirmAction.teamName} descalificado`);
    }
    setConfirmAction(null);
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end gap-2">
          {tournament && (
            <AddTeamsDialog tournament={tournament} />
          )}
          <TemplateDownloadDialog />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teamIds.map((teamId) => {
          const team = getTeamById(teamId);
          if (!team) return null;
          const dq = isDisqualified(teamId);
          return (
            <Card key={teamId} className={dq ? "opacity-60 border-destructive/30" : ""}>
              <CardHeader className="pb-3">
                {/* min-w-0 + break-words: los nombres largos de una sola palabra
                    (ej. CELUPAISAGUADASPORT) se parten en varias lineas en vez de
                    estirar la fila y empujar los botones fuera de la tarjeta. */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <TeamMark team={team} size={32} />
                    <CardTitle className="text-base min-w-0 break-words leading-tight">{team.name}</CardTitle>
                    {dq && (
                      <Badge variant="destructive" className="shrink-0 text-[10px] px-1.5 py-0">
                        DQ
                      </Badge>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {canEdit && <TeamRosterDialog team={team} />}
                    {canEdit && tournament && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!dq && (
                            <DropdownMenuItem
                              onClick={() => setConfirmAction({ type: "disqualify", teamId, teamName: team.name })}
                            >
                              <Ban className="h-4 w-4 mr-2" />
                              Descalificar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setConfirmAction({ type: "delete", teamId, teamName: team.name })}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar del torneo
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  {team.players.length === 0
                    ? "Sin jugadores registrados"
                    : `${team.players.length} jugador${team.players.length === 1 ? "" : "es"}`}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Confirmation dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.type === "delete" ? "Eliminar equipo" : "Descalificar equipo"}
            </DialogTitle>
          </DialogHeader>
          {confirmAction?.type === "delete" ? (
            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong>{confirmAction.teamName}</strong> será eliminado del torneo.</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Se borrarán <strong>todos</strong> sus partidos (jugados y por jugar)</li>
                <li>Se eliminará de su grupo si tiene uno asignado</li>
                <li>La tabla de posiciones se recalculará sin este equipo</li>
              </ul>
              <p className="text-destructive font-medium">Esta acción no se puede deshacer.</p>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong>{confirmAction?.teamName}</strong> será descalificado del torneo.</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Todos sus partidos (jugados y futuros) serán <strong>anulados</strong> en la tabla de posiciones</li>
                <li>Ningun rival ganará ni perderá puntos por partidos contra este equipo</li>
                <li>Si está en playoffs, el rival avanzará automáticamente (3-0)</li>
                <li>Las estadísticas individuales (goles, tarjetas) se mantienen</li>
              </ul>
              <p className="text-destructive font-medium">Esta acción no se puede deshacer.</p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmAction(null)}>
              Cancelar
            </Button>
            <Button
              variant={confirmAction?.type === "delete" ? "destructive" : "default"}
              size="sm"
              onClick={handleConfirm}
            >
              {confirmAction?.type === "delete" ? "Eliminar" : "Descalificar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TournamentDetailProps {
  tournament: Tournament;
  canEdit: boolean;
  canEditSponsors?: boolean;
  orgSponsors?: Sponsor[];
  isAuthenticated?: boolean;
}

export function TournamentDetail({
  tournament,
  canEdit,
  canEditSponsors,
  orgSponsors,
  isAuthenticated = false,
}: TournamentDetailProps) {
  const { updateTournamentProps, updatePlayoffConfig, applyExternalMatchUpdate } = useTournaments();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  // Whether the current viewer is the tournament's actual organizer (the
  // user who created it). The "fase completada" / "campeón" / "configurar
  // final" auto-modals are gated on this — super admins have canEdit=true
  // across every tournament but shouldn't get spammed with celebration
  // popups every time they open one mid-tournament.
  const isOrganizer = !!user && user.id === tournament.createdBy;
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Pieza J: forces the champion modal into upload-replace mode when the
  // organizer clicks "Reemplazar foto del campeón" on a tournament that
  // already has one. Resets to false when the modal closes.
  const [championForceUpload, setChampionForceUpload] = useState(false);

  // Pieza F: one-shot "fase completada" modal. We snapshot which phases are
  // already complete at mount time and only fire the modal when a NEW phase
  // transitions to complete during this session. Reloading the page resets
  // the snapshot, so a phase that completed in a previous session won't
  // re-trigger.
  const phasesSeenAsComplete = useRef<Set<number>>(new Set());
  const initialized = useRef(false);
  const [showCompletionFor, setShowCompletionFor] = useState<number | null>(null);

  // Helper: compute the set of complete phase numbers at any given moment.
  const computeCompletePhases = (): Set<number> => {
    const out = new Set<number>();
    if (tournament.phaseConfigs?.length) {
      for (const pc of tournament.phaseConfigs) {
        if (pc.complete) out.add(pc.phase);
      }
    } else if (
      tournament.format === "group-playoff" &&
      tournament.groupStageComplete
    ) {
      out.add(1);
    }
    return out;
  };

  useEffect(() => {
    const current = computeCompletePhases();
    if (!initialized.current) {
      // First render: seed the "seen" set with what's already complete.
      // Anything in here when the user lands won't fire the modal.
      phasesSeenAsComplete.current = current;
      initialized.current = true;
      return;
    }
    if (!isOrganizer) return;
    // Any phase in `current` that isn't in our memo is a fresh completion.
    for (const phase of current) {
      if (!phasesSeenAsComplete.current.has(phase)) {
        phasesSeenAsComplete.current.add(phase);
        setShowCompletionFor(phase);
        break; // only one modal at a time
      }
    }
    // Prune: if a phase un-completed (edited backwards), drop it so it can
    // re-trigger when it completes again. Matches "first-time only per
    // load" semantics — page reload resets everything.
    for (const phase of Array.from(phasesSeenAsComplete.current)) {
      if (!current.has(phase)) phasesSeenAsComplete.current.delete(phase);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament.phaseConfigs, tournament.groupStageComplete, isOrganizer]);

  // Pieza I: configure-final modal. Fires once both finalists are known AND
  // the organizer hasn't picked a format yet. Detection compares team
  // assignment on the highest-round bracket match before/after this render
  // — we track "had teams" to detect the moment they're set. One-shot per
  // session like the rest of the modals.
  const finalBecameKnownRef = useRef<boolean>(false);
  const [showFinalConfig, setShowFinalConfig] = useState(false);
  useEffect(() => {
    if (!isOrganizer) return;
    if (tournament.format !== "group-playoff" && tournament.format !== "elimination") return;
    if (tournament.playoffFinalFormat) return; // already configured
    const playoff = tournament.matches.filter(
      (m) => m.phase === "playoff" || (!m.phase && tournament.format === "elimination")
    );
    if (playoff.length === 0) return;
    // For double-leg brackets the finalists live on the IDA (round maxRound-1),
    // not the vuelta (maxRound). The vuelta keeps null teams until configured.
    const maxRound = Math.max(...playoff.map((m) => m.round));
    const isDoubleLeg =
      (tournament.format === "elimination" && tournament.doubleRoundRobin) ||
      (tournament.format === "group-playoff" && tournament.playoffDoubleLeg);
    const idaRound = isDoubleLeg ? maxRound - 1 : maxRound;
    const idaFirst = playoff
      .filter((m) => m.round === idaRound)
      .sort((a, b) => a.matchNumber - b.matchNumber)[0];
    const finalistsKnown = !!idaFirst?.homeTeamId && !!idaFirst?.awayTeamId;
    if (finalistsKnown && !finalBecameKnownRef.current) {
      finalBecameKnownRef.current = true;
      setShowFinalConfig(true);
    }
    if (!finalistsKnown) {
      // Reset so a future "finals re-determined" still fires.
      finalBecameKnownRef.current = false;
    }
  }, [tournament.matches, tournament.format, tournament.playoffFinalFormat, isOrganizer]);

  // Pieza H: champion celebration modal. Fires when tournament.status flips
  // from any other value to "completed" during the session, gated on the
  // organizer (a super admin jumping between tournaments shouldn't get a
  // champion popup on each one). We track the *previous* status seen by this
  // mount and fire on a real transition (prev ≠ "completed" → "completed"),
  // not on a one-shot flag. That way an organizer who resets the final from
  // SQL and reloads results in the same tab still sees the modal — the
  // earlier one-shot flag would've stayed `true` from before the reset.
  const prevStatusRef = useRef<typeof tournament.status>(tournament.status);
  const [showChampion, setShowChampion] = useState(false);
  useEffect(() => {
    if (!isOrganizer) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = tournament.status;
    if (prev !== "completed" && tournament.status === "completed") {
      setShowChampion(true);
    }
  }, [tournament.status, isOrganizer]);

  // Realtime: cuando el anotador (o cualquier writer) guarda un cambio en
  // matches, lo reflejamos en el state local sin recargar. Esto hace que
  // la tabla pública del torneo, las cards del organizer y la pantalla del
  // anotador queden sincronizadas en vivo. Se suscribe a UPDATEs sobre
  // matches filtrados por tournament_id; el payload de Realtime trae las
  // columnas nuevas directamente, así que solo mapeamos snake → camel y
  // se lo pasamos al setter del context.
  useEffect(() => {
    const channel = supabase
      .channel(`tournament-${tournament.id}-matches`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `tournament_id=eq.${tournament.id}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (!row?.id) return;
          applyExternalMatchUpdate(tournament.id, row.id as string, {
            homeScore: row.home_score as number | null,
            awayScore: row.away_score as number | null,
            winnerId: (row.winner_id as string | null) ?? null,
            status: row.status as Match["status"],
            date: (row.date as string) ?? undefined,
            time: (row.time as string) ?? undefined,
            venue: (row.venue as string) ?? undefined,
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournament.id, applyExternalMatchUpdate]);

  // Controlled Tabs so the modal's "Ir a fase X" / "Ir a Playoffs" button can
  // switch tabs programmatically. Default depends on format.
  const defaultTab =
    tournament.format === "group-playoff" && tournament.phaseConfigs?.length
      ? "phase1"
      : tournament.format === "group-playoff"
      ? "groups"
      : tournament.format === "elimination"
      ? "bracket"
      : (tournament.groups?.length ?? 0) > 0
      ? "groups"
      : "standings";
  const [activeTab, setActiveTab] = useState(defaultTab);
  const sport = getSportInfo(tournament.sport);
  const sportCategory = getSportCategory(tournament.sport);
  const showStats = (tournament.enabledStats?.length ?? 0) > 0;

  // Tab visibility: null/undefined = nothing extra visible, only explicitly enabled tabs
  const isTabVisible = (tab: string) =>
    canEdit || (tournament.visibleTabs?.includes(tab) ?? false);

  // Available configurable tabs depend on format
  const configurableTabs = (() => {
    const tabs: { key: string; label: string }[] = [];
    // Multi-phase: phases 2+ are configurable
    if (tournament.format === "group-playoff" && tournament.phaseConfigs?.length) {
      for (const pc of tournament.phaseConfigs) {
        if (pc.phase === 1) continue;
        const groupsInPhase = tournament.groups?.filter(g => g.phase === pc.phase) || [];
        const label = groupsInPhase.length === 1
          ? `Liga (Fase ${pc.phase})`
          : `Grupos (Fase ${pc.phase})`;
        tabs.push({ key: `phase${pc.phase}`, label });
      }
    }
    if (tournament.format === "group-playoff") {
      tabs.push({ key: "playoffs", label: "Playoffs" });
    }
    tabs.push({ key: "schedule", label: "Calendario" });
    if (isAuthenticated) {
      tabs.push({ key: "teams", label: "Equipos" });
    }
    if (showStats) {
      tabs.push({ key: "stats", label: "Estadísticas" });
    }
    return tabs;
  })();

  // Combine org sponsors + tournament sponsors (no duplicates by id)
  // Agrega sponsors elegidos en el picker a la lista del torneo. Para cada uno
  // que no venga ya linkeado a la biblioteca (los subidos nuevos), aseguramos
  // su logo canónico en la biblioteca (dedup por imageUrl) y lo dejamos linkeado
  // vía librarySponsorId → así todo lo que se coloca queda reutilizable y editar
  // la imagen en la biblioteca luego se propaga a este torneo.
  const handleAddSponsors = async (picked: Sponsor[]) => {
    const orgId = user?.organizationProfile?.id;
    const resolved = await Promise.all(
      picked.map(async (s) => {
        if (s.librarySponsorId || !orgId) return s;
        const libId = await ensureLibrarySponsor(orgId, {
          imageUrl: s.imageUrl,
          linkUrl: s.linkUrl,
          name: s.name,
        });
        return libId ? { ...s, librarySponsorId: libId } : s;
      })
    );
    updateTournamentProps(tournament.id, {
      sponsors: [...(tournament.sponsors || []), ...resolved],
    });
  };

  // Cada torneo muestra SOLO sus propios patrocinadores (los que se le
  // agregaron explícitamente). Antes se anteponían los de la organización, lo
  // que los hacía aparecer en todos los torneos. Ahora la biblioteca (org) es
  // solo el catálogo para elegir en el picker (prop `orgSponsors`), no se
  // auto-muestra. Ver biblioteca-de-logos: "cada torneo elige cuáles".
  const allSponsors = tournament.sponsors || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
       <div className="space-y-2 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {sport?.emoji} {sport?.label}
          </Badge>
          <Badge variant="outline">{formatLabels[tournament.format]}</Badge>
          <Badge className={statusColors[tournament.status]}>
            {statusLabels[tournament.status]}
          </Badge>
          {tournament.scope && (
            <Badge variant="outline">
              {tournament.scope === "nacional"
                ? "Nacional"
                : tournament.scope === "departamental" && tournament.department
                  ? getDepartmentLabel(tournament.department)
                  : tournament.department && tournament.municipality
                    ? `${getMunicipalityLabel(tournament.department, tournament.municipality)}, ${getDepartmentLabel(tournament.department)}`
                    : ""}
            </Badge>
          )}
        </div>
        <h1 className="text-3xl font-bold">{tournament.name}</h1>
        {tournament.description && (
          <p className="text-muted-foreground">{tournament.description}</p>
        )}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{tournament.teamIds.length} equipos</span>
          <span>Inicio: {tournament.startDate}</span>
          {tournament.endDate && <span>Fin: {tournament.endDate}</span>}
        </div>
        {isAdmin && <AdminActions tournament={tournament} />}
       </div>

       <div className="flex flex-col sm:flex-row gap-2 shrink-0">
         {/* Pieza J: persistent champion-photo action for the organizer.
             Visible only once the tournament is completed. When there's no
             photo yet, the celebration modal opens in its default "upload"
             state; when a photo is already set, we force replace mode so the
             organizer can swap it. */}
         {isOrganizer && tournament.status === "completed" && (
           <Button
             variant={tournament.championPhotoUrl ? "outline" : "default"}
             size="sm"
             onClick={() => {
               setChampionForceUpload(!!tournament.championPhotoUrl);
               setShowChampion(true);
             }}
           >
             <Trophy className="h-4 w-4 mr-2" />
             {tournament.championPhotoUrl
               ? "Cambiar foto del campeón"
               : "Subir foto del campeón"}
           </Button>
         )}
         {canEdit && (
           <Button
             variant="outline"
             size="sm"
             onClick={() => setSettingsOpen(true)}
           >
             <Settings className="h-4 w-4 mr-2" />
             Configurar torneo
           </Button>
         )}
       </div>
      </div>

      {canEdit && (
        <ConfigurationDialog
          key={tournament.id}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          tournament={tournament}
          configurableTabs={configurableTabs}
          visibleTabs={tournament.visibleTabs}
          onUpdate={(updates) => updateTournamentProps(tournament.id, updates)}
          onUpdatePerGroup={(perGroupByPhase) => {
            // The user edited per-group cupos. Two writes are needed:
            // (1) phaseConfigs gets the updated perGroup for every edited phase
            // so fillPhase2Groups uses the right counts for intermediate phases.
            // (2) For the last phase (the one feeding the playoff bracket), the
            // same perGroup is also written to playoff_configs.
            const lastPhase = Math.max(
              ...(tournament.groups?.map((g) => g.phase ?? 1) ?? [1])
            );
            const updatedPhaseConfigs = (tournament.phaseConfigs ?? []).map((pc) => {
              const updated = perGroupByPhase[pc.phase];
              if (!updated) return pc;
              const avg = Math.max(
                1,
                Math.round(
                  Object.values(updated).reduce((s, n) => s + n, 0) /
                    Object.keys(updated).length
                )
              );
              return { ...pc, perGroup: updated, advancePerGroup: avg };
            });
            if (updatedPhaseConfigs.length > 0) {
              updateTournamentProps(tournament.id, { phaseConfigs: updatedPhaseConfigs });
            }
            const lastPerGroup = perGroupByPhase[lastPhase];
            if (lastPerGroup && tournament.playoffConfig) {
              const total = Object.values(lastPerGroup).reduce((s, n) => s + n, 0);
              const avg = Math.max(
                1,
                Math.round(total / Object.keys(lastPerGroup).length)
              );
              updatePlayoffConfig(tournament.id, avg, total, lastPerGroup);
            }
          }}
        />
      )}

      {/* Pieza F: one-shot completion modal. Pops up the moment a new phase
          transitions to complete during this session, points the organizer at
          the next tab. No persistence — reload starts fresh. */}
      {showCompletionFor !== null && (
        <PhaseCompletionModal
          open
          onOpenChange={(o) => !o && setShowCompletionFor(null)}
          tournament={tournament}
          finishedPhase={showCompletionFor}
          onGoToNext={(tab) => setActiveTab(tab)}
        />
      )}

      {/* Pieza H: champion celebration modal. Fires when the tournament
          transitions to "completed" during this session. The organizer also
          gets the upload UI here (Pieza J) so they can publish the champion
          photo right after crowning them. */}
      <TournamentChampionModal
        open={showChampion}
        onOpenChange={(o) => {
          setShowChampion(o);
          // Reset replace-mode flag when the modal closes so the next time it
          // opens (auto-trigger or "Subir foto") starts from a clean slate.
          if (!o) setChampionForceUpload(false);
        }}
        tournament={tournament}
        isOrganizer={isOrganizer}
        forceUpload={championForceUpload}
      />

      {/* Pieza J: read-only champion photo viewer. Pops as a centered modal on
          every load (and reload) of a completed tournament that has a champion
          photo set, visible to every visitor — logged in or not. The user can
          dismiss it to inspect the bracket / phases. We disable it while the
          organizer's celebration modal is open so they don't stack. */}
      <TournamentChampionViewerModal
        tournament={tournament}
        disabled={showChampion}
      />

      {/* Pieza I: prompt to choose the final's format (single / ida y vuelta /
          best-of-5 / best-of-7) once both finalists are known. */}
      <PlayoffFinalConfigDialog
        open={showFinalConfig}
        onOpenChange={setShowFinalConfig}
        tournament={tournament}
      />

      {/* Sponsors Banner */}
      {allSponsors.length > 0 && (
        <SponsorBanner sponsors={allSponsors} tournamentId={tournament.id} />
      )}

      {/* Edit tournament sponsors */}
      {(canEditSponsors ?? canEdit) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Patrocinadores del torneo</p>
            {(tournament.sponsors?.length ?? 0) < 6 && (
              <SponsorPicker
                library={orgSponsors || []}
                existingUrls={(tournament.sponsors || []).map((s) => s.imageUrl)}
                remainingSlots={6 - (tournament.sponsors?.length ?? 0)}
                onAdd={handleAddSponsors}
                trigger={
                  <Button type="button" variant="outline" size="sm">
                    <Plus className="mr-1 h-4 w-4" />
                    Añadir patrocinador
                  </Button>
                }
              />
            )}
          </div>
          <SponsorForm
            sponsors={tournament.sponsors || []}
            onChange={(sponsors) =>
              updateTournamentProps(tournament.id, { sponsors })
            }
            maxSponsors={6}
            hideAdd
            hideName
          />
        </div>
      )}

      {/* Content */}
      {tournament.format === "group-playoff" && tournament.phaseConfigs?.length ? (
        /* Multi-phase group-playoff */
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* TabsList already manages its own horizontal scroll on mobile.
              Avoid wrapping it in a flex container — that turns it into a
              flex item, which expands to its content's natural width and
              defeats the internal overflow. */}
          <TabsList>
            {tournament.phaseConfigs.map((pc) => {
              if (pc.phase > 1 && !isTabVisible(`phase${pc.phase}`)) return null;
              const groupsInPhase = tournament.groups?.filter(g => g.phase === pc.phase) || [];
              const phaseLabel = groupsInPhase.length === 1
                ? `Liga (Fase ${pc.phase})`
                : `Grupos (Fase ${pc.phase})`;
              return (
                <TabsTrigger key={`phase${pc.phase}`} value={`phase${pc.phase}`}>
                  {phaseLabel}
                </TabsTrigger>
              );
            })}
            {isTabVisible("playoffs") && <TabsTrigger value="playoffs">Playoffs</TabsTrigger>}
            {isTabVisible("schedule") && <TabsTrigger value="schedule">Calendario</TabsTrigger>}
            {canEdit && <TabsTrigger value="dates">Fechas</TabsTrigger>}
            {isTabVisible("teams") && isAuthenticated && <TabsTrigger value="teams">Equipos</TabsTrigger>}
            {isTabVisible("stats") && showStats && <TabsTrigger value="stats">Estadísticas</TabsTrigger>}
          </TabsList>
          {tournament.phaseConfigs.map((pc) => {
            if (pc.phase > 1 && !isTabVisible(`phase${pc.phase}`)) return null;
            return (
              <TabsContent key={`phase${pc.phase}`} value={`phase${pc.phase}`} className="mt-4">
                <PhaseTabContent
                  tournament={tournament}
                  phase={pc.phase}
                  canEdit={canEdit}
                />
              </TabsContent>
            );
          })}
          {isTabVisible("playoffs") && (
            <TabsContent value="playoffs" className="mt-4">
              <PlayoffBracketView tournament={tournament} canEdit={canEdit} />
            </TabsContent>
          )}
          {isTabVisible("schedule") && (
            <TabsContent value="schedule" className="mt-4">
              <div className="space-y-4">{canEdit && <ScorerLinksSection tournament={tournament} />}<MatchSchedule tournament={tournament} canEdit={canEdit} isAuthenticated={isAuthenticated} /></div>
            </TabsContent>
          )}
          {canEdit && (
            <TabsContent value="dates" className="mt-4">
              <DateOrganizer tournament={tournament} />
            </TabsContent>
          )}
          {isTabVisible("teams") && isAuthenticated && (
            <TabsContent value="teams" className="mt-4">
              <TeamsRosterSection teamIds={tournament.teamIds} canEdit={canEdit} tournament={tournament} />
            </TabsContent>
          )}
          {isTabVisible("stats") && showStats && (
            <TabsContent value="stats" className="mt-4">
              <TournamentStats tournament={tournament} canEdit={canEdit} />
            </TabsContent>
          )}
        </Tabs>
      ) : tournament.format === "group-playoff" ? (
        /* Single-phase group-playoff */
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* See note above re: wrapping TabsList in a flex container. */}
          <TabsList>
            <TabsTrigger value="groups">Grupos</TabsTrigger>
            {isTabVisible("playoffs") && <TabsTrigger value="playoffs">Playoffs</TabsTrigger>}
            {isTabVisible("schedule") && <TabsTrigger value="schedule">Calendario</TabsTrigger>}
            {canEdit && <TabsTrigger value="dates">Fechas</TabsTrigger>}
            {isTabVisible("teams") && isAuthenticated && <TabsTrigger value="teams">Equipos</TabsTrigger>}
            {isTabVisible("stats") && showStats && <TabsTrigger value="stats">Estadísticas</TabsTrigger>}
          </TabsList>
          <TabsContent value="groups" className="mt-4">
            <div className="space-y-3">
              {canEdit && tournament.status !== "completed" &&
                tournament.matches.some((m) => m.phase === "group") && (
                  <PhaseAdditionalRoundsButton tournament={tournament} phase={1} />
                )}
              <GroupStageView tournament={tournament} canEdit={canEdit} />
            </div>
          </TabsContent>
          {isTabVisible("playoffs") && (
            <TabsContent value="playoffs" className="mt-4">
              <PlayoffBracketView tournament={tournament} canEdit={canEdit} />
            </TabsContent>
          )}
          {isTabVisible("schedule") && (
            <TabsContent value="schedule" className="mt-4">
              <div className="space-y-4">{canEdit && <ScorerLinksSection tournament={tournament} />}<MatchSchedule tournament={tournament} canEdit={canEdit} isAuthenticated={isAuthenticated} /></div>
            </TabsContent>
          )}
          {canEdit && (
            <TabsContent value="dates" className="mt-4">
              <DateOrganizer tournament={tournament} />
            </TabsContent>
          )}
          {isTabVisible("teams") && isAuthenticated && (
            <TabsContent value="teams" className="mt-4">
              <TeamsRosterSection teamIds={tournament.teamIds} canEdit={canEdit} tournament={tournament} />
            </TabsContent>
          )}
          {isTabVisible("stats") && showStats && (
            <TabsContent value="stats" className="mt-4">
              <TournamentStats tournament={tournament} canEdit={canEdit} />
            </TabsContent>
          )}
        </Tabs>
      ) : tournament.format === "elimination" ? (
        <Tabs defaultValue="bracket">
          <TabsList>
            <TabsTrigger value="bracket">Bracket</TabsTrigger>
            {isTabVisible("schedule") && <TabsTrigger value="matches">Partidos</TabsTrigger>}
            {canEdit && <TabsTrigger value="dates">Fechas</TabsTrigger>}
            {isTabVisible("teams") && isAuthenticated && <TabsTrigger value="teams">Equipos</TabsTrigger>}
            {isTabVisible("stats") && showStats && <TabsTrigger value="stats">Estadísticas</TabsTrigger>}
          </TabsList>
          <TabsContent value="bracket" className="mt-4">
            <BracketView tournament={tournament} canEdit={canEdit} />
          </TabsContent>
          {isTabVisible("schedule") && (
            <TabsContent value="matches" className="mt-4">
              <div className="space-y-4">{canEdit && <ScorerLinksSection tournament={tournament} />}<MatchSchedule tournament={tournament} canEdit={canEdit} isAuthenticated={isAuthenticated} /></div>
            </TabsContent>
          )}
          {canEdit && (
            <TabsContent value="dates" className="mt-4">
              <DateOrganizer tournament={tournament} />
            </TabsContent>
          )}
          {isTabVisible("teams") && isAuthenticated && (
            <TabsContent value="teams" className="mt-4">
              <TeamsRosterSection teamIds={tournament.teamIds} canEdit={canEdit} tournament={tournament} />
            </TabsContent>
          )}
          {isTabVisible("stats") && showStats && (
            <TabsContent value="stats" className="mt-4">
              <TournamentStats tournament={tournament} canEdit={canEdit} />
            </TabsContent>
          )}
        </Tabs>
      ) : tournament.groups && tournament.groups.length > 0 ? (
        <Tabs defaultValue="groups">
          <TabsList>
            <TabsTrigger value="groups">Grupos</TabsTrigger>
            {isTabVisible("schedule") && <TabsTrigger value="schedule">Calendario</TabsTrigger>}
            {canEdit && <TabsTrigger value="dates">Fechas</TabsTrigger>}
            {isTabVisible("teams") && isAuthenticated && <TabsTrigger value="teams">Equipos</TabsTrigger>}
            {isTabVisible("stats") && showStats && <TabsTrigger value="stats">Estadísticas</TabsTrigger>}
          </TabsList>
          <TabsContent value="groups" className="mt-4">
            <div className="space-y-3">
              {canEdit && tournament.status !== "completed" &&
                tournament.matches.some((m) => m.phase === "group") && (
                  <PhaseAdditionalRoundsButton tournament={tournament} phase={1} />
                )}
              <GroupStageView tournament={tournament} canEdit={canEdit} />
            </div>
          </TabsContent>
          {isTabVisible("schedule") && (
            <TabsContent value="schedule" className="mt-4">
              <div className="space-y-4">{canEdit && <ScorerLinksSection tournament={tournament} />}<MatchSchedule tournament={tournament} canEdit={canEdit} isAuthenticated={isAuthenticated} /></div>
            </TabsContent>
          )}
          {canEdit && (
            <TabsContent value="dates" className="mt-4">
              <DateOrganizer tournament={tournament} />
            </TabsContent>
          )}
          {isTabVisible("teams") && isAuthenticated && (
            <TabsContent value="teams" className="mt-4">
              <TeamsRosterSection teamIds={tournament.teamIds} canEdit={canEdit} tournament={tournament} />
            </TabsContent>
          )}
          {isTabVisible("stats") && showStats && (
            <TabsContent value="stats" className="mt-4">
              <TournamentStats tournament={tournament} canEdit={canEdit} />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <Tabs defaultValue="standings">
          <TabsList>
            <TabsTrigger value="standings">Clasificación</TabsTrigger>
            {isTabVisible("schedule") && <TabsTrigger value="schedule">Calendario</TabsTrigger>}
            {canEdit && <TabsTrigger value="dates">Fechas</TabsTrigger>}
            {isTabVisible("teams") && isAuthenticated && <TabsTrigger value="teams">Equipos</TabsTrigger>}
            {isTabVisible("stats") && showStats && <TabsTrigger value="stats">Estadísticas</TabsTrigger>}
          </TabsList>
          <TabsContent value="standings" className="mt-4">
            <div className="space-y-3">
              {canEdit && tournament.status !== "completed" &&
                tournament.matches.filter((m) => m.phase !== "playoff").length > 0 && (
                  <PhaseAdditionalRoundsButton tournament={tournament} phase={1} />
                )}
              {sportCategory === "baseball" ? (
                <BaseballStandingsTable tournament={tournament} />
              ) : sportCategory === "basketball" ? (
                <BasketballStandingsTable tournament={tournament} />
              ) : sportCategory === "volleyball" ? (
                <VolleyballStandingsTable tournament={tournament} />
              ) : (
                <StandingsTable tournament={tournament} />
              )}
            </div>
          </TabsContent>
          {isTabVisible("schedule") && (
            <TabsContent value="schedule" className="mt-4">
              <div className="space-y-4">{canEdit && <ScorerLinksSection tournament={tournament} />}<MatchSchedule tournament={tournament} canEdit={canEdit} isAuthenticated={isAuthenticated} /></div>
            </TabsContent>
          )}
          {canEdit && (
            <TabsContent value="dates" className="mt-4">
              <DateOrganizer tournament={tournament} />
            </TabsContent>
          )}
          {isTabVisible("teams") && isAuthenticated && (
            <TabsContent value="teams" className="mt-4">
              <TeamsRosterSection teamIds={tournament.teamIds} canEdit={canEdit} tournament={tournament} />
            </TabsContent>
          )}
          {isTabVisible("stats") && showStats && (
            <TabsContent value="stats" className="mt-4">
              <TournamentStats tournament={tournament} canEdit={canEdit} />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}

type ConfigSection = "info" | "visibility" | "format" | "groups";

const SECTION_TITLES: Record<ConfigSection, string> = {
  info: "Información",
  visibility: "Visibilidad pública",
  format: "Formato y reglas",
  groups: "Grupos y fases",
};

function ConfigurationDialog({
  open,
  onOpenChange,
  tournament,
  configurableTabs,
  visibleTabs,
  onUpdate,
  onUpdatePerGroup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament;
  configurableTabs: { key: string; label: string }[];
  visibleTabs?: string[];
  onUpdate: (
    updates: Partial<Pick<Tournament, "name" | "description" | "startDate" | "endDate" | "bestOf" | "visibleTabs" | "phaseConfigs">>
  ) => void;
  /** Persist per-group cupos: updates both the matching phaseConfig and the
   *  playoff_configs row when the edited phase is the last one. */
  onUpdatePerGroup: (perGroupByPhase: Record<number, Record<string, number>>) => void;
}) {
  // The parent passes `key={tournament.id}` so this component remounts and
  // re-initializes from fresh props when the tournament changes.
  const [section, setSection] = useState<ConfigSection | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState(false);

  // Drafts per section — only the active section's draft matters at a time.
  const [name, setName] = useState(tournament.name);
  const [description, setDescription] = useState(tournament.description ?? "");
  const [startDate, setStartDate] = useState(tournament.startDate);
  const [endDate, setEndDate] = useState(tournament.endDate ?? "");
  const [visibilityDraft, setVisibilityDraft] = useState<string[]>(visibleTabs ?? []);
  const [bestOf, setBestOf] = useState<3 | 5>(tournament.bestOf ?? 3);

  // Per-group cupos draft, keyed by phase number → groupId → count (as string
  // for input bindings). Seeded from the saved perGroup map when present, or
  // from the legacy uniform advancePerGroup otherwise.
  const [cuposDraft, setCuposDraft] = useState<Record<number, Record<string, string>>>(() => {
    const out: Record<number, Record<string, string>> = {};
    const byPhase = new Map<number, typeof tournament.groups>();
    for (const g of tournament.groups ?? []) {
      const arr = byPhase.get(g.phase ?? 1) ?? [];
      arr.push(g);
      byPhase.set(g.phase ?? 1, arr);
    }
    for (const [phase, gs] of byPhase) {
      // For the last phase, the saved perGroup lives in playoffConfig; for
      // intermediate phases it's in the matching phaseConfig.
      const isLast = !tournament.phaseConfigs?.some((c) => c.phase > phase);
      const pc = tournament.phaseConfigs?.find((c) => c.phase === phase);
      const saved = isLast
        ? (tournament.playoffConfig?.perGroup ?? pc?.perGroup)
        : pc?.perGroup;
      const legacy = isLast
        ? (tournament.playoffConfig?.advancePerGroup ?? pc?.advancePerGroup ?? 2)
        : (pc?.advancePerGroup ?? 2);
      const row: Record<string, string> = {};
      for (const g of gs ?? []) {
        const val = saved?.[g.id] ?? legacy;
        row[g.id] = String(val);
      }
      out[phase] = row;
    }
    return out;
  });

  const sport = getSportInfo(tournament.sport);

  const groupsByPhase = (() => {
    const map = new Map<number, typeof tournament.groups>();
    for (const g of tournament.groups ?? []) {
      const arr = map.get(g.phase ?? 1) ?? [];
      arr.push(g);
      map.set(g.phase ?? 1, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  })();

  // Whether the active section has anything to save. Format is editable only
  // when bestOf applies (volleyball); otherwise it's purely informational.
  // Groups section is editable when the tournament uses groups (cupos).
  const hasGroups = (tournament.groups?.length ?? 0) > 0;
  const isReadOnlySection =
    (section === "groups" && !hasGroups) ||
    (section === "format" && tournament.sport !== "volleyball");

  const handleClose = () => {
    onOpenChange(false);
    // Reset internal step state when the dialog closes; the form drafts get
    // reset on next mount thanks to the parent's key prop.
    setSection(null);
    setConfirming(false);
    setSuccess(false);
  };

  // Auto-dismiss the success step after 5 seconds. If the user closes the
  // dialog manually before that, the cleanup clears the pending timer.
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => handleClose(), 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success]);

  const handleConfirm = () => {
    if (section === "info") {
      const updates: Parameters<typeof onUpdate>[0] = {};
      const trimmedName = name.trim();
      if (trimmedName && trimmedName !== tournament.name) updates.name = trimmedName;
      const trimmedDesc = description.trim();
      if (trimmedDesc !== (tournament.description ?? "")) updates.description = trimmedDesc || undefined;
      if (startDate && startDate !== tournament.startDate) updates.startDate = startDate;
      if (endDate !== (tournament.endDate ?? "")) updates.endDate = endDate || undefined;
      if (Object.keys(updates).length > 0) onUpdate(updates);
    } else if (section === "visibility") {
      onUpdate({ visibleTabs: visibilityDraft });
    } else if (section === "format") {
      const updates: Parameters<typeof onUpdate>[0] = {};
      if (tournament.sport === "volleyball" && bestOf !== (tournament.bestOf ?? 3)) {
        updates.bestOf = bestOf;
      }
      if (Object.keys(updates).length > 0) onUpdate(updates);
    } else if (section === "groups") {
      // Parse the per-phase draft to numbers and forward to the parent. The
      // parent handler decides which writes to make (phaseConfigs vs playoff).
      const numericByPhase: Record<number, Record<string, number>> = {};
      for (const [phase, row] of Object.entries(cuposDraft)) {
        const entries: Record<string, number> = {};
        for (const [gid, str] of Object.entries(row)) {
          const n = parseInt(str);
          if (!isNaN(n) && n > 0) entries[gid] = n;
        }
        if (Object.keys(entries).length > 0) numericByPhase[Number(phase)] = entries;
      }
      if (Object.keys(numericByPhase).length > 0) onUpdatePerGroup(numericByPhase);
    }
    setConfirming(false);
    setSuccess(true);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        {/* STEP 4 — success (auto-closes after 5s) */}
        {success && (
          <>
            <DialogHeader>
              <DialogTitle className="sr-only">Cambios guardados</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Cambios guardados</h2>
                <p className="text-sm text-muted-foreground">
                  Este aviso se cierra automáticamente en unos segundos.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={handleClose}
              >
                Cerrar ahora
              </Button>
            </div>
          </>
        )}

        {/* STEP 3 — confirmation */}
        {!success && confirming && (
          <>
            <DialogHeader>
              <DialogTitle>¿Confirmás los cambios?</DialogTitle>
              <DialogDescription>
                Se van a guardar los cambios en <strong>{section ? SECTION_TITLES[section] : ""}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirming(false)}
              >
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleConfirm}>
                Confirmar
              </Button>
            </div>
          </>
        )}

        {/* STEP 1 — section picker */}
        {!success && !confirming && section === null && (
          <>
            <DialogHeader>
              <DialogTitle>Configuración del torneo</DialogTitle>
              <DialogDescription>
                Elegí qué sección querés revisar o modificar.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {(["info", "visibility", "format", "groups"] as ConfigSection[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSection(key)}
                  className="w-full text-left rounded-lg border bg-card p-3 hover:bg-accent/40 transition-colors flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-medium">{SECTION_TITLES[key]}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {key === "info" && "Nombre, descripción, fechas."}
                      {key === "visibility" && "Qué pestañas ven los usuarios públicos."}
                      {key === "format" && "Doble vuelta, sets de vóley."}
                      {key === "groups" && "Resumen de cómo está armado el torneo (solo lectura)."}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </>
        )}

        {/* STEP 2 — section editor */}
        {!success && !confirming && section !== null && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 -ml-1"
                  onClick={() => setSection(null)}
                  aria-label="Volver"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <DialogTitle className="text-base">{SECTION_TITLES[section]}</DialogTitle>
              </div>
            </DialogHeader>

            {/* Información */}
            {section === "info" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cfg-name">Nombre</Label>
                  <Input
                    id="cfg-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cfg-desc">Descripción</Label>
                  <Textarea
                    id="cfg-desc"
                    value={description}
                    rows={2}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cfg-start">Fecha de inicio</Label>
                    <Input
                      id="cfg-start"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cfg-end">Fecha de fin (opcional)</Label>
                    <Input
                      id="cfg-end"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Visibilidad pública */}
            {section === "visibility" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Elegí qué pestañas ven los usuarios públicos del torneo.
                </p>
                {configurableTabs.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Este torneo no tiene pestañas configurables.
                  </p>
                )}
                {configurableTabs.map((tab) => {
                  const checked = visibilityDraft.includes(tab.key);
                  return (
                    <label
                      key={tab.key}
                      className="flex items-center gap-3 cursor-pointer rounded-md border p-2.5"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setVisibilityDraft((prev) =>
                            checked
                              ? prev.filter((k) => k !== tab.key)
                              : [...prev, tab.key]
                          )
                        }
                        className="h-4 w-4 rounded border-border"
                      />
                      <span className="text-sm">{tab.label}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Formato y reglas */}
            {section === "format" && (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Deporte</span>
                  <span>{sport?.emoji} {sport?.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Formato</span>
                  <span>
                    {(() => {
                      const phases = tournament.phaseConfigs?.length ?? 0;
                      if (tournament.format === "group-playoff" && phases > 1) {
                        return `${phases} fases de grupos + Playoffs`;
                      }
                      return formatLabels[tournament.format];
                    })()}
                  </span>
                </div>
                {(tournament.format === "round-robin" || tournament.format === "group-playoff") && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Doble vuelta (ida y vuelta)</span>
                    <span>{tournament.doubleRoundRobin ? "Sí" : "No"}</span>
                  </div>
                )}
                {tournament.sport === "volleyball" && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Sets</span>
                    <select
                      className="text-sm border rounded px-2 py-1 bg-background"
                      value={bestOf}
                      onChange={(e) => setBestOf(parseInt(e.target.value, 10) as 3 | 5)}
                    >
                      <option value={3}>Mejor de 3</option>
                      <option value={5}>Mejor de 5</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Grupos y fases (editable: cupos por grupo) */}
            {section === "groups" && (
              <div className="space-y-3">
                {groupsByPhase.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Este torneo no usa grupos.
                  </p>
                ) : (
                  groupsByPhase.map(([phase, groups]) => {
                    const phaseDraft = cuposDraft[phase] ?? {};
                    const phaseTotal = Object.values(phaseDraft).reduce(
                      (s, str) => s + (parseInt(str) || 0),
                      0
                    );
                    const isLast = !tournament.phaseConfigs?.some((c) => c.phase > phase);
                    return (
                      <div key={phase} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {tournament.phaseConfigs?.length ? `Fase ${phase}` : "Fase única"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Total: {phaseTotal} {isLast ? "a playoffs" : "a fase siguiente"}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {groups?.map((g) => (
                            <div
                              key={g.id}
                              className="flex items-center justify-between gap-2"
                            >
                              <div className="flex flex-col">
                                <span className="text-sm">{g.name}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {g.teamIds.length} {g.teamIds.length === 1 ? "equipo" : "equipos"}
                                </span>
                              </div>
                              <Input
                                type="number"
                                min={1}
                                value={phaseDraft[g.id] ?? ""}
                                onChange={(e) =>
                                  setCuposDraft((prev) => ({
                                    ...prev,
                                    [phase]: { ...(prev[phase] ?? {}), [g.id]: e.target.value },
                                  }))
                                }
                                className="w-14 h-8 text-center text-sm"
                                aria-label={`Cupo de ${g.name}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSection(null)}
              >
                Atrás
              </Button>
              {isReadOnlySection ? (
                <Button className="flex-1" onClick={handleClose}>
                  Cerrar
                </Button>
              ) : (
                <Button className="flex-1" onClick={() => setConfirming(true)}>
                  Guardar
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Botón "Generar nueva ronda" para una fase de grupos/liga ya en marcha.
 *
 * Visible solo para el organizador. Aparece SIEMPRE pero queda
 * deshabilitado mientras la fase tenga 5 o más partidos sin programar
 * (sin fecha/hora asignada). La idea es evitar que el organizador
 * genere "muchas vueltas" de antemano y termine con un calendario
 * imposible de programar — el botón se activa cuando ya casi terminó
 * de programar las rondas existentes.
 *
 * El modal permite elegir entre 1 ronda (vuelta con localía invertida)
 * o 2 rondas (ida + vuelta nueva). No toca el flag global
 * `doubleRoundRobin` del torneo — solo agrega partidos.
 */
function PhaseAdditionalRoundsButton({
  tournament,
  phase,
}: {
  tournament: Tournament;
  phase: number;
}) {
  const { generateAdditionalRounds } = useTournaments();
  const [modalOpen, setModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  const phaseGroupIds = new Set(
    (tournament.groups ?? [])
      // Groups legacy pueden no traer `phase` — el schema usa default 1
      // pero por las dudas tratamos `undefined` como fase 1.
      .filter((g) => (g.phase ?? 1) === phase)
      .map((g) => g.id)
  );
  // Dos casos cubiertos:
  //   1) Torneo con grupos: contar matches del grupo activo (phase=group).
  //   2) Torneo round-robin "puro" sin grupos: matches sin `phase` ni
  //      `groupId` — los que viven en `tournament.matches` directamente.
  //   Excluímos siempre `phase === "playoff"` porque la feature no aplica
  //   al bracket.
  const phaseMatches = tournament.matches.filter((m) => {
    if (m.phase === "playoff") return false;
    if (phaseGroupIds.size > 0) {
      return m.phase === "group" && !!m.groupId && phaseGroupIds.has(m.groupId);
    }
    // Round-robin puro: solo permitir fase 1 (no hay multi-phase sin grupos).
    return phase === 1 && !m.phase && !m.groupId;
  });
  // Alineado con el badge "X sin programar" del Date Organizer
  // (date-organizer.tsx:85-86): el conteo oficial es por `status`. Si
  // chequeáramos `!m.date || !m.time` también nos quedaríamos contando
  // partidos "completed" o "postponed" a los que les borraron la fecha,
  // inflando el número y dejando el botón disabled de más.
  const unscheduledCount = phaseMatches.filter(
    (m) => m.status === "unscheduled"
  ).length;

  // ¿Hay matches generados en alguna fase POSTERIOR de grupos? Si sí, no
  // tiene sentido seguir agregando rondas a esta fase porque los
  // clasificados ya avanzaron y los rankings finales de esta fase están
  // congelados desde ahí. Aplica a torneos multi-phase (phase 1 → 2 → ...).
  const nextPhaseStarted = tournament.matches.some((m) => {
    if (m.phase !== "group" || !m.groupId) return false;
    const g = (tournament.groups ?? []).find((gg) => gg.id === m.groupId);
    if (!g) return false;
    return (g.phase ?? 1) > phase;
  });

  // ¿Los playoffs ya están "en marcha"? Importante: el bracket se
  // scaffoldea VACÍO al generar la fase 1 (mirá `generatePhaseMatches`
  // en tournament-context.tsx). Esos slots sin equipos NO cuentan como
  // "empezó" — solo cuentan los matches que tienen al menos un team
  // asignado (señal real de que la cascada de clasificación corrió).
  const playoffsStarted = tournament.matches.some(
    (m) => m.phase === "playoff" && (m.homeTeamId || m.awayTeamId)
  );

  // Orden de prioridad de los motivos de bloqueo: lock-de-cascada manda
  // sobre lock-por-conteo. El organizador necesita saber primero que la
  // siguiente fase / playoffs avanzaron, no que tiene partidos sin
  // programar (que en ese punto es irrelevante).
  const phaseLocked = nextPhaseStarted || playoffsStarted;
  const countLocked = !phaseLocked && unscheduledCount >= 5;
  const disabled = phaseLocked || countLocked;

  const tooltipText = nextPhaseStarted
    ? `La fase ${phase + 1} ya comenzó. No se pueden agregar más rondas a esta fase.`
    : playoffsStarted
      ? "Los playoffs ya comenzaron. No se pueden agregar más rondas a esta fase."
      : countLocked
        ? `Se activará cuando queden menos de 5 partidos sin programar en esta fase (actualmente hay ${unscheduledCount}).`
        : "";

  const run = async (numRounds: 1 | 2) => {
    setModalOpen(false);
    setGenerating(true);
    const ok = await generateAdditionalRounds(tournament.id, phase, numRounds);
    setGenerating(false);
    if (ok) {
      toast.success(
        numRounds === 1
          ? "Nueva ronda generada"
          : "Ida y vuelta generadas"
      );
    } else {
      toast.error("No pudimos generar las rondas");
    }
  };

  return (
    <div className="flex justify-end">
      {/* Span wrapper: el title HTML no se dispara en buttons disabled,
          pero sí en el span padre. Hack para tener tooltip sin instalar
          un primitive (no hay Tooltip en el design system todavía). */}
      <span
        title={tooltipText}
        className="inline-block"
      >
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || generating}
          onClick={() => setModalOpen(true)}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          {generating ? "Generando..." : "Generar nueva ronda"}
        </Button>
      </span>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Generar nueva ronda</DialogTitle>
            <DialogDescription>
              Los equipos de cada grupo se volverán a enfrentar.
              ¿Cuántas rondas agregar?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              onClick={() => run(1)}
              className="justify-start h-auto py-3"
            >
              <Plus className="h-4 w-4 mr-3 shrink-0" />
              <div className="text-left">
                <div className="font-medium">Una ronda más</div>
                <div className="text-xs text-muted-foreground font-normal">
                  Los locales pasan a visitantes
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              onClick={() => run(2)}
              className="justify-start h-auto py-3"
            >
              <RefreshCw className="h-4 w-4 mr-3 shrink-0" />
              <div className="text-left">
                <div className="font-medium">Ida + Vuelta</div>
                <div className="text-xs text-muted-foreground font-normal">
                  Dos rondas completas
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Tab content for one phase of a multi-phase group-playoff tournament.
 * Decides whether to show:
 *  - the existing GroupStageView (phase has matches → normal view),
 *  - a "Generar partidos" button (phase has teams but no matches yet), or
 *  - a "Configurar Fase X" button (phase still empty, previous phase finished).
 */
function PhaseTabContent({
  tournament,
  phase,
  canEdit,
}: {
  tournament: Tournament;
  phase: number;
  canEdit: boolean;
}) {
  const { generatePhaseMatches } = useTournaments();
  const [configOpen, setConfigOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [idaVueltaOpen, setIdaVueltaOpen] = useState(false);

  const phaseGroups = (tournament.groups ?? []).filter((g) => g.phase === phase);
  const phaseGroupIds = new Set(phaseGroups.map((g) => g.id));
  const phaseMatches = tournament.matches.filter(
    (m) => m.phase === "group" && m.groupId && phaseGroupIds.has(m.groupId)
  );

  const hasTeams = phaseGroups.some((g) => g.teamIds.length > 0);
  const hasMatches = phaseMatches.length > 0;

  // Mirror the existing match-schedule flow: paid tournaments get the
  // Ida vs Ida-y-Vuelta picker; free ones default to "ida" (false) because
  // double round-robin is gated to the paid plan there too.
  const runGenerate = async (doubleRoundRobin: boolean) => {
    setIdaVueltaOpen(false);
    setGenerating(true);
    const ok = await generatePhaseMatches(tournament.id, phase, doubleRoundRobin);
    setGenerating(false);
    if (ok) toast.success(`Partidos de fase ${phase} generados`);
    else toast.error("No pudimos generar los partidos");
  };

  const onGenerateClick = () => {
    if (tournament.plan === "paid") {
      setIdaVueltaOpen(true);
    } else {
      runGenerate(false);
    }
  };

  // Jornada counts shown in the dialog so the organizer sees how many fechas
  // each option produces. Uses the smallest group's team count (worst case)
  // and adjusts for an even/odd team count the same way the generator does.
  const smallestGroupSize = phaseGroups.reduce(
    (min, g) => (g.teamIds.length > 0 && g.teamIds.length < min ? g.teamIds.length : min),
    Infinity
  );
  const teamsForJornadas = isFinite(smallestGroupSize) ? smallestGroupSize : 0;
  const jornadasIda = teamsForJornadas > 1
    ? (teamsForJornadas % 2 === 0 ? teamsForJornadas - 1 : teamsForJornadas)
    : 0;
  const jornadasIdaVuelta = jornadasIda * 2;

  // Previous phase completion gates the "Configurar Fase X" button. For phase
  // 1 there's no previous phase; show config only when explicit empty (which
  // shouldn't happen for phase 1 since the wizard always seeds it).
  const previousPhase = phase - 1;
  const previousPhaseConfig = tournament.phaseConfigs?.find(
    (c) => c.phase === previousPhase
  );
  const previousComplete = phase === 1 ? true : !!previousPhaseConfig?.complete;

  // STATE 1 — Phase is fully set up and has matches: normal standings view.
  // Para el organizador, mostramos arriba el botón de "generar nueva ronda".
  if (hasMatches) {
    return (
      <div className="space-y-3">
        {canEdit && tournament.status !== "completed" && (
          <PhaseAdditionalRoundsButton tournament={tournament} phase={phase} />
        )}
        <GroupStageView tournament={tournament} phase={phase} canEdit={canEdit} />
      </div>
    );
  }

  // STATE 2 — Teams assigned but no fixture yet: show both "Editar
  // configuración" (to move teams between groups) and "Generar fixture".
  if (hasTeams) {
    if (!canEdit) {
      return (
        <p className="text-sm text-muted-foreground text-center py-8">
          Esperando que el organizador genere las fechas de la fase {phase}.
        </p>
      );
    }
    return (
      <div className="space-y-4 py-6">
        {/* Visual summary of the current assignment so the organizer sees
            what they're about to schedule before generating. */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium">Grupos de la fase {phase}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {phaseGroups.map((g) => (
              <div key={g.id} className="rounded-md border bg-background p-2.5 space-y-1">
                <div className="text-xs font-semibold">{g.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {g.teamIds.length} {g.teamIds.length === 1 ? "equipo" : "equipos"}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
          <Button variant="outline" onClick={() => setConfigOpen(true)}>
            Configurar grupos
          </Button>
          <Button disabled={generating} onClick={onGenerateClick}>
            {generating ? "Generando..." : `Generar fixture`}
          </Button>
        </div>

        {/* For phase 1 the dialog opens in "initial assignment" mode
            (fromPhase=0) — the source is the tournament's team list, not a
            previous phase's classified teams. From phase 2 onwards the
            source is phase N-1's classification. */}
        <PhaseConfigDialog
          open={configOpen}
          onOpenChange={setConfigOpen}
          tournament={tournament}
          fromPhase={phase - 1}
          mode="groups"
        />

        <Dialog open={idaVueltaOpen} onOpenChange={setIdaVueltaOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Tipo de calendario</DialogTitle>
              <DialogDescription>
                Elegí el formato para los partidos de la fase {phase}.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                onClick={() => runGenerate(false)}
                className="justify-start h-auto py-3"
              >
                <div className="text-left">
                  <div className="font-medium">Ida</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    Cada equipo se enfrenta una vez
                    {jornadasIda > 0 ? ` (${jornadasIda} jornadas)` : ""}
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                onClick={() => runGenerate(true)}
                className="justify-start h-auto py-3"
              >
                <div className="text-left">
                  <div className="font-medium">Ida y Vuelta</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    Cada equipo se enfrenta dos veces
                    {jornadasIdaVuelta > 0 ? ` (${jornadasIdaVuelta} jornadas)` : ""}
                  </div>
                </div>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // STATE 3 — Phase still empty: show the configure button if the previous
  // phase has finished. Otherwise wait for it to finish.
  if (!previousComplete) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Esperando que termine la fase {previousPhase}.
      </p>
    );
  }

  if (!canEdit) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Esperando que el organizador configure la fase {phase}.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div>
        <p className="text-base font-medium">Fase {phase} pendiente de configuración</p>
        <p className="text-sm text-muted-foreground">
          La fase {previousPhase} terminó. Asigná los clasificados a los grupos
          de la fase {phase}.
        </p>
      </div>
      <Button onClick={() => setConfigOpen(true)}>
        Configurar grupos
      </Button>
      <PhaseConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        tournament={tournament}
        fromPhase={previousPhase}
        mode="groups"
      />
    </div>
  );
}
