import { MatchEventType } from "@/types";

/**
 * Orden de las cards de stats para deportes de béisbol/softball/wiffleball.
 * Después de la tabla individual van: sencillos → dobles → triples → HR →
 * runs → RBI → errores → ponches → BB → AB. Cualquier otra stat no
 * listada va al final manteniendo su orden original.
 *
 * Vive en su propio archivo (en lugar de exportarse desde tournament-stats.tsx)
 * para evitar un ciclo de imports con stats-pdf.ts. Importar este const
 * desde un módulo neutro (no client component) mantiene el bundle limpio
 * sin que ningún módulo dependa "hacia atrás" del componente.
 */
export const BASEBALL_LEADERBOARD_ORDER: MatchEventType[] = [
  "hit",
  "double",
  "triple",
  "home_run",
  "run_scored",
  "rbi",
  "error",
  "strikeout",
  "walk",
  "at_bat",
];
