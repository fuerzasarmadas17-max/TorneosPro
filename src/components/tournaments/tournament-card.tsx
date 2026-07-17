"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tournament } from "@/types";
import { getSportInfo } from "@/data/sports";
import { getDepartmentLabel, getMunicipalityLabel } from "@/data/colombia";
import { supabase } from "@/lib/supabase";

const statusLabels: Record<string, string> = {
  upcoming: "Próximo",
  "in-progress": "En Curso",
  completed: "Completado",
};

const statusColors: Record<string, string> = {
  upcoming: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
  "in-progress": "bg-green-500/10 text-green-500 hover:bg-green-500/20",
  completed: "bg-zinc-500/10 text-zinc-500 hover:bg-zinc-500/20",
};

// Un color por deporte para reconocer el torneo de un vistazo. Agrupados por
// familia (goles = verdes, carreras = cálidos, raqueta/red = fríos) para que
// deportes parecidos se lean como parientes sin confundirse entre sí.
// Clases completas a propósito: Tailwind no genera nombres construidos por
// interpolación, tienen que estar literales para que el JIT las incluya.
const sportColors: Record<string, string> = {
  futbol: "bg-green-500/15 text-green-700 dark:text-green-400",
  futsal: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  microfutbol: "bg-lime-600/15 text-lime-700 dark:text-lime-400",
  beisbol: "bg-red-500/15 text-red-700 dark:text-red-400",
  softball: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  wiffleball: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  volleyball: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  basketball: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  padel: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  "ping-pong": "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
  tenis: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
};

// Mismo color, solo el texto — para el nombre del deporte junto al chip.
const sportText: Record<string, string> = {
  futbol: "text-green-700 dark:text-green-400",
  futsal: "text-emerald-700 dark:text-emerald-400",
  microfutbol: "text-lime-700 dark:text-lime-400",
  beisbol: "text-red-700 dark:text-red-400",
  softball: "text-rose-700 dark:text-rose-400",
  wiffleball: "text-amber-700 dark:text-amber-400",
  volleyball: "text-sky-700 dark:text-sky-400",
  basketball: "text-orange-700 dark:text-orange-400",
  padel: "text-violet-700 dark:text-violet-400",
  "ping-pong": "text-cyan-700 dark:text-cyan-400",
  tenis: "text-yellow-700 dark:text-yellow-400",
};

interface TournamentCardProps {
  tournament: Tournament;
  href?: string;
}

export function TournamentCard({ tournament, href }: TournamentCardProps) {
  const sport = getSportInfo(tournament.sport);
  const [organizer, setOrganizer] = useState<{ name: string; slug?: string } | null>(null);

  useEffect(() => {
    if (!tournament.createdBy) return;
    // Query organization_profiles directly — the users table has RLS that
    // blocks reading other users, causing 406 errors with .single().
    supabase
      .from("organization_profiles")
      .select("organization_name, slug")
      .eq("user_id", tournament.createdBy)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setOrganizer({ name: data.organization_name, slug: data.slug });
        }
      });
  }, [tournament.createdBy]);

  const location =
    tournament.scope === "nacional"
      ? "Nacional"
      : tournament.department
        ? `${getDepartmentLabel(tournament.department)}${
            tournament.municipality
              ? `, ${getMunicipalityLabel(tournament.department, tournament.municipality)}`
              : ""
          }`
        : null;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          {/* Chip del emoji: ancla de color del deporte */}
          <div
            className={`grid size-10 shrink-0 place-items-center rounded-lg text-lg ${
              sportColors[tournament.sport] ?? "bg-muted text-muted-foreground"
            }`}
          >
            <span aria-hidden>{sport?.emoji}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-xs font-medium ${
                  sportText[tournament.sport] ?? "text-muted-foreground"
                }`}
              >
                {sport?.label}
              </span>
              <Badge className={statusColors[tournament.status]}>
                {statusLabels[tournament.status]}
              </Badge>
            </div>
            <CardTitle className="text-base leading-snug mt-1 line-clamp-2 min-h-[2lh]">
              {tournament.name}
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between gap-3">
        <div className="space-y-1 text-sm text-muted-foreground">
          {location && <p>{location}</p>}
          {organizer && (
            <p className="flex items-center gap-1 min-w-0">
              <span className="shrink-0">Organizador:</span>
              {organizer.slug ? (
                <Link
                  href={`/${organizer.slug}`}
                  className="text-primary hover:underline font-medium truncate min-w-0"
                >
                  {organizer.name}
                </Link>
              ) : (
                <span className="font-medium truncate min-w-0">{organizer.name}</span>
              )}
            </p>
          )}
        </div>
        <Button variant="outline" className="w-full" asChild>
          <Link href={href || `/tournaments/${tournament.id}`}>Ver Torneo</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
