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
 * Ver `Por hacer/fotos-de-tarjetas.md` para el mecanismo y
 * `Por hacer/prompts-fotos-tarjetas.md` para el prompt exacto con el que se
 * generó cada una (útil si hay que rehacer alguna: reescribirlo de memoria
 * pierde el par de colores, el ángulo y la jugada asignados).
 *
 * El `label` es lo único que lee el organizador en el selector, así que ahí
 * viven las categorías finas ("Mamás", "Padres", "Jóvenes"): `category` solo
 * tiene cuatro valores y agrupa, no describe.
 *
 * `beisbol`, `basketball`, `wiffleball`, `padel`, `ping-pong` y `tenis` siguen
 * vacíos a propósito — sus fotos no se han generado todavía y esos deportes
 * caen al degradado sin romper nada.
 */
export const SPORT_IMAGES: Record<string, SportImage[]> = {
  volleyball: [
    { key: "volleyball-playa-1", file: "volleyball-playa-1.jpg", label: "Volley playa (hombres)", category: "general" },
    { key: "volleyball-playa-2", file: "volleyball-playa-2.jpg", label: "Volley playa (mujeres)", category: "general" },
    { key: "volleyball-mixto-1", file: "volleyball-mixto-1.jpg", label: "Mixto", category: "general" },
    { key: "volleyball-masc-1", file: "volleyball-masc-1.jpg", label: "Masculino", category: "masculino" },
    { key: "volleyball-jov-masc-1", file: "volleyball-jov-masc-1.jpg", label: "Jóvenes", category: "masculino" },
    { key: "volleyball-padres-1", file: "volleyball-padres-1.jpg", label: "Padres", category: "masculino" },
    { key: "volleyball-mamas-1", file: "volleyball-mamas-1.jpg", label: "Mamás", category: "femenino" },
    { key: "volleyball-jov-fem-1", file: "volleyball-jov-fem-1.jpg", label: "Jóvenes", category: "femenino" },
    { key: "volleyball-inf-1", file: "volleyball-inf-1.jpg", label: "Niños", category: "infantil" },
    { key: "volleyball-inf-2", file: "volleyball-inf-2.jpg", label: "Niñas", category: "infantil" },
  ],
  softball: [
    { key: "softball-masc-1", file: "softball-masc-1.jpg", label: "Hombres", category: "masculino" },
    { key: "softball-masc-2", file: "softball-masc-2.jpg", label: "Hombres", category: "masculino" },
    { key: "softball-jov-masc-1", file: "softball-jov-masc-1.jpg", label: "Jóvenes", category: "masculino" },
    { key: "softball-jov-masc-2", file: "softball-jov-masc-2.jpg", label: "Jóvenes", category: "masculino" },
    { key: "softball-fem-1", file: "softball-fem-1.jpg", label: "Mujeres", category: "femenino" },
    { key: "softball-fem-2", file: "softball-fem-2.jpg", label: "Mujeres", category: "femenino" },
    { key: "softball-jov-fem-1", file: "softball-jov-fem-1.jpg", label: "Jóvenes", category: "femenino" },
    { key: "softball-jov-fem-2", file: "softball-jov-fem-2.jpg", label: "Jóvenes", category: "femenino" },
  ],
  microfutbol: [
    { key: "microfutbol-masc-1", file: "microfutbol-masc-1.jpg", label: "Hombres", category: "masculino" },
    { key: "microfutbol-masc-2", file: "microfutbol-masc-2.jpg", label: "Hombres", category: "masculino" },
    { key: "microfutbol-fem-1", file: "microfutbol-fem-1.jpg", label: "Mujeres", category: "femenino" },
    { key: "microfutbol-fem-2", file: "microfutbol-fem-2.jpg", label: "Mujeres", category: "femenino" },
  ],
  futsal: [
    { key: "futsal-masc-1", file: "futsal-masc-1.jpg", label: "Hombres", category: "masculino" },
    { key: "futsal-masc-2", file: "futsal-masc-2.jpg", label: "Hombres", category: "masculino" },
    { key: "futsal-fem-1", file: "futsal-fem-1.jpg", label: "Mujeres", category: "femenino" },
    { key: "futsal-fem-2", file: "futsal-fem-2.jpg", label: "Mujeres", category: "femenino" },
  ],
  futbol: [
    { key: "futbol-masc-1", file: "futbol-masc-1.jpg", label: "Adultos", category: "masculino" },
    { key: "futbol-masc-2", file: "futbol-masc-2.jpg", label: "Adultos", category: "masculino" },
    { key: "futbol-jov-masc-1", file: "futbol-jov-masc-1.jpg", label: "Jóvenes", category: "masculino" },
  ],
  // Las cuatro son de menores a propósito: los cuatro torneos de béisbol en
  // producción son Pony, Pre-Infantil, Infantil y Pre-Junior. No hay ninguno
  // de adultos, así que una foto de adultos no le serviría a nadie. Se
  // etiquetan por la jugada y no por edad porque a simple vista los chicos de
  // 11 y los de 15 no se distinguen, y una etiqueta de edad que no se puede
  // verificar en la foto confunde más de lo que ayuda.
  beisbol: [
    { key: "beisbol-inf-1", file: "beisbol-inf-1.jpg", label: "Lanzando", category: "infantil" },
    { key: "beisbol-inf-2", file: "beisbol-inf-2.jpg", label: "Con el entrenador", category: "infantil" },
    { key: "beisbol-inf-3", file: "beisbol-inf-3.jpg", label: "Robando base", category: "infantil" },
    { key: "beisbol-inf-4", file: "beisbol-inf-4.jpg", label: "Bateando", category: "infantil" },
  ],
  basketball: [],
  wiffleball: [],
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
 * Resuelve la foto de cada torneo: **solo la que eligió su organizador**.
 * Sin elección explícita devuelve null, y la tarjeta cae al degradado del
 * deporte.
 *
 * ⚠️ ANTES esto repartía por turnos: al torneo que no había elegido se le
 * asignaba una foto cualquiera de su deporte, rotando para que dos vecinos no
 * se repitieran. **Se quitó a pedido del organizador (2026-08-15)**, y el
 * motivo importa para no reponerlo sin pensarlo:
 *
 * El reparto miraba el DEPORTE pero no la CATEGORÍA. Con 10 fotos de
 * volleyball que van desde niñas hasta padres, a un torneo de mamás le podía
 * tocar la foto de niños. Eso no se lee como "una foto genérica bonita", se
 * lee como que el sistema se equivocó — y encima el organizador no tiene por
 * qué saber que puede cambiarla.
 *
 * El degradado no miente: dice "todavía no hay foto elegida" y ya. Si algún
 * día se repone el reparto, tiene que filtrar por `category` primero.
 */
export function buildSportImageMap(
  tournaments: { id: string; sport: string; cardImage?: string | null }[]
): Map<string, string | null> {
  const map = new Map<string, string | null>();
  // La portada pasa la grilla y los destacados juntos, así que un mismo
  // torneo puede venir dos veces. `map.has` lo resuelve solo.
  for (const t of tournaments) {
    if (map.has(t.id)) continue;
    map.set(t.id, resolveSportImage(t.sport, t.cardImage));
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
