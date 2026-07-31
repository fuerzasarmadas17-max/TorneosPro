"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Star,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tournament } from "@/types";
import { getSportInfo } from "@/data/sports";
import { getSportGradient } from "@/data/sport-images";
import { getDepartmentLabel, getMunicipalityLabel } from "@/data/colombia";

const statusLabels: Record<string, string> = {
  upcoming: "Próximo",
  "in-progress": "En Curso",
  completed: "Completado",
};

const statusColors: Record<string, string> = {
  upcoming: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  "in-progress":
    "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  completed: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

const formatLabels: Record<string, string> = {
  elimination: "Eliminación Directa",
  "round-robin": "Liga",
  "group-playoff": "Fase de Grupos + Playoffs",
};

export interface FeaturedItem {
  tournament: Tournament;
  image: string | null;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// Definidas fuera del componente para que su identidad no cambie entre
// renders: si cambiara, `useSyncExternalStore` se resuscribiría en cada uno.
function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Suscripción a `prefers-reduced-motion`.
 *
 * Va por `useSyncExternalStore` y no por `useEffect` + `setState`: es la
 * herramienta para leer un valor que vive fuera de React, no genera el
 * render en cascada que sí genera setear estado dentro de un efecto, y el
 * tercer argumento resuelve el SSR (donde `matchMedia` no existe).
 */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    // En el servidor se asume que sí anima: es el caso más común, y si el
    // usuario pidió lo contrario el cliente lo corrige al hidratar.
    () => false
  );
}

/**
 * Sección "TORNEO DESTACADO" de la portada.
 *
 * El admin marca los torneos a mano (columna `featured`). Si marca varios,
 * esto rota entre ellos con las flechas. Si no hay ninguno, el que llama no
 * renderiza la sección: la portada no puede depender de que alguien se
 * acuerde de marcar uno.
 */
export function FeaturedTournament({ items }: { items: FeaturedItem[] }) {
  const [index, setIndex] = useState(0);
  // Se pausa mientras el mouse está encima o algo adentro tiene el foco: que
  // el carrusel se mueva justo cuando alguien va a hacer clic es la forma más
  // rápida de mandarlo al torneo equivocado.
  const [paused, setPaused] = useState(false);
  // Igual que `video-background.tsx`: si el usuario pidió menos animación a
  // nivel sistema, el carrusel se queda quieto y solo se mueve con las
  // flechas.
  const reducedMotion = useReducedMotion();

  // Si el admin desmarca uno mientras alguien tiene la página abierta, el
  // índice podría quedar fuera de rango — se acota en vez de romper.
  const safeIndex = items.length > 0 ? Math.min(index, items.length - 1) : 0;

  // Rota cada 5s. Es un `setTimeout` que depende de `safeIndex` y no un
  // `setInterval`: así, cuando alguien usa las flechas, el reloj arranca de
  // cero y no salta a los 200ms de haber tocado.
  useEffect(() => {
    if (items.length <= 1 || paused || reducedMotion) return;
    const t = setTimeout(
      () => setIndex((safeIndex + 1) % items.length),
      5000
    );
    return () => clearTimeout(t);
  }, [safeIndex, items.length, paused, reducedMotion]);

  if (items.length === 0) return null;

  const { tournament, image } = items[safeIndex];
  const sport = getSportInfo(tournament.sport);
  const many = items.length > 1;

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

  const phase =
    tournament.format === "group-playoff"
      ? formatLabels["group-playoff"]
      : (formatLabels[tournament.format] ?? null);

  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold tracking-wide uppercase">
        <Star className="size-5 fill-primary text-primary" aria-hidden />
        Torneo destacado
      </h2>

      <div
        className="relative flex flex-col overflow-hidden rounded-xl border bg-card md:flex-row"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <div className="relative aspect-[16/9] shrink-0 md:aspect-auto md:w-[42%]">
          {image ? (
            <Image
              src={image}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 42vw"
              className="object-cover"
            />
          ) : (
            <div
              className={`absolute inset-0 ${getSportGradient(tournament.sport)}`}
              aria-hidden
            >
              <span className="absolute inset-0 grid place-items-center text-7xl opacity-30">
                {sport?.emoji}
              </span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px] font-semibold tracking-wide uppercase">
              <span aria-hidden>{sport?.emoji}</span>
              {sport?.label}
            </span>
            <span
              className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                statusColors[tournament.status] ?? ""
              }`}
            >
              {statusLabels[tournament.status]}
            </span>
          </div>

          <h3 className="text-2xl font-bold sm:text-3xl">{tournament.name}</h3>
          {phase && <p className="text-sm text-muted-foreground">{phase}</p>}

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="size-4 shrink-0" aria-hidden />
              {tournament.teamIds.length} equipos
            </span>
            {tournament.startDate && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-4 shrink-0" aria-hidden />
                Inicio: {tournament.startDate}
              </span>
            )}
            {location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4 shrink-0" aria-hidden />
                {location}
              </span>
            )}
          </div>

          <div className="pt-1">
            <Button asChild>
              <Link href={`/tournaments/${tournament.id}`}>
                Ver Torneo Destacado
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>

        {/* Las flechas solo aparecen si hay más de uno que mirar. */}
        {many && (
          <>
            <button
              type="button"
              onClick={() =>
                setIndex((i) => (i - 1 + items.length) % items.length)
              }
              aria-label="Torneo destacado anterior"
              className="absolute top-1/2 left-3 grid size-9 -translate-y-1/2 place-items-center rounded-full border bg-background/90 text-foreground transition-colors hover:bg-background"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % items.length)}
              aria-label="Torneo destacado siguiente"
              className="absolute top-1/2 right-3 grid size-9 -translate-y-1/2 place-items-center rounded-full border bg-background/90 text-foreground transition-colors hover:bg-background"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
