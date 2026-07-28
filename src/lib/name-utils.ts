/**
 * Devuelve una versión compacta del nombre del jugador usando la
 * convención hispano-Latam estándar (2 nombres + 2 apellidos):
 *
 *   - 1 palabra → tal cual.
 *   - 2 palabras → primer + última ("Juan Pérez").
 *   - 3 palabras → primer + segunda. Asume 1 nombre + 2 apellidos, que
 *     es lo más común con tres palabras ("Juan Pérez García" → "Juan
 *     Pérez").
 *   - 4+ palabras → primera + tercera. Asume 2 nombres + 2 apellidos
 *     ("Fabián Andrés Sánchez González" → "Fabián Sánchez").
 *
 * Pensado para apretar nombres largos en mobile donde no cabe el
 * nombre completo. En desktop conviene mostrar el nombre entero igual.
 */
export function getShortName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return fullName;
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} ${parts[1]}`;
  if (parts.length === 3) return `${parts[0]} ${parts[1]}`;
  // 4+: tomamos posición 0 (primer nombre) y 2 (primer apellido).
  return `${parts[0]} ${parts[2]}`;
}

/**
 * Edad del jugador a partir de su fecha de nacimiento, calculada POR AÑO
 * (año actual − año de nacimiento), no por cumpleaños exacto. Es la misma
 * convención que usa la importación de planillas en `team-roster-dialog`, y
 * la que manejan las ligas para las categorías por edad ("los del 2010").
 *
 * Devuelve null si no hay fecha o si no parsea, para que la UI simplemente
 * omita la edad en vez de mostrar "NaN años".
 */
export function getAgeFromBirthDate(birthDate?: string): number | null {
  if (!birthDate) return null;
  const parsed = new Date(birthDate);
  if (isNaN(parsed.getTime())) return null;
  const age = new Date().getFullYear() - parsed.getFullYear();
  // Descarta fechas absurdas (typos de año, fechas futuras).
  if (age < 0 || age > 120) return null;
  return age;
}

/**
 * Quita jugadores con nombre repetido, conservando el primero.
 *
 * La identidad de un jugador es su nombre: `match_events` guarda
 * `player_name` (texto) y no `player_id`, y la planilla indexa sus celdas
 * por nombre. Dos filas de nómina con el mismo nombre apuntan entonces a la
 * MISMA celda, y al serializar la planilla se emitiría un evento por cada
 * fila: cada turno se guardaría dos veces. Peor, la planilla se reconstruye
 * leyendo los eventos, así que cada nuevo guardado volvía a duplicar lo ya
 * duplicado (×2, ×4, ×8...). Ver `buildScoresheetEventsForTeam`.
 */
export function dedupePlayersByName<T extends { name: string }>(
  players: ReadonlyArray<T>
): T[] {
  const seen = new Set<string>();
  return players.filter((p) => {
    if (seen.has(p.name)) return false;
    seen.add(p.name);
    return true;
  });
}

/** Clave de identidad de un nombre: sin espacios de sobra y en minúsculas.
 *  Sirve para deduplicar "Jhon Turizo" / "jhon  turizo" como el mismo. */
export function normalizePlayerName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Nombres candidatos para el dropdown de jugador: combina el roster con los
 * nombres ya usados en eventos, deduplicando por nombre normalizado y
 * conservando la primera forma vista (el roster va primero, así su ortografía
 * "oficial" gana). Devuelve la lista ordenada alfabéticamente.
 *
 * No toca la plantilla: es solo la fuente de sugerencias. Así el dropdown se
 * llena con los goleadores ya anotados aunque el equipo no tenga roster, sin
 * riesgo de duplicar jugadores cuando luego se importe la planilla oficial.
 */
export function buildPlayerNameOptions(
  rosterNames: ReadonlyArray<string>,
  eventNames: ReadonlyArray<string>
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...rosterNames, ...eventNames]) {
    const name = raw.trim();
    if (!name) continue;
    const key = normalizePlayerName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out.sort((a, b) => a.localeCompare(b));
}
