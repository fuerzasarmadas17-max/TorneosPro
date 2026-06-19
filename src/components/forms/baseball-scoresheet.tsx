"use client";

import type { KeyboardEvent } from "react";
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

/**
 * Convención MLB: en el scoresheet `v.hit` representa el TOTAL de hits
 * del bateador (incluyendo sencillos, 2B, 3B y HR). Los hits especiales
 * (`double`, `triple`, `home_run`) son un subset que se cuenta aparte
 * para SLG y para mostrar el desglose en la tabla. Los sencillos no se
 * almacenan: se deducen como `hit - double - triple - home_run`.
 */
function totalHits(v: Record<string, number>) {
  return v.hit ?? 0;
}

/** Suma los hits "extra-base" cargados explícitamente (2B + 3B + HR).
 *  Sirve para validar que el H total no quede por debajo del subset. */
function extraBaseHits(v: Record<string, number>) {
  return (v.double ?? 0) + (v.triple ?? 0) + (v.home_run ?? 0);
}

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
    "at_bat", "hit", "double", "triple", "home_run",
    "walk", "rbi", "run_scored",
    "error", "strikeout", "ejection",
  ];

  const enabledSet = new Set(stats);
  const filteredStats = BASEBALL_STAT_ORDER.filter(
    (s) => enabledSet.has(s) && !getStatDefinition(s)?.computed
  );

  // Navegación por teclado en la planilla. Cada celda tiene id
  // `bs-{teamId}-{fila}-{columna}`. Al enfocar se selecciona el valor
  // (escribir lo reemplaza; pasar de largo lo conserva — recomendación A).
  const focusCell = (row: number, col: number) => {
    const el = document.getElementById(
      `bs-${teamId}-${row}-${col}`
    ) as HTMLInputElement | null;
    if (el) {
      el.focus();
      el.select();
    }
  };
  const handleCellKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    row: number,
    col: number
  ) => {
    const maxRow = players.length - 1;
    const maxCol = filteredStats.length - 1;
    switch (e.key) {
      case "ArrowDown":
      case "Enter":
        e.preventDefault();
        focusCell(Math.min(row + 1, maxRow), col);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusCell(Math.max(row - 1, 0), col);
        break;
      case "ArrowLeft":
        e.preventDefault();
        focusCell(row, Math.max(col - 1, 0));
        break;
      case "ArrowRight":
        e.preventDefault();
        focusCell(row, Math.min(col + 1, maxCol));
        break;
    }
  };

  // H > AB is logically impossible; surface it without blocking the save —
  // the scorer might be entering hits before AB and will reconcile later.
  const inconsistentPlayers = enabledSet.has("at_bat")
    ? players.filter((p) => {
        const v = values[p.name] || {};
        return totalHits(v) > (v.at_bat ?? 0) && (v.at_bat ?? 0) > 0;
      })
    : [];

  // Convención MLB: 2B + 3B + HR son un subset de H. Si la suma supera
  // a H, hay un error de carga (no se pueden tener más extra-base que
  // hits totales). Lo marcamos pero no bloqueamos el save porque el
  // organizer puede estar a mitad de carga.
  const extraExceedsHPlayers = players.filter((p) => {
    const v = values[p.name] || {};
    return extraBaseHits(v) > totalHits(v) && extraBaseHits(v) > 0;
  });

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
                  {filteredStats.map((statKey, colIdx) => (
                    <TableCell key={statKey} className="p-1">
                      <Input
                        id={`bs-${teamId}-${idx}-${colIdx}`}
                        type="number"
                        min="0"
                        value={playerValues[statKey] || ""}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          onChange(player.name, statKey, val);
                        }}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => handleCellKeyDown(e, idx, colIdx)}
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
      {inconsistentPlayers.length > 0 && (
        <p className="text-xs text-amber-500">
          Revisa: H &gt; AB en {inconsistentPlayers.map((p) => p.name).join(", ")}
        </p>
      )}
      {extraExceedsHPlayers.length > 0 && (
        <p className="text-xs text-amber-500">
          Revisa: 2B + 3B + HR superan a H en{" "}
          {extraExceedsHPlayers.map((p) => p.name).join(", ")}.
          H debe incluir todos los hits (sencillos + extra-base).
        </p>
      )}
    </div>
  );
}

function getShortLabel(statKey: string): string {
  const labels: Record<string, string> = {
    at_bat: "AB",
    hit: "H",
    double: "2B",
    triple: "3B",
    home_run: "HR",
    walk: "BB",
    rbi: "RBI",
    run_scored: "R",
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
