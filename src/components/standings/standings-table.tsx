"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tournament } from "@/types";
import { useStandings } from "@/hooks/use-standings";
import { useTournaments } from "@/context/tournament-context";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { TableWatermark } from "./table-watermark";
import { Info } from "lucide-react";

interface StandingsTableProps {
  tournament: Tournament;
}

function ScoringRulesDialog() {
  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden grid-rows-[auto_minmax(0,1fr)]">
      <DialogHeader>
        <DialogTitle>Sistema de Puntos - Fútbol</DialogTitle>
      </DialogHeader>
      <div className="space-y-5 text-sm overflow-y-auto min-h-0 pr-1">
        <div>
          <h4 className="font-semibold mb-2">Puntuación por partido</h4>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2">Resultado</th>
                  <th className="text-center px-3 py-2">Puntos</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="px-3 py-2">Victoria</td>
                  <td className="text-center px-3 py-2 font-bold text-green-600">3 pts</td>
                </tr>
                <tr className="border-t">
                  <td className="px-3 py-2">Empate</td>
                  <td className="text-center px-3 py-2 text-yellow-600">1 pt</td>
                </tr>
                <tr className="border-t">
                  <td className="px-3 py-2">Derrota</td>
                  <td className="text-center px-3 py-2 text-muted-foreground">0 pts</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-2">Columnas de la Tabla</h4>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <span className="font-mono font-medium">PJ</span><span>Partidos jugados</span>
            <span className="font-mono font-medium">PG</span><span>Partidos ganados</span>
            <span className="font-mono font-medium">PE</span><span>Partidos empatados</span>
            <span className="font-mono font-medium">PP</span><span>Partidos perdidos</span>
            <span className="font-mono font-medium">GF</span><span>Goles a favor</span>
            <span className="font-mono font-medium">GC</span><span>Goles en contra</span>
            <span className="font-mono font-medium">DG</span><span>Diferencia de goles (GF – GC)</span>
            <span className="font-mono font-bold">Pts</span><span>Puntos en la tabla</span>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-2">Criterios de Desempate</h4>
          <p className="text-muted-foreground mb-2">
            Cuando dos o mas equipos tienen los mismos puntos, el orden se define asi:
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Mejor diferencia de goles</li>
            <li>Mayor cantidad de goles a favor</li>
            <li>Mayor numero de victorias</li>
            <li>Resultado directo entre los equipos empatados</li>
          </ol>
        </div>
      </div>
    </DialogContent>
  );
}

export function StandingsTable({ tournament }: StandingsTableProps) {
  const standings = useStandings(tournament);
  const { getTeamById } = useTournaments();

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Info className="h-3.5 w-3.5" />
              Sistema de puntos
            </Button>
          </DialogTrigger>
          <ScoringRulesDialog />
        </Dialog>
      </div>
      <div className="relative">
      <TableWatermark />
      <ScrollArea className="w-full relative z-10">
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
      </div>
    </div>
  );
}
