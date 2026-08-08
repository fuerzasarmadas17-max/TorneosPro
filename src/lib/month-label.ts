const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * "2026-08-01" → "Agosto 2026".
 *
 * Se parte el texto en vez de usar `new Date("2026-08-01")`: ese constructor
 * interpreta la fecha sola como UTC, así que en Colombia (UTC-5) cae el 31 de
 * julio a las 7pm y el mes sale corrido uno para atrás. Un corte de agosto
 * mostrándose como "Julio" es exactamente el tipo de error que nadie revisa.
 */
export function monthLabel(periodMonth: string): string {
  const [y, m] = periodMonth.split("-").map(Number);
  const name = MONTHS[m - 1];
  if (!name || !y) return periodMonth;
  return `${name[0].toUpperCase()}${name.slice(1)} ${y}`;
}
