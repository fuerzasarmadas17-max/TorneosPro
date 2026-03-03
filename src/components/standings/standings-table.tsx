"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tournament } from "@/types";
import { useStandings } from "@/hooks/use-standings";
import { useTournaments } from "@/context/tournament-context";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface StandingsTableProps {
  tournament: Tournament;
}

export function StandingsTable({ tournament }: StandingsTableProps) {
  const standings = useStandings(tournament);
  const { getTeamById } = useTournaments();

  return (
    <ScrollArea className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Equipo</TableHead>
            <TableHead className="text-center w-10">PJ</TableHead>
            <TableHead className="text-center w-10">PG</TableHead>
            <TableHead className="text-center w-10">PE</TableHead>
            <TableHead className="text-center w-10">PP</TableHead>
            <TableHead className="text-center w-10">GF</TableHead>
            <TableHead className="text-center w-10">GC</TableHead>
            <TableHead className="text-center w-10">DG</TableHead>
            <TableHead className="text-center w-12 font-bold">Pts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {standings.map((entry, index) => {
            const team = getTeamById(entry.teamId);
            return (
              <TableRow key={entry.teamId}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-1.5">
                    {team?.name || entry.teamId}
                    {tournament.disqualifiedTeamIds?.includes(entry.teamId) && (
                      <span className="text-[10px] font-semibold text-destructive">DQ</span>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-center">{entry.played}</TableCell>
                <TableCell className="text-center">{entry.won}</TableCell>
                <TableCell className="text-center">{entry.drawn}</TableCell>
                <TableCell className="text-center">{entry.lost}</TableCell>
                <TableCell className="text-center">{entry.goalsFor}</TableCell>
                <TableCell className="text-center">
                  {entry.goalsAgainst}
                </TableCell>
                <TableCell className="text-center">
                  {entry.goalDifference > 0
                    ? `+${entry.goalDifference}`
                    : entry.goalDifference}
                </TableCell>
                <TableCell className="text-center font-bold">
                  {entry.points}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
