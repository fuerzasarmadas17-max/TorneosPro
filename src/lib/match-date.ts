/** Rango sano para la fecha de un partido.
 *
 *  Los `<input type="date">` nativos aceptan años de hasta 6 dígitos, y
 *  Postgres guarda hasta el año 294276 sin quejarse. Escribir "262026" en vez
 *  de "2026" es un dedo fácil de dar tecleando el año, y el destrozo es
 *  desproporcionado: el calendario agrupa y ordena por el string de la fecha,
 *  así que ese partido se va a un bloque aparte, al final de la lista, con un
 *  título idéntico al del día correcto (el título no muestra el año) — y dos
 *  bloques con el mismo título rompen la reconciliación de React, que deja
 *  tarjetas pegadas en pantalla al cambiar de pestaña.
 *
 *  Pasó en producción el 10 de agosto de 2026 (Majagual vs Evermar quedó en
 *  `262026-08-13`). */
export const MIN_MATCH_DATE = "2000-01-01";
export const MAX_MATCH_DATE = "2100-12-31";

/** True si `value` es una fecha ISO (yyyy-mm-dd) dentro del rango sano.
 *  Vacío/null/undefined cuenta como válida: significa "sin fecha asignada". */
export function isSaneMatchDate(value: string | null | undefined): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return value >= MIN_MATCH_DATE && value <= MAX_MATCH_DATE;
}

export const INVALID_MATCH_DATE_MESSAGE =
  "La fecha no es válida. Revisa el año (debe tener 4 dígitos).";

/** Hoy, en formato de fecha de partido (yyyy-mm-dd) y en la zona horaria del
 *  navegador.
 *
 *  A propósito NO usa `toISOString()`, que devuelve UTC: en Colombia (UTC-5)
 *  cualquier cosa hecha después de las 7 de la tarde quedaría fechada al día
 *  siguiente. Es el mismo error que hubo que corregir en el reparto de
 *  publicidad (migración `20260808e_dia_colombiano`), y acá se vería peor: un
 *  partido resuelto anoche apareciendo mañana. */
export function todayMatchDate(): string {
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}
