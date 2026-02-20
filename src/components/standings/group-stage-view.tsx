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
  phase?: number;
}

export function GroupStageView({ tournament, phase }: GroupStageViewProps) {
  const sportCategory = getSportCategory(tournament.sport);

  // Filter groups by phase if specified
  const groups = phase != null
    ? tournament.groups?.filter((g) => g.phase === phase)
    : tournament.groups;

  // Determine completion status
  const isComplete = phase != null
    ? tournament.phaseConfigs?.find((pc) => pc.phase === phase)?.complete
    : tournament.groupStageComplete;

  const completionLabel = phase != null
    ? `Fase ${phase} completada`
    : "Fase de grupos completada - Playoffs generados";

  return (
    <div className="space-y-6">
      {isComplete && (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
          {completionLabel}
        </Badge>
      )}

      {groups?.map((group) => {
        const groupMatches = tournament.matches.filter(
          (m) => m.phase === "group" && m.groupId === group.id
        );

        // Skip groups with no matches and no teams (empty Phase 2 groups)
        if (group.teamIds.length === 0 && groupMatches.length === 0) return null;

        const groupTournament: Tournament = {
          ...tournament,
          teamIds: group.teamIds,
          matches: groupMatches,
        };

        return (
          <Card key={group.id}>
            <CardHeader>
              <CardTitle className="text-lg">{group.name}</CardTitle>
            </CardHeader>
            <CardContent>
              {group.teamIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Pendiente — los equipos se asignaran cuando la fase anterior se complete
                </p>
              ) : sportCategory === "baseball" ? (
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
