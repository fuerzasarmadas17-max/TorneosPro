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
import { useBasketballStandings } from "@/hooks/use-basketball-standings";
import { useTournaments } from "@/context/tournament-context";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface BasketballStandingsTableProps {
  tournament: Tournament;
}

export function BasketballStandingsTable({
  tournament,
}: BasketballStandingsTableProps) {
  const standings = useBasketballStandings(tournament);
  const { getTeamById } = useTournaments();

  return (
    <ScrollArea className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Equipo</TableHead>
            <TableHead className="text-center w-10">G</TableHead>
            <TableHead className="text-center w-10">P</TableHead>
            <TableHead className="text-center w-14 font-bold">Pct</TableHead>
            <TableHead className="text-center w-12">GB</TableHead>
            <TableHead className="text-center w-10">PF</TableHead>
            <TableHead className="text-center w-10">PC</TableHead>
            <TableHead className="text-center w-12">DIF</TableHead>
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
                <TableCell className="text-center">{entry.won}</TableCell>
                <TableCell className="text-center">{entry.lost}</TableCell>
                <TableCell className="text-center font-bold">
                  {entry.pct.toFixed(3).replace(/^0/, "")}
                </TableCell>
                <TableCell className="text-center">
                  {entry.gb === 0
                    ? "-"
                    : entry.gb % 1 === 0
                    ? entry.gb
                    : entry.gb.toFixed(1)}
                </TableCell>
                <TableCell className="text-center">{entry.pointsFor}</TableCell>
                <TableCell className="text-center">{entry.pointsAgainst}</TableCell>
                <TableCell className="text-center">
                  {entry.diff > 0 ? `+${entry.diff}` : entry.diff}
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
