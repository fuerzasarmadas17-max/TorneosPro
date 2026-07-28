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
import { useBaseballStandings } from "@/hooks/use-baseball-standings";
import { useTournaments } from "@/context/tournament-context";
import { TeamMark } from "@/components/teams/team-mark";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { TableWatermark } from "./table-watermark";
import { Info } from "lucide-react";
import { WalkoverRuleNote } from "@/components/standings/walkover-rule-note";

interface BaseballStandingsTableProps {
  tournament: Tournament;
}

function ScoringRulesDialog() {
  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden grid-rows-[auto_minmax(0,1fr)]">
      <DialogHeader>
        <DialogTitle>Sistema de Puntos - Béisbol</DialogTitle>
      </DialogHeader>
      <div className="space-y-5 text-sm overflow-y-auto min-h-0 pr-1">
        <div>
          <h4 className="font-semibold mb-2">Puntuación</h4>
          <p className="text-muted-foreground">
            No hay sistema de puntos. La posición se determina por el porcentaje de victorias (PCT).
          </p>
        </div>

        <div>
          <h4 className="font-semibold mb-2">Columnas de la Tabla</h4>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <span className="font-mono font-medium">JJ</span><span>Juegos jugados</span>
            <span className="font-mono font-medium">JG</span><span>Juegos ganados</span>
            <span className="font-mono font-medium">JP</span><span>Juegos perdidos</span>
            <span className="font-mono font-bold">PCT</span><span>Porcentaje de victorias (JG / JJ)</span>
            <span className="font-mono font-medium">GB</span><span>Games behind (juegos detras del lider)</span>
            <span className="font-mono font-medium">CA</span><span>Carreras anotadas</span>
            <span className="font-mono font-medium">CE</span><span>Carreras en contra</span>
            <span className="font-mono font-medium">DIF</span><span>Diferencial de carreras (CA – CE)</span>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-2">Criterios de Desempate</h4>
          <p className="text-muted-foreground mb-2">
            Cuando dos o mas equipos tienen el mismo PCT:
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Mejor diferencial de carreras</li>
            <li>Mayor cantidad de carreras anotadas</li>
            <li>Resultado directo entre los equipos empatados</li>
          </ol>
        </div>

        <div>
          <h4 className="font-semibold mb-2">Estadisticas individuales</h4>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <span className="font-mono font-medium">AB</span><span>Turnos al bate</span>
            <span className="font-mono font-medium">H</span><span>Hits totales (incluye 2B, 3B, HR)</span>
            <span className="font-mono font-medium">BB</span><span>Bases por bolas</span>
            <span className="font-mono font-medium">K</span><span>Ponches recibidos</span>
            <span className="font-mono font-medium">RBI</span><span>Carreras impulsadas</span>
            <span className="font-mono font-medium">R</span><span>Carreras anotadas</span>
            <span className="font-mono font-bold">AVG</span><span>Promedio de bateo (H / AB)</span>
            <span className="font-mono font-bold">OBP</span><span>On-base % ((H + BB) / (AB + BB))</span>
            <span className="font-mono font-bold">SLG</span><span>Slugging (Total Bases / AB)</span>
            <span className="font-mono font-bold">OPS</span><span>OBP + SLG</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            La tabla de stats individuales aparece en la pestaña Estadisticas si hay datos cargados.
          </p>
        </div>
        <WalkoverRuleNote sport="beisbol" />
      </div>
    </DialogContent>
  );
}

export function BaseballStandingsTable({ tournament }: BaseballStandingsTableProps) {
  const standings = useBaseballStandings(tournament);
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
                    <span className="flex items-center gap-2">
                      <TeamMark team={team} size={20} />
                      {team?.name || entry.teamId}
                      {tournament.disqualifiedTeamIds?.includes(entry.teamId) && (
                        <span className="text-[10px] font-semibold text-destructive">DQ</span>
                      )}
                    </span>
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
      </div>
    </div>
  );
}
