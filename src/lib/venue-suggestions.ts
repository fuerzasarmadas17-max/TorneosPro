/**
 * Canchas que parecen la misma.
 *
 * La cancha es texto libre, así que un mismo lugar termina escrito de dos
 * formas: "Rita" y "Rita de Arrazola". `lib/venues.ts` ya junta las que son el
 * mismo texto con otras mayúsculas o espacios; esto va un paso más allá y
 * detecta las que son el mismo lugar con distinto nombre.
 *
 * LA REGLA, EN UNA FRASE: solo se sugiere cuando un nombre le AGREGA palabras
 * al otro, nunca cuando le CAMBIA una palabra.
 *
 *   Rita           vs  Rita de Arrazola   →  agrega "arrazola"   →  sugiere
 *   Coliseo        vs  Coliseo Norte      →  agrega "norte"      →  sugiere
 *   Cancha 1       vs  Estadio 1          →  cambia "cancha"     →  no
 *   Cancha 1       vs  Cancha 2           →  cambia el número    →  no
 *   Cancha 1       vs  Cancha 10          →  cambia el número    →  no
 *   Coliseo Norte  vs  Coliseo Sur        →  cambia "norte"      →  no
 *
 * Lo que hace que funcione es comparar PALABRAS ENTERAS y no letras: si se
 * comparara letra por letra, el "1" sería el arranque del "10" y propondría
 * unir la cancha 1 con la cancha 10, que es justo el error a evitar.
 *
 * A propósito NO detecta errores de tipeo ("Ritta" contra "Rita"): eso es
 * cambiar una palabra, no agregarla. Una regla de "palabras casi iguales" se
 * equivoca bastante más seguido, y una sugerencia equivocada le hace perder la
 * confianza a todas las demás.
 */

import { CONECTORES, venueKey, type VenueOption } from "@/lib/venues";

/**
 * Los conectores, que no distinguen un lugar de otro. Sin sacarlos, "Rita"
 * contra "Rita de Arrazola" arrastra un "de" que no dice nada y el arranque no
 * coincide.
 *
 * Ojo con lo que NO está acá: "cancha", "estadio" y "coliseo" se conservan a
 * propósito, aunque sean la etiqueta del lugar y no su nombre. Sacarlas parece
 * buena idea (dejaría unir "Cancha Rita" con "Rita") pero abre la puerta a
 * proponer "Cancha 1" con "Estadio 1", que casi seguro son dos lugares
 * distintos. Se prefiere perder una sugerencia buena antes que ofrecer una
 * mala: la sugerencia equivocada le quita credibilidad a todas las demás.
 */
const RELLENO = CONECTORES;

/** Corta el nombre en palabras comparables: sin tildes, sin relleno. */
export function venueWords(venue: string): string[] {
  return venueKey(venue)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !RELLENO.has(w));
}

/**
 * ¿El primero es el arranque del segundo, palabra por palabra?
 *
 * El caso de largo igual también cuenta: dos nombres escritos distinto pueden
 * dejar las mismas palabras ("La Rita" y "Rita"), y ahí son la misma cancha.
 */
function esArranqueDe(cortas: string[], largas: string[]): boolean {
  if (cortas.length === 0 || largas.length === 0) return false;
  if (cortas.length > largas.length) return false;
  for (let i = 0; i < cortas.length; i++) {
    if (cortas[i] !== largas[i]) return false;
  }
  return true;
}

export interface VenueSuggestion {
  /** La de nombre más corto. */
  a: VenueOption;
  /** La que le agrega palabras. */
  b: VenueOption;
  /** Clave del par, ordenada, para guardar el descarte. */
  pairKey: [string, string];
}

/** Clave ordenada de un par. El orden alfabético la vuelve estable: da igual
 *  desde qué lado se mire, el par es el mismo. */
export function venuePairKey(keyA: string, keyB: string): [string, string] {
  return keyA < keyB ? [keyA, keyB] : [keyB, keyA];
}

/**
 * Todos los pares de canchas que parecen la misma.
 *
 * Recibe las canchas ya agrupadas por `collectVenues`, así que acá nunca llegan
 * dos formas del mismo texto: solo nombres realmente distintos.
 */
export function findVenueSuggestions(
  venues: VenueOption[]
): VenueSuggestion[] {
  const words = new Map<string, string[]>();
  for (const v of venues) words.set(v.key, venueWords(v.label));

  const out: VenueSuggestion[] = [];

  for (let i = 0; i < venues.length; i++) {
    for (let j = i + 1; j < venues.length; j++) {
      const vi = venues[i];
      const vj = venues[j];
      const wi = words.get(vi.key)!;
      const wj = words.get(vj.key)!;

      // El corto tiene que ser el arranque del largo. Se prueba en el único
      // sentido posible: el de menos palabras contra el de más.
      const [corta, larga] = wi.length <= wj.length ? [vi, vj] : [vj, vi];
      const [wCorta, wLarga] = wi.length <= wj.length ? [wi, wj] : [wj, wi];

      if (!esArranqueDe(wCorta, wLarga)) continue;

      out.push({
        a: corta,
        b: larga,
        pairKey: venuePairKey(vi.key, vj.key),
      });
    }
  }

  // Primero los pares que tocan más partidos: si hay varias sugerencias, la que
  // más ordena el calendario va adelante.
  return out.sort((x, y) => y.a.count + y.b.count - (x.a.count + x.b.count));
}
