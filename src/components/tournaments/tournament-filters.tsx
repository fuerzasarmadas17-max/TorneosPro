"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SPORTS } from "@/data/sports";
import { DEPARTMENTS, getDepartment } from "@/data/colombia";

export function TournamentFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // useTransition hace que el cambio de filtro NO bloquee la UI mientras
  // React procesa el re-render. Sin esto, cada tap en un Select se
  // sentía "freezeado" porque router.replace() disparaba un re-render
  // del server component sincrónico. Con startTransition el UI se
  // mantiene responsive y `isPending` nos da un visual de "estoy
  // trabajando" (opacity reducida en todo el wrapper).
  const [isPending, startTransition] = useTransition();
  // Controla el modal de filtros en mobile.
  const [filtersOpen, setFiltersOpen] = useState(false);

  const currentSport = searchParams.get("sport") || "";
  const currentStatus = searchParams.get("status") || "in-progress";
  const currentSearch = searchParams.get("search") || "";
  const currentDepartment = searchParams.get("department") || "";
  const currentMunicipality = searchParams.get("municipality") || "";

  // Contamos filtros "activos" = los que se desvían del default. El estado
  // por defecto es "in-progress" (En Curso), así que solo cuenta si el
  // organizador lo cambió. El buscador no entra acá (vive en la barra).
  const activeCount =
    (currentSport ? 1 : 0) +
    (currentStatus !== "in-progress" ? 1 : 0) +
    (currentDepartment ? 1 : 0) +
    (currentMunicipality ? 1 : 0);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => {
      router.replace(`/tournaments?${params.toString()}`);
    });
  };

  const updateDepartment = (v: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (v && v !== "all") {
      params.set("department", v);
    } else {
      params.delete("department");
    }
    params.delete("municipality");
    startTransition(() => {
      router.replace(`/tournaments?${params.toString()}`);
    });
  };

  // Los selects se renderizan tanto inline (desktop) como dentro del modal
  // (mobile). El `value` de cada uno refleja el filtro en curso, por lo que
  // al abrir el modal la opción activa ya aparece marcada.
  const filterControls = (
    <>
      <Select
        value={currentSport || "all"}
        onValueChange={(v) => updateFilter("sport", v)}
      >
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="Deporte" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los deportes</SelectItem>
          {SPORTS.map((s) => (
            <SelectItem key={s.key} value={s.key}>
              {s.emoji} {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={currentStatus}
        onValueChange={(v) => updateFilter("status", v)}
      >
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          <SelectItem value="upcoming">Proximo</SelectItem>
          <SelectItem value="in-progress">En Curso</SelectItem>
          <SelectItem value="completed">Completado</SelectItem>
        </SelectContent>
      </Select>
      <Select value={currentDepartment || "all"} onValueChange={updateDepartment}>
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
      {currentDepartment && (
        <Select
          value={currentMunicipality || "all"}
          onValueChange={(v) => updateFilter("municipality", v)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Municipio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los municipios</SelectItem>
            {(getDepartment(currentDepartment)?.municipalities ?? []).map((m) => (
              <SelectItem key={m.key} value={m.key}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </>
  );

  return (
    <div
      className={`flex flex-col sm:flex-row sm:flex-wrap gap-3 transition-opacity ${isPending ? "opacity-60" : ""}`}
    >
      {/* Barra de búsqueda: siempre visible. En mobile comparte fila con el
          botón de filtros. */}
      <div className="flex gap-3">
        <Input
          placeholder="Buscar torneo..."
          value={currentSearch}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="flex-1 sm:max-w-[200px]"
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

      {/* Filtros inline: solo desktop. En mobile viven dentro del Sheet. */}
      <div className="hidden sm:flex sm:flex-wrap sm:gap-3">{filterControls}</div>
    </div>
  );
}
