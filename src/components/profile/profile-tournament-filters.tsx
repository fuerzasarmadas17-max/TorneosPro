"use client";

import { Sport, TournamentStatus } from "@/types";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SPORTS } from "@/data/sports";
import { DEPARTMENTS, getDepartment } from "@/data/colombia";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Filters {
  sport?: Sport;
  status?: TournamentStatus;
  search?: string;
  department?: string;
  municipality?: string;
}

interface ProfileTournamentFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

export function ProfileTournamentFilters({
  filters,
  onFiltersChange,
}: ProfileTournamentFiltersProps) {
  const hasActive = filters.sport || (filters.status && filters.status !== "in-progress") || filters.search || filters.department;

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4">
      <Input
        placeholder="Buscar torneos..."
        value={filters.search || ""}
        onChange={(e) =>
          onFiltersChange({ ...filters, search: e.target.value || undefined })
        }
        className="sm:max-w-xs"
      />

      <Select
        value={filters.sport || "all"}
        onValueChange={(v) =>
          onFiltersChange({
            ...filters,
            sport: v === "all" ? undefined : (v as Sport),
          })
        }
      >
        <SelectTrigger className="sm:w-[180px]">
          <SelectValue placeholder="Deporte" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los deportes</SelectItem>
          {SPORTS.map((sport) => (
            <SelectItem key={sport.key} value={sport.key}>
              {sport.emoji} {sport.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.status || "all"}
        onValueChange={(v) =>
          onFiltersChange({
            ...filters,
            status: v === "all" ? undefined : (v as TournamentStatus),
          })
        }
      >
        <SelectTrigger className="sm:w-[180px]">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="upcoming">Proximos</SelectItem>
          <SelectItem value="in-progress">En Curso</SelectItem>
          <SelectItem value="completed">Completados</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.department || "all"}
        onValueChange={(v) =>
          onFiltersChange({
            ...filters,
            department: v === "all" ? undefined : v,
            municipality: undefined,
          })
        }
      >
        <SelectTrigger className="sm:w-[180px]">
          <SelectValue placeholder="Departamento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los departamentos</SelectItem>
          {DEPARTMENTS.map((d) => (
            <SelectItem key={d.key} value={d.key}>
              {d.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {filters.department && (
        <Select
          value={filters.municipality || "all"}
          onValueChange={(v) =>
            onFiltersChange({
              ...filters,
              municipality: v === "all" ? undefined : v,
            })
          }
        >
          <SelectTrigger className="sm:w-[180px]">
            <SelectValue placeholder="Municipio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los municipios</SelectItem>
            {(getDepartment(filters.department)?.municipalities ?? []).map((m) => (
              <SelectItem key={m.key} value={m.key}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasActive && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFiltersChange({ status: "in-progress" })}
        >
          <X className="h-4 w-4 mr-2" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
