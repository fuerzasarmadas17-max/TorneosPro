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
