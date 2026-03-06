"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tournament } from "@/types";

interface TournamentViewEntry {
  tournament_id: string;
  views: number;
  unique_visitors: number;
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
                className="flex items-center justify-between gap-4"
              >
                <Link
                  href={`/tournaments/${entry.tournament_id}`}
                  className="text-sm font-medium hover:underline truncate"
                >
                  {entry.name}
                </Link>
                <div className="flex gap-4 text-sm text-muted-foreground whitespace-nowrap">
                  <span>{entry.views} visitas</span>
                  <span>{entry.unique_visitors} unicos</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
