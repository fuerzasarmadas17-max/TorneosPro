"use client";

import { Tournament, getSportCategory } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StandingsTable } from "./standings-table";
import { BaseballStandingsTable } from "./baseball-standings-table";
import { BasketballStandingsTable } from "./basketball-standings-table";
import { VolleyballStandingsTable } from "./volleyball-standings-table";

interface GroupStageViewProps {
  tournament: Tournament;
}

export function GroupStageView({ tournament }: GroupStageViewProps) {
  const sportCategory = getSportCategory(tournament.sport);

  return (
    <div className="space-y-6">
      {tournament.groupStageComplete && (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
          Fase de grupos completada - Playoffs generados
        </Badge>
      )}

      {tournament.groups?.map((group) => {
        const groupTournament: Tournament = {
          ...tournament,
          teamIds: group.teamIds,
          matches: tournament.matches.filter(
            (m) => m.phase === "group" && m.groupId === group.id
          ),
        };

        return (
          <Card key={group.id}>
            <CardHeader>
              <CardTitle className="text-lg">{group.name}</CardTitle>
            </CardHeader>
            <CardContent>
              {sportCategory === "baseball" ? (
                <BaseballStandingsTable tournament={groupTournament} />
              ) : sportCategory === "basketball" ? (
                <BasketballStandingsTable tournament={groupTournament} />
              ) : sportCategory === "volleyball" ? (
                <VolleyballStandingsTable tournament={groupTournament} />
              ) : (
                <StandingsTable tournament={groupTournament} />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
