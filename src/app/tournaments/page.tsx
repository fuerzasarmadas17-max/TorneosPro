"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TournamentFilters } from "@/components/tournaments/tournament-filters";
import { TournamentList } from "@/components/tournaments/tournament-list";
import { useTournaments } from "@/context/tournament-context";
import { TournamentFilters as TournamentFiltersType } from "@/types";

function TournamentsContent() {
  const searchParams = useSearchParams();
  const { getFilteredTournaments } = useTournaments();

  const filters: TournamentFiltersType = {
    sport: (searchParams.get("sport") as TournamentFiltersType["sport"]) || undefined,
    status: (searchParams.get("status") as TournamentFiltersType["status"]) || "in-progress",
    search: searchParams.get("search") || undefined,
    department: searchParams.get("department") || undefined,
    municipality: searchParams.get("municipality") || undefined,
  };

  const tournaments = getFilteredTournaments(filters);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Torneos</h1>
        <p className="text-muted-foreground mt-1">
          Explora todos los torneos disponibles
        </p>
      </div>
      <TournamentFilters />
      <TournamentList tournaments={tournaments} />
    </div>
  );
}

export default function TournamentsPage() {
  return (
    <Suspense>
      <TournamentsContent />
    </Suspense>
  );
}
