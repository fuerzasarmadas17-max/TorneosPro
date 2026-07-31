"use client";

import { useState, useMemo } from "react";
import { Tournament, Sport, TournamentStatus } from "@/types";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { buildSportImageMap } from "@/data/sport-images";
import { ProfileTournamentFilters } from "./profile-tournament-filters";

interface Filters {
  sport?: Sport;
  status?: TournamentStatus;
  search?: string;
  department?: string;
  municipality?: string;
}

interface ProfileTournamentsProps {
  tournaments: Tournament[];
  organizationName: string;
  slug: string;
}

export function ProfileTournaments({
  tournaments,
  organizationName,
  slug,
}: ProfileTournamentsProps) {
  const [filters, setFilters] = useState<Filters>({ status: "in-progress" });

  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      if (filters.sport && t.sport !== filters.sport) return false;
      if (filters.status && t.status !== filters.status) return false;
      if (
        filters.search &&
        !t.name.toLowerCase().includes(filters.search.toLowerCase())
      )
        return false;
      if (filters.department && t.department !== filters.department) return false;
      if (filters.municipality && t.municipality !== filters.municipality) return false;
      return true;
    });
  }, [tournaments, filters]);

  // Sobre la lista completa y no la filtrada: así el filtro no le cambia la
  // foto a un torneo (el reparto se calcula sobre los ids ordenados).
  const images = useMemo(() => buildSportImageMap(tournaments), [tournaments]);

  const stats = {
    total: tournaments.length,
    upcoming: tournaments.filter((t) => t.status === "upcoming").length,
    inProgress: tournaments.filter((t) => t.status === "in-progress").length,
    completed: tournaments.filter((t) => t.status === "completed").length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Proximos</p>
          <p className="text-2xl font-bold text-blue-500">{stats.upcoming}</p>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">En Curso</p>
          <p className="text-2xl font-bold text-green-500">
            {stats.inProgress}
          </p>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Completados</p>
          <p className="text-2xl font-bold">{stats.completed}</p>
        </div>
      </div>

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">
          Torneos de {organizationName}
        </h2>
        <p className="text-muted-foreground">
          Todos los torneos organizados
        </p>
      </div>

      {/* Filters */}
      <ProfileTournamentFilters
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* Tournaments Grid */}
      {filteredTournaments.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground">
            No se encontraron torneos con estos filtros.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTournaments.map((tournament, i) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              href={`/${slug}/${tournament.id}`}
              // Acá todos los torneos son del mismo organizador — el dueño
              // del perfil — así que sale de las props y no hace falta
              // consultar nada.
              organizer={{ name: organizationName, slug }}
              image={images.get(tournament.id)}
              priority={i < 3}
            />
          ))}
        </div>
      )}
    </div>
  );
}
