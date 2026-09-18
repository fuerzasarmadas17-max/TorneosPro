"use client";

import { useState } from "react";
import { Tournament } from "@/types";
import { useTournaments } from "@/context/tournament-context";
import { PlayoffBracketView } from "./playoff-bracket-view";
import { CupsConfigDialog } from "@/components/tournaments/cups-config-dialog";
import { TeamMark } from "@/components/teams/team-mark";
import { Button } from "@/components/ui/button";
import { canEditCups, getCupChampions, previewCups } from "@/lib/copas";
import { cn } from "@/lib/utils";
import { Settings2, Trophy } from "lucide-react";

interface CupsViewProps {
  tournament: Tournament;
  canEdit: boolean;
}

/**
 * La pestaña de playoffs de un torneo con varias copas: una pestaña por copa,
 * cada una con su llave (la misma vista de la llave única, recortada a la
 * copa) y su campeón cuando lo tiene.
 *
 * Antes de que terminen los grupos muestra de qué puestos sale cada copa y
 * cuántos equipos va a tener, que es lo que el organizador necesita ver
 * mientras tanto.
 */
export function CupsView({ tournament, canEdit }: CupsViewProps) {
  const { getTeamById } = useTournaments();
  const cups = tournament.cups ?? [];
  const [activeId, setActiveId] = useState<string>(cups[0]?.id ?? "");
  const [configOpen, setConfigOpen] = useState(false);

  const active = cups.find((c) => c.id === activeId) ?? cups[0];
  const champions = getCupChampions(tournament);
  const editable = canEdit && canEditCups(tournament);

  const configButton = editable ? (
    <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
      <Settings2 className="h-4 w-4 mr-2" />
      Configurar copas
    </Button>
  ) : null;

  const configDialog = configOpen ? (
    <CupsConfigDialog open={configOpen} onOpenChange={setConfigOpen} tournament={tournament} />
  ) : null;

  // Grupos sin terminar: el resumen de cada copa.
  if (!tournament.groupStageComplete) {
    const preview = previewCups(tournament, cups);
    return (
      <div className="space-y-4">
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-lg font-medium mb-1">Copas pendientes</p>
          <p className="text-sm">
            Cuando termine la fase de grupos se arman los cruces de cada copa.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {preview.map((p, i) => (
            <div key={cups[i].id} className="rounded-lg border p-4 space-y-1">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
                <p className="font-medium">{cups[i].name}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                {cups[i].positionFrom === cups[i].positionTo
                  ? `El ${cups[i].positionFrom}º de cada grupo`
                  : `Del ${cups[i].positionFrom}º al ${cups[i].positionTo}º de cada grupo`}
                {" · "}
                {p.teams} {p.teams === 1 ? "equipo" : "equipos"}
              </p>
            </div>
          ))}
        </div>
        {configButton && <div className="flex justify-center">{configButton}</div>}
        {configDialog}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Una pestaña por copa. El trofeo marca las que ya tienen campeón. */}
      <div className="flex flex-wrap items-center gap-2">
        {cups.map((c) => {
          const done = champions.find((x) => x.cup.id === c.id)?.championId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveId(c.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors inline-flex items-center gap-1.5",
                active?.id === c.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-accent"
              )}
              aria-pressed={active?.id === c.id}
            >
              {done && <Trophy className="h-3.5 w-3.5" />}
              {c.name}
            </button>
          );
        })}
        {configButton && <div className="ml-auto">{configButton}</div>}
      </div>

      {active && (() => {
        const championId = champions.find((x) => x.cup.id === active.id)?.championId;
        const champion = championId ? getTeamById(championId) : undefined;
        return (
          <>
            {championId && (
              <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <Trophy className="h-5 w-5 text-amber-500 shrink-0" />
                <TeamMark team={champion} size={28} />
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Campeón · {active.name}
                  </p>
                  <p className="font-semibold truncate">{champion?.name ?? "—"}</p>
                </div>
              </div>
            )}
            <PlayoffBracketView
              key={active.id}
              tournament={tournament}
              canEdit={canEdit}
              cup={active}
            />
          </>
        );
      })()}
      {configDialog}
    </div>
  );
}
