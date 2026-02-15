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
import { useBaseballStandings } from "@/hooks/use-baseball-standings";
import { useTournaments } from "@/context/tournament-context";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface BaseballStandingsTableProps {
  tournament: Tournament;
}

export function BaseballStandingsTable({ tournament }: BaseballStandingsTableProps) {
  const standings = useBaseballStandings(tournament);
  const { getTeamById } = useTournaments();

  return (
    <ScrollArea className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Equipo</TableHead>
            <TableHead className="text-center w-10">JJ</TableHead>
            <TableHead className="text-center w-10">JG</TableHead>
            <TableHead className="text-center w-10">JP</TableHead>
            <TableHead className="text-center w-14 font-bold">PCT</TableHead>
            <TableHead className="text-center w-12">GB</TableHead>
            <TableHead className="text-center w-10">CA</TableHead>
            <TableHead className="text-center w-10">CE</TableHead>
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
                  {team?.name || entry.teamId}
                </TableCell>
                <TableCell className="text-center">{entry.played}</TableCell>
                <TableCell className="text-center">{entry.won}</TableCell>
                <TableCell className="text-center">{entry.lost}</TableCell>
                <TableCell className="text-center font-bold">
                  {entry.pct.toFixed(3).replace(/^0/, "")}
                </TableCell>
                <TableCell className="text-center">
                  {entry.gb === 0 ? "-" : entry.gb % 1 === 0 ? entry.gb : entry.gb.toFixed(1)}
                </TableCell>
                <TableCell className="text-center">{entry.runsFor}</TableCell>
                <TableCell className="text-center">{entry.runsAgainst}</TableCell>
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
