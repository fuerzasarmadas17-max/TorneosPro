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
