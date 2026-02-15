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
import { Input } from "@/components/ui/input";
import { MatchEventType, Player, getStatDefinition } from "@/types";

interface PlayerStats {
  [statKey: string]: number;
}

interface BaseballScoresheetProps {
  teamName: string;
  teamId: string;
  players: Player[];
  stats: MatchEventType[];
  values: Record<string, PlayerStats>;
  onChange: (playerName: string, stat: MatchEventType, count: number) => void;
}

export function BaseballScoresheet({
  teamName,
  teamId,
  players,
  stats,
  values,
  onChange,
}: BaseballScoresheetProps) {
  // Fixed order for baseball stats - only show enabled ones, in this order
  const BASEBALL_STAT_ORDER: MatchEventType[] = [
    "hit", "double", "triple", "home_run", "error", "strikeout", "ejection",
  ];

  const enabledSet = new Set(stats);
  const filteredStats = BASEBALL_STAT_ORDER.filter(
    (s) => enabledSet.has(s) && !getStatDefinition(s)?.computed
  );

  if (players.length === 0) {
    return (
      <div className="space-y-1">
        <h3 className="font-semibold text-sm">{teamName}</h3>
        <p className="text-sm text-muted-foreground text-center py-4 border rounded-md">
          Sin jugadores registrados. Agrega jugadores en la seccion Equipos del torneo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-sm">{teamName}</h3>
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 text-center">#</TableHead>
              <TableHead className="min-w-[140px]">Jugador</TableHead>
              {filteredStats.map((statKey) => {
                const def = getStatDefinition(statKey);
                return (
                  <TableHead
                    key={statKey}
                    className="text-center w-16 px-1"
                    title={def?.pluralLabel}
                  >
                    {getShortLabel(statKey)}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((player, idx) => {
              const playerValues = values[player.name] || {};
              return (
                <TableRow key={player.id}>
                  <TableCell className="text-center text-muted-foreground text-xs">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {player.name}
                  </TableCell>
                  {filteredStats.map((statKey) => (
                    <TableCell key={statKey} className="p-1">
                      <Input
                        type="number"
                        min="0"
                        value={playerValues[statKey] || ""}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          onChange(player.name, statKey, val);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.preventDefault();
                        }}
                        className="h-8 w-14 text-center text-sm mx-auto [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="0"
                      />
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function getShortLabel(statKey: string): string {
  const labels: Record<string, string> = {
    hit: "H",
    double: "2B",
    triple: "3B",
    home_run: "HR",
    error: "E",
    strikeout: "K",
    ejection: "EXP",
    goal: "G",
    assist: "A",
    yellow_card: "TA",
    red_card: "TR",
    point: "PTS",
    rebound: "REB",
    steal: "ROB",
    block: "BLK",
  };
  return labels[statKey] || statKey.substring(0, 3).toUpperCase();
}
