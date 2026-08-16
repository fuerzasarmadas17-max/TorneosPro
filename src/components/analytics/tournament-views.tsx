"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tournament } from "@/types";

interface TournamentViewEntry {
  tournament_id: string;
  views: number;
  unique_visitors: number;
  unique_persons: number;
}

interface TournamentViewsProps {
  data: TournamentViewEntry[];
  tournaments: Tournament[];
}

export function TournamentViews({ data, tournaments }: TournamentViewsProps) {
  const enriched = data
    .map((entry) => {
      const t = tournaments.find((t) => t.id === entry.tournament_id);
      return { ...entry, name: t?.name || "Torneo eliminado" };
    })
    .sort((a, b) => b.views - a.views);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Visitas por Torneo</CardTitle>
      </CardHeader>
      <CardContent>
        {enriched.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin visitas registradas
          </p>
        ) : (
          <div className="space-y-3">
            {enriched.map((entry) => (
              <div
                key={entry.tournament_id}
                className="flex items-center justify-between gap-2 sm:gap-4"
              >
                <Link
                  href={`/tournaments/${entry.tournament_id}`}
                  className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                >
                  {entry.name}
                </Link>
                <div className="flex shrink-0 gap-2 text-xs text-muted-foreground whitespace-nowrap sm:gap-4 sm:text-sm">
                  <span>{entry.views} visitas</span>
                  <span>{entry.unique_persons ?? 0} personas</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
