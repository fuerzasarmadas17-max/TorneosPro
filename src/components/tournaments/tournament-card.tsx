"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tournament } from "@/types";
import { getSportInfo } from "@/data/sports";

const statusLabels: Record<string, string> = {
  upcoming: "Proximo",
  "in-progress": "En Curso",
  completed: "Completado",
};

const statusColors: Record<string, string> = {
  upcoming: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
  "in-progress": "bg-green-500/10 text-green-500 hover:bg-green-500/20",
  completed: "bg-zinc-500/10 text-zinc-500 hover:bg-zinc-500/20",
};

const formatLabels: Record<string, string> = {
  elimination: "Eliminacion",
  "round-robin": "Liga",
  "group-playoff": "Grupos + Playoffs",
};

interface TournamentCardProps {
  tournament: Tournament;
  href?: string;
}

export function TournamentCard({ tournament, href }: TournamentCardProps) {
  const sport = getSportInfo(tournament.sport);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="text-xs">
            {sport?.emoji} {sport?.label}
          </Badge>
          <Badge className={statusColors[tournament.status]}>
            {statusLabels[tournament.status]}
          </Badge>
        </div>
        <CardTitle className="text-lg mt-2">{tournament.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between gap-4">
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>{formatLabels[tournament.format]}</p>
          <p>{tournament.teamIds.length} equipos</p>
          <p>Inicio: {tournament.startDate}</p>
        </div>
        <Button variant="outline" className="w-full" asChild>
          <Link href={href || `/tournaments/${tournament.id}`}>Ver Torneo</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
