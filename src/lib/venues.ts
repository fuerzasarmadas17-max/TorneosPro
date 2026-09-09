/**
 * Las canchas, tratadas como una lista aunque se escriban a mano.
 *
 * La cancha de un partido es texto libre: el organizador la teclea al programar
 * la fecha y el formulario le autocompleta con las que ya usó en ese torneo.
 * Eso alcanza para mostrarla, pero no para filtrar por ella: "Cancha 1",
 * "cancha 1" y "Cancha  1" son el mismo lugar y tres textos distintos, así que
 * un filtro ingenuo le partiría la cancha en tres.
 *
 * Acá vive la regla que las junta. Se compara por `venueKey` (sin mayúsculas ni
 * espacios de más) y se muestra por la etiqueta más usada, así el filtro dice
 * "Cancha 1" una sola vez aunque en la base haya tres formas de escribirla.
 */

/**
 * Conectores: palabras que no distinguen un lugar de otro. Se usan en dos
 * lados y por eso viven acá, en una sola lista: para escribir bien el nombre
 * ("Rita de Arrazola", no "Rita De Arrazola") y para comparar dos canchas sin
 * que un "de" de más las separe.
 */
export const CONECTORES = new Set([
  "de", "del", "la", "el", "los", "las", "y", "en",
]);

/**
 * Cómo se guarda una cancha, se escriba como se escriba: sin espacios de
 * sobra, cada palabra con la primera letra en mayúscula y el resto en
 * minúscula. "KENNEDY", "kennedy" y "KeNNedy" se guardan las tres como
 * "Kennedy", así que dejan de ser tres canchas distintas en la base.
 *
 * Los conectores quedan enteros en minúscula, salvo que abran el nombre:
 * "Rita de Arrazola" y "La Rita" se leen como los escribiría una persona.
 *
 * El costo de esto es que una sigla escrita a propósito en mayúsculas
 * ("IDRD") queda como "Idrd". Se acepta: el organizador que escribe todo en
 * mayúsculas es mucho más común que el que usa siglas, y una cancha partida
 * en dos desordena el filtro y la agenda.
 */
export function formatVenue(venue: string): string {
  return venue
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\S+/g, (palabra, posicion: number) => {
      const minuscula = palabra.toLocaleLowerCase("es");
      if (posicion > 0 && CONECTORES.has(minuscula)) return minuscula;
      return (
        minuscula.charAt(0).toLocaleUpperCase("es") + minuscula.slice(1)
      );
    });
}

/** Clave para comparar dos canchas. No se muestra nunca. */
export function venueKey(venue: string): string {
  return venue
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es");
}

export interface VenueOption {
  /** Para comparar y para el `value` del desplegable. */
  key: string;
  /** Para mostrar. Es la forma más usada de escribirla. */
  label: string;
  /** Cuántos partidos la usan. */
  count: number;
}

/**
 * Las canchas distintas de una lista de partidos, ordenadas como las leería
 * una persona: la Cancha 2 antes que la Cancha 10, no al revés.
 */
export function collectVenues(
  matches: { venue?: string | null }[]
): VenueOption[] {
  const byKey = new Map<string, { count: number; labels: Map<string, number> }>();

  for (const m of matches) {
    const raw = (m.venue ?? "").trim();
    if (!raw) continue;
    const key = venueKey(raw);
    const entry = byKey.get(key) ?? { count: 0, labels: new Map() };
    entry.count += 1;
    entry.labels.set(raw, (entry.labels.get(raw) ?? 0) + 1);
    byKey.set(key, entry);
  }

  const out: VenueOption[] = [];
  for (const [key, entry] of byKey) {
    // La etiqueta ganadora es la que más veces se escribió; a igual cantidad,
    // la primera alfabéticamente, para que no baile entre recargas. Se muestra
    // normalizada: si la más usada tenía dos espacios, el filtro no los repite.
    const winner = Array.from(entry.labels.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es")
    )[0][0];
    out.push({ key, label: formatVenue(winner), count: entry.count });
  }

  return out.sort((a, b) =>
    a.label.localeCompare(b.label, "es", { numeric: true, sensitivity: "base" })
  );
}

/** ¿Este partido se juega en la cancha filtrada? `key` viene del desplegable. */
export function isInVenue(
  venue: string | null | undefined,
  key: string
): boolean {
  if (key === ALL_VENUES) return true;
  if (key === NO_VENUE) return !(venue ?? "").trim();
  return venueKey(venue ?? "") === key;
}

/** Valor del desplegable para "todas". No puede chocar con una cancha real
 *  porque `venueKey` nunca devuelve algo con `__`. */
export const ALL_VENUES = "__todas__";
/** Valor para los partidos a los que todavía no se les puso cancha. */
export const NO_VENUE = "__sin_cancha__";
