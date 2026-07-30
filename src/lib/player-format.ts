/**
 * Formato de los datos de nómina (documento y fecha de nacimiento).
 *
 * Regla general: guardamos el dato CRUDO y formateamos solo al mostrarlo.
 *   - Documento: se guarda sin puntos (solo los caracteres significativos)
 *     y se muestra con puntos de miles.
 *   - Fecha de nacimiento: se guarda en ISO (YYYY-MM-DD) porque es lo que
 *     exige el <input type="date"> y lo que parsea `new Date()` sin
 *     ambigüedad; se muestra en día/mes/año, que es como la escribe y la
 *     lee el organizador.
 */

/**
 * Documento tal como lo guardamos: sin puntos, comas ni espacios.
 *
 * Los equipos escriben la cédula de mil maneras ("1.234.567.890",
 * "1 234 567 890"). Si guardáramos el texto tal cual, el mismo jugador
 * quedaría con dos documentos distintos según quién llenó la planilla, y
 * cualquier comparación futura fallaría.
 *
 * Se conservan letras y guiones porque hay documentos que no son solo
 * dígitos (cédula de extranjería, pasaporte).
 */
export function normalizeDocumentNumber(raw: string): string {
  return raw.replace(/[.,\s]/g, "").trim();
}

/**
 * Documento como se muestra: puntos de miles ("1234567890" →
 * "1.234.567.890"). Si trae letras (pasaporte, CE) se devuelve intacto —
 * agrupar de a tres ahí no significa nada.
 */
export function formatDocumentNumber(value: string): string {
  const clean = value.trim();
  if (!clean || !/^\d+$/.test(clean)) return clean;
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Interpreta una fecha escrita a mano y la devuelve en ISO (YYYY-MM-DD),
 * o null si no se entiende.
 *
 * Acepta, en este orden:
 *   - día/mes/año con / o - ("15/06/1995", "15-6-95"). Es el formato que
 *     usa la plantilla y el que escribe el organizador. Ojo: `new Date()`
 *     lee "15/06/1995" como mes 15 (inválido) y "06/15/1995" como junio,
 *     al revés de lo que quiere el usuario — por eso se parsea a mano.
 *   - ISO YYYY-MM-DD, que es lo que ya está guardado en la base.
 *
 * Los años de dos dígitos se resuelven contra el año actual: 95 → 1995,
 * 10 → 2010. Nadie inscribe jugadores del futuro.
 */
export function parseDateToISO(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  // ISO primero: es inequívoco.
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return buildISO(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const dmy = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (dmy[3].length === 2) {
      const currentTwoDigit = new Date().getFullYear() % 100;
      year = year <= currentTwoDigit ? 2000 + year : 1900 + year;
    }
    return buildISO(year, month, day);
  }

  return null;
}

function buildISO(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1900 || year > new Date().getFullYear()) return null;
  // Rechaza fechas que no existen (31 de febrero): el Date se corre de mes.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
