"use client";

import { useRouter, useSearchParams } from "next/navigation";
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

export function TournamentFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSport = searchParams.get("sport") || "";
  const currentFormat = searchParams.get("format") || "";
  const currentStatus = searchParams.get("status") || "in-progress";
  const currentSearch = searchParams.get("search") || "";
  const currentDepartment = searchParams.get("department") || "";
  const currentMunicipality = searchParams.get("municipality") || "";

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`/tournaments?${params.toString()}`);
  };

  const updateDepartment = (v: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (v && v !== "all") {
      params.set("department", v);
    } else {
      params.delete("department");
    }
    params.delete("municipality");
    router.replace(`/tournaments?${params.toString()}`);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
      <Input
        placeholder="Buscar torneo..."
        value={currentSearch}
        onChange={(e) => updateFilter("search", e.target.value)}
        className="sm:max-w-[200px]"
      />
      <Select
        value={currentSport || "all"}
        onValueChange={(v) => updateFilter("sport", v)}
      >
        <SelectTrigger className="sm:w-[160px]">
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
        <SelectTrigger className="sm:w-[160px]">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          <SelectItem value="upcoming">Proximo</SelectItem>
          <SelectItem value="in-progress">En Curso</SelectItem>
          <SelectItem value="completed">Completado</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={currentDepartment || "all"}
        onValueChange={updateDepartment}
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
      {currentDepartment && (
        <Select
          value={currentMunicipality || "all"}
          onValueChange={(v) => updateFilter("municipality", v)}
        >
          <SelectTrigger className="sm:w-[180px]">
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
    </div>
  );
}
