// Helpers de fecha para la agenda del dashboard (sin librería, hora local).
// Los comparte el calendario semanal y el diálogo de links de anotador, que
// muestran los mismos partidos con el mismo formato.

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" -> Date en medianoche local. Evita el corrimiento de día que
 *  provoca new Date("YYYY-MM-DD"), que parsea como UTC. */
export function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Lunes de la semana que contiene a `d` (la semana arranca en lunes). */
export function mondayOf(d: Date): Date {
  const offset = (d.getDay() + 6) % 7; // 0=lun ... 6=dom
  return addDays(startOfDay(d), -offset);
}

export const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

export const MONTHS_FULL = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function formatTime12h(time?: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h)) return "";
  const suffix = h >= 12 ? "p. m." : "a. m.";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m || 0).padStart(2, "0")} ${suffix}`;
}

/** "Sábado 2 de agosto" — el índice de WEEKDAYS arranca en lunes. */
export function formatDayLabel(d: Date): string {
  const weekday = WEEKDAYS[(d.getDay() + 6) % 7];
  return `${weekday.replace(/^\w/, (c) => c.toUpperCase())} ${d.getDate()} de ${MONTHS_FULL[d.getMonth()]}`;
}
