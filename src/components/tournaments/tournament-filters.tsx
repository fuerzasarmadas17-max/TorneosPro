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

export function TournamentFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSport = searchParams.get("sport") || "";
  const currentFormat = searchParams.get("format") || "";
  const currentStatus = searchParams.get("status") || "";
  const currentSearch = searchParams.get("search") || "";

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`/tournaments?${params.toString()}`);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
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
        value={currentFormat || "all"}
        onValueChange={(v) => updateFilter("format", v)}
      >
        <SelectTrigger className="sm:w-[160px]">
          <SelectValue placeholder="Formato" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los formatos</SelectItem>
          <SelectItem value="elimination">Eliminacion</SelectItem>
          <SelectItem value="round-robin">Liga</SelectItem>
          <SelectItem value="group-playoff">Fase de Grupos</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={currentStatus || "all"}
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
    </div>
  );
}
