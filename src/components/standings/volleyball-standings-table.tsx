"use client";

import { useState } from "react";
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
import { useVolleyballStandings } from "@/hooks/use-volleyball-standings";
import { useTournaments } from "@/context/tournament-context";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { TableWatermark } from "./table-watermark";
import { Info } from "lucide-react";

interface VolleyballStandingsTableProps {
  tournament: Tournament;
}

function ScoringRulesDialog({ bestOf }: { bestOf: 3 | 5 }) {
  const setsToWin = Math.ceil(bestOf / 2);
  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden grid-rows-[auto_minmax(0,1fr)]">
      <DialogHeader>
        <DialogTitle>Sistema de Puntos - Volleyball</DialogTitle>
      </DialogHeader>
      <div className="space-y-5 text-sm overflow-y-auto min-h-0 pr-1">
        <div>
          <h4 className="font-semibold mb-2">Formato: Mejor de {bestOf} sets (primero a {setsToWin})</h4>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2">Resultado</th>
                  <th className="text-center px-3 py-2">Ganador</th>
                  <th className="text-center px-3 py-2">Perdedor</th>
                </tr>
              </thead>
              <tbody>
                {bestOf === 5 ? (
                  <>
                    <tr className="border-t">
                      <td className="px-3 py-2">Victoria 3–0 o 3–1</td>
                      <td className="text-center px-3 py-2 font-bold text-green-600">3 pts</td>
                      <td className="text-center px-3 py-2 text-muted-foreground">0 pts</td>
                    </tr>
                    <tr className="border-t">
                      <td className="px-3 py-2">Victoria 3–2</td>
                      <td className="text-center px-3 py-2 font-bold text-green-600">2 pts</td>
                      <td className="text-center px-3 py-2 text-yellow-600">1 pt</td>
                    </tr>
                  </>
                ) : (
                  <>
                    <tr className="border-t">
                      <td className="px-3 py-2">Victoria 2–0</td>
                      <td className="text-center px-3 py-2 font-bold text-green-600">3 pts</td>
                      <td className="text-center px-3 py-2 text-muted-foreground">0 pts</td>
                    </tr>
                    <tr className="border-t">
                      <td className="px-3 py-2">Victoria 2–1</td>
                      <td className="text-center px-3 py-2 font-bold text-green-600">2 pts</td>
                      <td className="text-center px-3 py-2 text-yellow-600">1 pt</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-2">Columnas de la Tabla</h4>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <span className="font-mono font-medium">PJ</span><span>Partidos jugados</span>
            <span className="font-mono font-medium">PG</span><span>Partidos ganados</span>
            <span className="font-mono font-medium">PP</span><span>Partidos perdidos</span>
            <span className="font-mono font-medium">SF</span><span>Sets a favor</span>
            <span className="font-mono font-medium">SC</span><span>Sets en contra</span>
            <span className="font-mono font-medium">DS</span><span>Diferencia de sets (SF – SC)</span>
            <span className="font-mono font-medium">PF</span><span>Puntos a favor (suma de puntos en cada set)</span>
            <span className="font-mono font-medium">PC</span><span>Puntos en contra</span>
            <span className="font-mono font-medium">DP</span><span>Diferencia de puntos (PF – PC)</span>
            <span className="font-mono font-bold">Pts</span><span>Puntos en la tabla (ranking)</span>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-2">Criterios de Desempate</h4>
          <p className="text-muted-foreground mb-2">
            Cuando dos o mas equipos tienen los mismos puntos, el orden se define asi:
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Mayor numero de partidos ganados</li>
            <li>Mejor diferencia de sets</li>
            <li>Mejor ratio de sets (SF / SC)</li>
            <li>Mejor diferencia de puntos</li>
            <li>Mejor ratio de puntos (PF / PC)</li>
            <li>Resultado directo entre los equipos empatados</li>
          </ol>
        </div>
      </div>
    </DialogContent>
  );
}

export function VolleyballStandingsTable({
  tournament,
}: VolleyballStandingsTableProps) {
  const standings = useVolleyballStandings(tournament);
  const { getTeamById } = useTournaments();
  const bestOf = tournament.bestOf ?? 3;

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
          <ScoringRulesDialog bestOf={bestOf as 3 | 5} />
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
            <TableHead className="text-center w-10">PP</TableHead>
            <TableHead className="text-center w-10">SF</TableHead>
            <TableHead className="text-center w-10">SC</TableHead>
            <TableHead className="text-center w-12">DS</TableHead>
            <TableHead className="text-center w-10">PF</TableHead>
            <TableHead className="text-center w-10">PC</TableHead>
            <TableHead className="text-center w-12">DP</TableHead>
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
                <TableCell className="text-center">{entry.lost}</TableCell>
                <TableCell className="text-center">{entry.setsFor}</TableCell>
                <TableCell className="text-center">
                  {entry.setsAgainst}
                </TableCell>
                <TableCell className="text-center">
                  {entry.setDiff > 0 ? `+${entry.setDiff}` : entry.setDiff}
                </TableCell>
                <TableCell className="text-center">
                  {entry.pointsFor}
                </TableCell>
                <TableCell className="text-center">
                  {entry.pointsAgainst}
                </TableCell>
                <TableCell className="text-center">
                  {entry.pointDiff > 0
                    ? `+${entry.pointDiff}`
                    : entry.pointDiff}
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
