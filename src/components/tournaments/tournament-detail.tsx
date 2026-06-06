"use client";

import { useEffect, useState } from "react";
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
import { MatchSchedule } from "@/components/standings/match-schedule";
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
import { getSportCategory, Tournament, Sponsor } from "@/types";
import { SponsorBanner } from "@/components/sponsors/sponsor-banner";
import { SponsorForm } from "@/components/sponsors/sponsor-form";
import { AddTeamsDialog } from "@/components/tournaments/add-teams-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Settings, MoreVertical, Trash2, Ban, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const statusLabels: Record<string, string> = {
  upcoming: "Proximo",
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
  { key: "documento", label: "Numero de documento", width: 22 },
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

  const handleDownload = () => {
    const wb = XLSX.utils.book_new();
    const baseHeaders = ["Nombre", "Apellido 1", "Apellido 2"];
    const extras = OPTIONAL_COLUMNS.filter((c) => selected.has(c.key));
    const allHeaders = [...baseHeaders, ...extras.map((c) => c.label)];

    const emptyRows = Array.from({ length: 20 }, () =>
      Array(allHeaders.length).fill("")
    );
    const sheetData: (string | undefined)[][] = [
      ["Nombre del equipo", ""],
      allHeaders,
      ...emptyRows,
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws["!cols"] = allHeaders.map((h, i) => ({
      wch: i < 3 ? 20 : extras.find((c) => c.label === h)?.width || 15,
    }));
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
              {["Nombre", "Apellido 1", "Apellido 2"].map((f) => (
                <Badge key={f} variant="secondary">
                  {f}
                </Badge>
              ))}
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(team.primaryColor || team.secondaryColor) && (
                      <div className="w-6 h-6 rounded border border-border overflow-hidden flex shrink-0">
                        <div
                          className="w-1/2 h-full"
                          style={{ backgroundColor: team.primaryColor || "#fff" }}
                        />
                        <div
                          className="w-1/2 h-full"
                          style={{ backgroundColor: team.secondaryColor || "#000" }}
                        />
                      </div>
                    )}
                    <CardTitle className="text-base">{team.name}</CardTitle>
                    {dq && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        DQ
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
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
  const { updateTournamentProps, updatePlayoffConfig } = useTournaments();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [settingsOpen, setSettingsOpen] = useState(false);
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
      tabs.push({ key: "stats", label: "Estadisticas" });
    }
    return tabs;
  })();

  // Combine org sponsors + tournament sponsors (no duplicates by id)
  const allSponsors = (() => {
    const combined = [...(orgSponsors || []), ...(tournament.sponsors || [])];
    const seen = new Set<string>();
    return combined.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  })();

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

       {canEdit && (
         <Button
           variant="outline"
           size="sm"
           className="shrink-0"
           onClick={() => setSettingsOpen(true)}
         >
           <Settings className="h-4 w-4 mr-2" />
           Configuracion
         </Button>
       )}
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

      {/* Sponsors Banner */}
      {allSponsors.length > 0 && <SponsorBanner sponsors={allSponsors} />}

      {/* Edit tournament sponsors */}
      {(canEditSponsors ?? canEdit) && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Patrocinadores del torneo</p>
          <SponsorForm
            sponsors={tournament.sponsors || []}
            onChange={(sponsors) =>
              updateTournamentProps(tournament.id, { sponsors })
            }
            maxSponsors={6}
          />
        </div>
      )}

      {/* Content */}
      {tournament.format === "group-playoff" && tournament.phaseConfigs?.length ? (
        /* Multi-phase group-playoff */
        <Tabs defaultValue="phase1">
          <div className="flex items-center gap-2">
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
              {isTabVisible("stats") && showStats && <TabsTrigger value="stats">Estadisticas</TabsTrigger>}
            </TabsList>
          </div>
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
              <MatchSchedule tournament={tournament} canEdit={canEdit} />
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
        <Tabs defaultValue="groups">
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="groups">Grupos</TabsTrigger>
              {isTabVisible("playoffs") && <TabsTrigger value="playoffs">Playoffs</TabsTrigger>}
              {isTabVisible("schedule") && <TabsTrigger value="schedule">Calendario</TabsTrigger>}
              {canEdit && <TabsTrigger value="dates">Fechas</TabsTrigger>}
              {isTabVisible("teams") && isAuthenticated && <TabsTrigger value="teams">Equipos</TabsTrigger>}
              {isTabVisible("stats") && showStats && <TabsTrigger value="stats">Estadisticas</TabsTrigger>}
            </TabsList>
          </div>
          <TabsContent value="groups" className="mt-4">
            <GroupStageView tournament={tournament} canEdit={canEdit} />
          </TabsContent>
          {isTabVisible("playoffs") && (
            <TabsContent value="playoffs" className="mt-4">
              <PlayoffBracketView tournament={tournament} canEdit={canEdit} />
            </TabsContent>
          )}
          {isTabVisible("schedule") && (
            <TabsContent value="schedule" className="mt-4">
              <MatchSchedule tournament={tournament} canEdit={canEdit} />
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
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="bracket">Bracket</TabsTrigger>
              {isTabVisible("schedule") && <TabsTrigger value="matches">Partidos</TabsTrigger>}
              {canEdit && <TabsTrigger value="dates">Fechas</TabsTrigger>}
              {isTabVisible("teams") && isAuthenticated && <TabsTrigger value="teams">Equipos</TabsTrigger>}
              {isTabVisible("stats") && showStats && <TabsTrigger value="stats">Estadisticas</TabsTrigger>}
            </TabsList>
          </div>
          <TabsContent value="bracket" className="mt-4">
            <BracketView tournament={tournament} canEdit={canEdit} />
          </TabsContent>
          {isTabVisible("schedule") && (
            <TabsContent value="matches" className="mt-4">
              <MatchSchedule tournament={tournament} canEdit={canEdit} />
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
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="groups">Grupos</TabsTrigger>
              {isTabVisible("schedule") && <TabsTrigger value="schedule">Calendario</TabsTrigger>}
              {canEdit && <TabsTrigger value="dates">Fechas</TabsTrigger>}
              {isTabVisible("teams") && isAuthenticated && <TabsTrigger value="teams">Equipos</TabsTrigger>}
              {isTabVisible("stats") && showStats && <TabsTrigger value="stats">Estadisticas</TabsTrigger>}
            </TabsList>
          </div>
          <TabsContent value="groups" className="mt-4">
            <GroupStageView tournament={tournament} canEdit={canEdit} />
          </TabsContent>
          {isTabVisible("schedule") && (
            <TabsContent value="schedule" className="mt-4">
              <MatchSchedule tournament={tournament} canEdit={canEdit} />
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
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="standings">Clasificacion</TabsTrigger>
              {isTabVisible("schedule") && <TabsTrigger value="schedule">Calendario</TabsTrigger>}
              {canEdit && <TabsTrigger value="dates">Fechas</TabsTrigger>}
              {isTabVisible("teams") && isAuthenticated && <TabsTrigger value="teams">Equipos</TabsTrigger>}
              {isTabVisible("stats") && showStats && <TabsTrigger value="stats">Estadisticas</TabsTrigger>}
            </TabsList>
          </div>
          <TabsContent value="standings" className="mt-4">
            {sportCategory === "baseball" ? (
              <BaseballStandingsTable tournament={tournament} />
            ) : sportCategory === "basketball" ? (
              <BasketballStandingsTable tournament={tournament} />
            ) : sportCategory === "volleyball" ? (
              <VolleyballStandingsTable tournament={tournament} />
            ) : (
              <StandingsTable tournament={tournament} />
            )}
          </TabsContent>
          {isTabVisible("schedule") && (
            <TabsContent value="schedule" className="mt-4">
              <MatchSchedule tournament={tournament} canEdit={canEdit} />
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
  if (hasMatches) {
    return <GroupStageView tournament={tournament} phase={phase} canEdit={canEdit} />;
  }

  // STATE 2 — Teams assigned but no fixture yet: offer to generate matches.
  if (hasTeams) {
    if (!canEdit) {
      return (
        <p className="text-sm text-muted-foreground text-center py-8">
          Esperando que el organizador genere los partidos de la fase {phase}.
        </p>
      );
    }
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div>
          <p className="text-base font-medium">Fase {phase} lista para generar partidos</p>
          <p className="text-sm text-muted-foreground">
            Los equipos ya están asignados a los grupos. Generá el fixture
            todos-contra-todos automáticamente.
          </p>
        </div>
        <Button disabled={generating} onClick={onGenerateClick}>
          {generating ? "Generando..." : `Generar partidos de fase ${phase}`}
        </Button>
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
        Configurar fase {phase}
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
