"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SPORTS } from "@/data/sports";
import { DEPARTMENTS } from "@/data/colombia";

/**
 * La barra de la portada NO filtra acá: arma la URL y manda a
 * `/tournaments`, que ya sabe leer esos mismos parámetros en
 * `TournamentFilters`. Así no hay dos implementaciones del filtrado que se
 * puedan desincronizar — esta es solo la puerta de entrada.
 */
export function LandingFilters() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("all");
  const [status, setStatus] = useState("in-progress");
  const [department, setDepartment] = useState("all");

  const go = (overrides: Record<string, string> = {}) => {
    const values = { search, sport, status, department, ...overrides };
    const params = new URLSearchParams();
    if (values.search.trim()) params.set("search", values.search.trim());
    if (values.sport !== "all") params.set("sport", values.sport);
    if (values.status !== "all") params.set("status", values.status);
    if (values.department !== "all") params.set("department", values.department);
    startTransition(() => {
      router.push(`/tournaments?${params.toString()}`);
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
      className={`flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm sm:flex-row sm:items-center ${
        isPending ? "opacity-60" : ""
      } transition-opacity`}
    >
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar torneo, equipo o deporte..."
          aria-label="Buscar torneo, equipo o deporte"
          className="border-0 pl-9 shadow-none focus-visible:ring-0"
        />
      </div>

      {/* Cambiar un select navega de una: esta barra es un lanzador hacia
          /tournaments, no un filtro en el lugar. */}
      <Select
        value={sport}
        onValueChange={(v) => {
          setSport(v);
          go({ sport: v });
        }}
      >
        <SelectTrigger className="w-full sm:w-[170px]" aria-label="Deporte">
          <SelectValue />
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
        value={status}
        onValueChange={(v) => {
          setStatus(v);
          go({ status: v });
        }}
      >
        <SelectTrigger className="w-full sm:w-[140px]" aria-label="Estado">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          <SelectItem value="upcoming">Próximo</SelectItem>
          <SelectItem value="in-progress">En Curso</SelectItem>
          <SelectItem value="completed">Completado</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={department}
        onValueChange={(v) => {
          setDepartment(v);
          go({ department: v });
        }}
      >
        <SelectTrigger
          className="hidden w-full lg:flex lg:w-[190px]"
          aria-label="Departamento"
        >
          <SelectValue />
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

      {/* El resto de los filtros (municipio) vive en /tournaments. Este
          botón lleva ahí en vez de duplicar el modal. */}
      <Button type="submit" variant="outline" className="shrink-0">
        <SlidersHorizontal className="size-4" aria-hidden />
        Filtros
      </Button>
    </form>
  );
}
