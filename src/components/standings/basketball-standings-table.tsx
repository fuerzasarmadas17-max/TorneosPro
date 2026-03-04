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
import { useBasketballStandings } from "@/hooks/use-basketball-standings";
import { useTournaments } from "@/context/tournament-context";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Info } from "lucide-react";

interface BasketballStandingsTableProps {
  tournament: Tournament;
}

function ScoringRulesDialog() {
  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Sistema de Puntos - Basketball</DialogTitle>
      </DialogHeader>
      <div className="space-y-5 text-sm">
        <div>
          <h4 className="font-semibold mb-2">Puntuación</h4>
          <p className="text-muted-foreground">
            No hay sistema de puntos. La posición se determina por el porcentaje de victorias (Pct).
          </p>
        </div>

        <div>
          <h4 className="font-semibold mb-2">Columnas de la Tabla</h4>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <span className="font-mono font-medium">G</span><span>Partidos ganados</span>
            <span className="font-mono font-medium">P</span><span>Partidos perdidos</span>
            <span className="font-mono font-bold">Pct</span><span>Porcentaje de victorias (G / total)</span>
            <span className="font-mono font-medium">GB</span><span>Games behind (juegos detras del lider)</span>
            <span className="font-mono font-medium">PF</span><span>Puntos a favor</span>
            <span className="font-mono font-medium">PC</span><span>Puntos en contra</span>
            <span className="font-mono font-medium">DIF</span><span>Diferencial de puntos (PF – PC)</span>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-2">Criterios de Desempate</h4>
          <p className="text-muted-foreground mb-2">
            Cuando dos o mas equipos tienen el mismo Pct:
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Mejor diferencial de puntos</li>
            <li>Mayor cantidad de puntos anotados</li>
            <li>Resultado directo entre los equipos empatados</li>
          </ol>
        </div>
      </div>
    </DialogContent>
  );
}

export function BasketballStandingsTable({
  tournament,
}: BasketballStandingsTableProps) {
  const standings = useBasketballStandings(tournament);
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
    </div>
  );
}
