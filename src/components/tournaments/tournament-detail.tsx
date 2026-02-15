"use client";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BracketView } from "@/components/brackets/bracket-view";
import { PlayoffBracketView } from "@/components/brackets/playoff-bracket-view";
import { StandingsTable } from "@/components/standings/standings-table";
import { BaseballStandingsTable } from "@/components/standings/baseball-standings-table";
import { BasketballStandingsTable } from "@/components/standings/basketball-standings-table";
import { VolleyballStandingsTable } from "@/components/standings/volleyball-standings-table";
import { GroupStageView } from "@/components/standings/group-stage-view";
import { MatchSchedule } from "@/components/standings/match-schedule";
import { TournamentStats } from "@/components/standings/tournament-stats";
import { TeamRosterDialog } from "@/components/tournaments/team-roster-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTournaments } from "@/context/tournament-context";
import { getSportInfo } from "@/data/sports";
import { getSportCategory, Tournament, Sponsor } from "@/types";
import { SponsorBanner } from "@/components/sponsors/sponsor-banner";
import { SponsorForm } from "@/components/sponsors/sponsor-form";
import { Download } from "lucide-react";
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

function downloadPlayerTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Nombre", "Apellido 1", "Apellido 2", "Edad"],
    ["", "", "", ""],
  ]);
  ws["!cols"] = [{ wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Jugadores");
  XLSX.writeFile(wb, "Plantilla_Jugadores.xlsx");
}

function TeamsRosterSection({
  teamIds,
  canEdit,
  maxPlayers,
}: {
  teamIds: string[];
  canEdit: boolean;
  maxPlayers?: number;
}) {
  const { getTeamById } = useTournaments();

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={downloadPlayerTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Descargar plantilla Excel
          </Button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teamIds.map((teamId) => {
          const team = getTeamById(teamId);
          if (!team) return null;
          return (
            <Card key={teamId}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(team.primaryColor || team.secondaryColor) && (
                      <div className="w-6 h-6 rounded border border-border overflow-hidden flex shrink-0">
                        <div
                          className="w-1/2 h-full"
                          style={{
                            backgroundColor: team.primaryColor || "#fff",
                          }}
                        />
                        <div
                          className="w-1/2 h-full"
                          style={{
                            backgroundColor: team.secondaryColor || "#000",
                          }}
                        />
                      </div>
                    )}
                    <CardTitle className="text-base">{team.name}</CardTitle>
                  </div>
                  {canEdit && (
                    <TeamRosterDialog team={team} maxPlayers={maxPlayers} />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {team.players.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sin jugadores registrados
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {team.players.map((player, i) => (
                      <li
                        key={player.id}
                        className="text-sm flex items-center gap-2"
                      >
                        <span className="text-muted-foreground text-xs w-5">
                          {i + 1}.
                        </span>
                        {player.name}
                        {player.age && (
                          <span className="text-xs text-muted-foreground">
                            ({player.age})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

interface TournamentDetailProps {
  tournament: Tournament;
  canEdit: boolean;
  canEditSponsors?: boolean;
  orgSponsors?: Sponsor[];
}

export function TournamentDetail({
  tournament,
  canEdit,
  canEditSponsors,
  orgSponsors,
}: TournamentDetailProps) {
  const { updateTournamentProps } = useTournaments();
  const sport = getSportInfo(tournament.sport);
  const sportCategory = getSportCategory(tournament.sport);
  const showStats = (tournament.enabledStats?.length ?? 0) > 0;

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
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {sport?.emoji} {sport?.label}
          </Badge>
          <Badge variant="outline">{formatLabels[tournament.format]}</Badge>
          <Badge className={statusColors[tournament.status]}>
            {statusLabels[tournament.status]}
          </Badge>
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
      </div>

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
          />
        </div>
      )}

      {/* Content */}
      {tournament.format === "group-playoff" ? (
        <Tabs defaultValue="groups">
          <TabsList>
            <TabsTrigger value="groups">Grupos</TabsTrigger>
            <TabsTrigger value="playoffs">Playoffs</TabsTrigger>
            <TabsTrigger value="schedule">Calendario</TabsTrigger>
            <TabsTrigger value="teams">Equipos</TabsTrigger>
            {showStats && (
              <TabsTrigger value="stats">Estadisticas</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="groups" className="mt-4">
            <GroupStageView tournament={tournament} />
          </TabsContent>
          <TabsContent value="playoffs" className="mt-4">
            <PlayoffBracketView tournament={tournament} canEdit={canEdit} />
          </TabsContent>
          <TabsContent value="schedule" className="mt-4">
            <MatchSchedule tournament={tournament} canEdit={canEdit} />
          </TabsContent>
          <TabsContent value="teams" className="mt-4">
            <TeamsRosterSection
              teamIds={tournament.teamIds}
              canEdit={canEdit}
              maxPlayers={tournament.maxPlayersPerTeam}
            />
          </TabsContent>
          {showStats && (
            <TabsContent value="stats" className="mt-4">
              <TournamentStats tournament={tournament} canEdit={canEdit} />
            </TabsContent>
          )}
        </Tabs>
      ) : tournament.format === "elimination" ? (
        <Tabs defaultValue="bracket">
          <TabsList>
            <TabsTrigger value="bracket">Bracket</TabsTrigger>
            <TabsTrigger value="matches">Partidos</TabsTrigger>
            <TabsTrigger value="teams">Equipos</TabsTrigger>
            {showStats && (
              <TabsTrigger value="stats">Estadisticas</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="bracket" className="mt-4">
            <BracketView tournament={tournament} canEdit={canEdit} />
          </TabsContent>
          <TabsContent value="matches" className="mt-4">
            <MatchSchedule tournament={tournament} canEdit={canEdit} />
          </TabsContent>
          <TabsContent value="teams" className="mt-4">
            <TeamsRosterSection
              teamIds={tournament.teamIds}
              canEdit={canEdit}
              maxPlayers={tournament.maxPlayersPerTeam}
            />
          </TabsContent>
          {showStats && (
            <TabsContent value="stats" className="mt-4">
              <TournamentStats tournament={tournament} canEdit={canEdit} />
            </TabsContent>
          )}
        </Tabs>
      ) : tournament.groups && tournament.groups.length > 0 ? (
        <Tabs defaultValue="groups">
          <TabsList>
            <TabsTrigger value="groups">Grupos</TabsTrigger>
            <TabsTrigger value="schedule">Calendario</TabsTrigger>
            <TabsTrigger value="teams">Equipos</TabsTrigger>
            {showStats && (
              <TabsTrigger value="stats">Estadisticas</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="groups" className="mt-4">
            <GroupStageView tournament={tournament} />
          </TabsContent>
          <TabsContent value="schedule" className="mt-4">
            <MatchSchedule tournament={tournament} canEdit={canEdit} />
          </TabsContent>
          <TabsContent value="teams" className="mt-4">
            <TeamsRosterSection
              teamIds={tournament.teamIds}
              canEdit={canEdit}
              maxPlayers={tournament.maxPlayersPerTeam}
            />
          </TabsContent>
          {showStats && (
            <TabsContent value="stats" className="mt-4">
              <TournamentStats tournament={tournament} canEdit={canEdit} />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <Tabs defaultValue="standings">
          <TabsList>
            <TabsTrigger value="standings">Clasificacion</TabsTrigger>
            <TabsTrigger value="schedule">Calendario</TabsTrigger>
            <TabsTrigger value="teams">Equipos</TabsTrigger>
            {showStats && (
              <TabsTrigger value="stats">Estadisticas</TabsTrigger>
            )}
          </TabsList>
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
          <TabsContent value="schedule" className="mt-4">
            <MatchSchedule tournament={tournament} canEdit={canEdit} />
          </TabsContent>
          <TabsContent value="teams" className="mt-4">
            <TeamsRosterSection
              teamIds={tournament.teamIds}
              canEdit={canEdit}
              maxPlayers={tournament.maxPlayersPerTeam}
            />
          </TabsContent>
          {showStats && (
            <TabsContent value="stats" className="mt-4">
              <TournamentStats tournament={tournament} canEdit={canEdit} />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
