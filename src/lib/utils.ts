import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Las primeras `n` palabras de un texto, con "…" si se recortó.
 *
 * Se usa en los paneles de admin para la versión móvil: en una pantalla de
 * 360px, "CLUB DEPORTIVO ATHLETICS DE LA 32" empuja los números fuera del
 * margen por más `truncate` que se le ponga, porque los números no encogen.
 * Recortar por palabras deja algo legible; recortar por caracteres deja
 * "CLUB DEPOR…", que no dice nada.
 */
export function firstWords(text: string, n: number): string {
  const parts = text.trim().split(/\s+/);
  if (parts.length <= n) return parts.join(" ");
  return parts.slice(0, n).join(" ") + "…";
}
