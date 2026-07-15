"use client";

import { useState } from "react";
import { Sport, TournamentStatus } from "@/types";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SPORTS } from "@/data/sports";
import { DEPARTMENTS, getDepartment } from "@/data/colombia";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SlidersHorizontal, X } from "lucide-react";

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
  // Controla el modal de filtros en mobile.
  const [filtersOpen, setFiltersOpen] = useState(false);

  const hasActive =
    filters.sport ||
    (filters.status && filters.status !== "in-progress") ||
    filters.search ||
    filters.department;

  // Conteo de filtros activos para el badge del ícono (el buscador no
  // entra: vive en la barra). El estado por defecto es "in-progress".
  const activeCount =
    (filters.sport ? 1 : 0) +
    (filters.status && filters.status !== "in-progress" ? 1 : 0) +
    (filters.department ? 1 : 0) +
    (filters.municipality ? 1 : 0);

  // Los selects se renderizan tanto inline (desktop) como dentro del modal
  // (mobile). El `value` de cada uno refleja el filtro en curso, por lo que
  // al abrir el modal la opción activa ya aparece marcada.
  const filterControls = (
    <>
      <Select
        value={filters.sport || "all"}
        onValueChange={(v) =>
          onFiltersChange({
            ...filters,
            sport: v === "all" ? undefined : (v as Sport),
          })
        }
      >
        <SelectTrigger className="w-full sm:w-[180px]">
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
        <SelectTrigger className="w-full sm:w-[180px]">
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
        <SelectTrigger className="w-full sm:w-[180px]">
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
          <SelectTrigger className="w-full sm:w-[180px]">
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
    </>
  );

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4">
      {/* Barra de búsqueda: siempre visible. En mobile comparte fila con el
          botón de filtros. */}
      <div className="flex gap-3">
        <Input
          placeholder="Buscar torneos..."
          value={filters.search || ""}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value || undefined })
          }
          className="flex-1 sm:max-w-xs"
        />
        {/* Botón de filtros: solo en mobile. Abre el modal centrado con los selects. */}
        <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="relative shrink-0 sm:hidden"
              aria-label="Filtros"
            >
              <SlidersHorizontal className="size-4" />
              {activeCount > 0 && (
                <Badge className="absolute -right-1.5 -top-1.5 size-4 justify-center rounded-full p-0 text-[10px] leading-none">
                  {activeCount}
                </Badge>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[360px]">
            <DialogHeader>
              <DialogTitle>Filtrar torneos</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">{filterControls}</div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros inline: solo desktop. En mobile viven dentro del modal. */}
      <div className="hidden sm:flex sm:flex-wrap sm:items-center sm:gap-4">
        {filterControls}
      </div>
    </div>
  );
}
