import { SPORTS } from "./sports";

/**
 * Categoría de una foto. Un torneo infantil con una foto de hombres adultos
 * se ve mal, y al revés también — por eso el set no es solo "por deporte"
 * sino "por deporte y por a quién retrata".
 */
export type SportImageCategory =
  | "general"
  | "masculino"
  | "femenino"
  | "infantil";

export const CATEGORY_LABELS: Record<SportImageCategory, string> = {
  general: "General",
  masculino: "Masculino",
  femenino: "Femenino",
  infantil: "Infantil",
};

export interface SportImage {
  /**
   * Clave estable de la foto. Es LO QUE SE GUARDA en la base
   * (`tournaments.card_image`), no la ruta.
   *
   * Guardar la clave y no la URL es a propósito: el organizador escribe esa
   * columna (la policy "Creador edita torneo" se lo permite), así que si
   * guardáramos una URL cualquiera terminaría renderizándose una imagen
   * arbitraria. Con claves, un valor que no esté en esta lista simplemente
   * no resuelve y la tarjeta cae al degradado.
   */
  key: string;
  /** Archivo en `public/sports/`. */
  file: string;
  /** Lo que el organizador lee en el selector. */
  label: string;
  category: SportImageCategory;
}

/**
 * Fotos de fondo de las tarjetas de torneo, por deporte.
 *
 * Van varias por deporte y no una sola porque el catálogo está muy
 * desbalanceado: la mitad de los torneos son de volleyball. Con una foto por
 * deporte, la portada mostraría seis tarjetas y hasta cinco con la misma
 * imagen repetida — se lee como un error de carga, no como un diseño.
 *
 * Los archivos van en `public/sports/`. Mientras las listas estén vacías, la
 * tarjeta cae al degradado de `SPORT_GRADIENTS`; sumar una foto es agregar el
 * archivo y su entrada acá, sin tocar ningún componente.
 *
 * Ver `Por hacer/fotos-por-deporte.md` para qué hay que producir.
 */
export const SPORT_IMAGES: Record<string, SportImage[]> = {
  futbol: [],
  futsal: [],
  microfutbol: [],
  beisbol: [],
  softball: [],
  wiffleball: [],
  volleyball: [],
  basketball: [],
  padel: [],
  "ping-pong": [],
  tenis: [],
};

/**
 * Degradado de reemplazo mientras no hay foto. Va del marino de la marca al
 * dorado pasando por el hue que ese deporte ya tiene en `sportColors` de
 * `tournament-card.tsx`, así el fondo sigue diciendo de qué deporte es.
 *
 * Clases literales a propósito: Tailwind no genera nombres construidos por
 * interpolación, tienen que estar completas para que el JIT las incluya.
 */
export const SPORT_GRADIENTS: Record<string, string> = {
  futbol: "bg-gradient-to-br from-[#16233d] via-[#1d5c3a] to-[#c8973e]",
  futsal: "bg-gradient-to-br from-[#16233d] via-[#146b52] to-[#c8973e]",
  microfutbol: "bg-gradient-to-br from-[#16233d] via-[#3f6b12] to-[#c8973e]",
  beisbol: "bg-gradient-to-br from-[#16233d] via-[#8c2b28] to-[#c8973e]",
  softball: "bg-gradient-to-br from-[#16233d] via-[#8f2f4d] to-[#c8973e]",
  wiffleball: "bg-gradient-to-br from-[#16233d] via-[#8a5a12] to-[#c8973e]",
  volleyball: "bg-gradient-to-br from-[#16233d] via-[#1a5f8a] to-[#c8973e]",
  basketball: "bg-gradient-to-br from-[#16233d] via-[#94491a] to-[#c8973e]",
  padel: "bg-gradient-to-br from-[#16233d] via-[#453a91] to-[#c8973e]",
  "ping-pong": "bg-gradient-to-br from-[#16233d] via-[#155f6e] to-[#c8973e]",
  tenis: "bg-gradient-to-br from-[#16233d] via-[#7a6410] to-[#c8973e]",
};

/** Degradado de último recurso, para un deporte que no esté en el mapa. */
export const FALLBACK_GRADIENT =
  "bg-gradient-to-br from-[#16233d] via-[#22334f] to-[#c8973e]";

export function getSportGradient(sport: string): string {
  return SPORT_GRADIENTS[sport] ?? FALLBACK_GRADIENT;
}

/** Las fotos disponibles para un deporte, para poblar el selector. */
export function imagesForSport(sport: string): SportImage[] {
  return SPORT_IMAGES[sport] ?? [];
}

/**
 * Resuelve la foto que el organizador eligió a una ruta servible.
 *
 * Devuelve null si la clave no existe o no pertenece a ese deporte: eso
 * cubre el caso de una clave inventada a mano en la base y el de una foto
 * que se retiró del set después de que alguien la eligiera.
 */
export function resolveSportImage(
  sport: string,
  key: string | null | undefined
): string | null {
  if (!key) return null;
  const img = (SPORT_IMAGES[sport] ?? []).find((i) => i.key === key);
  return img ? `/sports/${img.file}` : null;
}

/**
 * Asigna a cada torneo cuál de las fotos de su deporte le toca, para los que
 * no eligieron ninguna.
 *
 * Determinístico y estable, igual que `buildTournamentColorMap()` en
 * `lib/tournament-colors.ts`: si la foto cambiara en cada recarga, el
 * visitante perdería el reconocimiento visual del torneo entre visitas.
 *
 * Se reparte por turnos dentro de cada deporte, sobre los ids ordenados: dos
 * torneos vecinos del mismo deporte nunca caen en la misma foto mientras haya
 * fotos disponibles, que es justo el caso feo (la fila de seis tarjetas de
 * béisbol clonadas del mockup oscuro).
 *
 * Si el torneo tiene `cardImage`, gana esa: la elección del organizador
 * manda sobre el reparto automático.
 */
export function buildSportImageMap(
  tournaments: { id: string; sport: string; cardImage?: string | null }[]
): Map<string, string | null> {
  const map = new Map<string, string | null>();
  const bySport = new Map<string, string[]>();

  // Se descartan los ids repetidos: la portada le pasa la grilla y los
  // destacados juntos, y un torneo puede estar en las dos listas. Contarlo
  // dos veces correría el reparto de todos los que vienen detrás.
  const seen = new Set<string>();
  for (const t of tournaments) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);

    // Elección explícita del organizador: no entra al reparto automático.
    const chosen = resolveSportImage(t.sport, t.cardImage);
    if (chosen) {
      map.set(t.id, chosen);
      continue;
    }

    const ids = bySport.get(t.sport);
    if (ids) ids.push(t.id);
    else bySport.set(t.sport, [t.id]);
  }

  for (const [sport, ids] of bySport) {
    const photos = SPORT_IMAGES[sport] ?? [];
    // Ordenar por id, no por el orden de render: así el reparto no depende
    // del filtro ni del orden en que vinieron de la base.
    [...ids].sort().forEach((id, i) => {
      map.set(
        id,
        photos.length > 0 ? `/sports/${photos[i % photos.length].file}` : null
      );
    });
  }

  return map;
}

/**
 * Fotos del hero, una por deporte fuerte. Van en `public/hero/<key>.jpg`, con
 * la acción hacia la derecha: la mitad izquierda la ocupa el título. Vacío
 * hasta que lleguen; el hero cae al degradado igual que las tarjetas.
 */
export interface HeroImage {
  src: string;
  /**
   * `object-position` de esta foto en particular.
   *
   * Hace falta uno por foto y no uno global porque la banda del hero es
   * mucho más ancha que alta: en una pantalla de 1920 solo se ve el 44% de
   * la altura de la imagen. Con la acción a distinta altura en cada una (el
   * balón de volley arriba, el deslizamiento del softball abajo), un recorte
   * único deja a la mitad de las fotos cortadas.
   *
   * Se aplica como estilo en línea, no como clase de Tailwind: el JIT no
   * genera clases construidas por interpolación.
   */
  position: string;
}

export const HERO_IMAGES: Record<string, HeroImage> = {
  // El balón está casi en el borde de arriba: hay que anclar bien alto.
  volleyball: { src: "/hero/volleyball.jpg", position: "75% 15%" },
  // La chilena ocupa la franja media.
  futbol: { src: "/hero/futbol.jpg", position: "75% 45%" },
  // El pitcher ocupa casi toda la altura; se prioriza cabeza y torso.
  beisbol: { src: "/hero/beisbol.jpg", position: "70% 12%" },
  // El deslizamiento y el plato están abajo.
  softball: { src: "/hero/softball.jpg", position: "70% 70%" },
  // Primer plano de los pies: el balón está bien abajo del encuadre.
  microfutbol: { src: "/hero/microfutbol.jpg", position: "70% 80%" },
};

/** Deportes que tienen al menos una foto real cargada. */
export function sportsWithPhotos(): string[] {
  return SPORTS.map((s) => s.key).filter(
    (key) => (SPORT_IMAGES[key] ?? []).length > 0
  );
}
