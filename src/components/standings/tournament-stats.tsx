"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tournament } from "@/types";
import { useTournamentStats, CardEntry } from "@/hooks/use-tournament-stats";
import { useTournaments } from "@/context/tournament-context";

interface TournamentStatsProps {
  tournament: Tournament;
  canEdit?: boolean;
}

export function TournamentStats({ tournament, canEdit }: TournamentStatsProps) {
  const { leaderboards, hasStats, cardEntries } = useTournamentStats(tournament);
  const { getTeamById, updateEventPaid } = useTournaments();

  // Determine if cards/ejections are enabled
  const hasCardStats =
    tournament.enabledStats?.includes("yellow_card") ||
    tournament.enabledStats?.includes("red_card") ||
    tournament.enabledStats?.includes("ejection") ||
    tournament.enabledStats?.includes("blue_card");

  // Filter cards based on view: creator sees all, public sees only unpaid
  const visibleCards: CardEntry[] = canEdit
    ? cardEntries
    : cardEntries.filter((c) => !c.paid);

  // Non-card leaderboards (exclude yellow_card, red_card, ejection)
  const nonCardLeaderboards = leaderboards.filter(
    (lb) => lb.statKey !== "yellow_card" && lb.statKey !== "red_card" && lb.statKey !== "ejection" && lb.statKey !== "blue_card"
  );

  const hasNonCardStats = nonCardLeaderboards.some(
    (lb) => lb.leaders.length > 0 || lb.teamLeaders.length > 0
  );

  if (!hasStats && visibleCards.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            No hay estadisticas registradas aun.
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            Agrega eventos al ingresar resultados de partidos.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleTogglePaid = (card: CardEntry) => {
    updateEventPaid(tournament.id, card.matchId, card.eventId, !card.paid);
  };

  return (
    <div className="space-y-6">
      {/* Card payment table */}
      {hasCardStats && visibleCards.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sanciones</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jugador</TableHead>
                  <TableHead>Equipo</TableHead>
                  <TableHead className="text-center">Tipo</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleCards.map((card) => {
                  const team = getTeamById(card.teamId);
                  const badgeClass =
                    card.type === "yellow_card"
                      ? "bg-yellow-400/20 text-yellow-600 border-yellow-400/30"
                      : card.type === "red_card"
                      ? "bg-red-500/20 text-red-600 border-red-500/30"
                      : card.type === "blue_card"
                      ? "bg-blue-400/20 text-blue-600 border-blue-400/30"
                      : "bg-red-700/20 text-red-700 border-red-700/30";
                  const badgeLabel =
                    card.type === "yellow_card"
                      ? "Amarilla"
                      : card.type === "red_card"
                      ? "Roja"
                      : card.type === "blue_card"
                      ? "Azul"
                      : "Expulsion";
                  return (
                    <TableRow
                      key={card.eventId}
                      className={card.paid ? "opacity-50" : ""}
                    >
                      <TableCell className="font-medium">
                        {card.playerName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {team?.name || card.teamId}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={badgeClass}>
                          {badgeLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => handleTogglePaid(card)}
                            className="cursor-pointer"
                          >
                            <Badge
                              className={
                                card.paid
                                  ? "bg-green-500/20 text-green-600 border-green-500/30"
                                  : "bg-orange-500/20 text-orange-600 border-orange-500/30"
                              }
                            >
                              {card.paid ? "Pagado" : "Sin Pagar"}
                            </Badge>
                          </button>
                        ) : (
                          <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30">
                            Sin Pagar
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {hasCardStats && visibleCards.length === 0 && cardEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sanciones</CardTitle>
          </CardHeader>
          <CardContent className="py-4 text-center">
            <p className="text-sm text-muted-foreground">
              Todas las sanciones estan pagadas.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Non-card leaderboards */}
      {hasNonCardStats && (
        <div className="grid gap-6 md:grid-cols-2">
          {nonCardLeaderboards.map((lb) => {
            if (lb.computed) {
              if (lb.teamLeaders.length === 0) return null;
              return (
                <Card key={lb.statKey}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{lb.pluralLabel}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Equipo</TableHead>
                          <TableHead className="text-center w-12">PJ</TableHead>
                          <TableHead className="text-center w-12">
                            {lb.label}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lb.teamLeaders.map((entry, index) => {
                          const team = getTeamById(entry.teamId);
                          return (
                            <TableRow key={entry.teamId}>
                              <TableCell className="font-medium">
                                {index + 1}
                              </TableCell>
                              <TableCell className="font-medium">
                                {team?.name || entry.teamId}
                              </TableCell>
                              <TableCell className="text-center">
                                {entry.matchesPlayed}
                              </TableCell>
                              <TableCell className="text-center font-bold">
                                {entry.value}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            }

            if (lb.leaders.length === 0) return null;
            return (
              <Card key={lb.statKey}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{lb.pluralLabel}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Jugador</TableHead>
                        <TableHead>Equipo</TableHead>
                        <TableHead className="text-center w-14">
                          {lb.label}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lb.leaders.map((entry, index) => {
                        const team = getTeamById(entry.teamId);
                        return (
                          <TableRow
                            key={`${entry.playerName}-${entry.teamId}`}
                          >
                            <TableCell className="font-medium">
                              {index + 1}
                            </TableCell>
                            <TableCell className="font-medium">
                              {entry.playerName}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {team?.name || entry.teamId}
                            </TableCell>
                            <TableCell className="text-center font-bold">
                              {entry.count}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
