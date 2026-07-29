/**
 * Tope de frecuencia del modal de publicidad: cuántas veces por día se le
 * muestra a una misma persona, EN CADA TORNEO.
 *
 * Hasta el 2026-07-29 el modal se mostraba en CADA carga, sin tope (decisión
 * 2026-07-03). Esa decisión se tomó cuando las impresiones eran la única
 * métrica y maximizarlas era lo racional. Hoy personas-día es lo que liquida y
 * las impresiones son lo que se le reporta al anunciante, así que inflarlas
 * juega en contra: "llegamos a 3.000 personas" vende mejor que "nos mostramos
 * 40.000 veces a las mismas 200".
 *
 * ----------------------------------------------------------------------------
 * POR QUÉ EL TOPE ES POR TORNEO Y NO GLOBAL
 * ----------------------------------------------------------------------------
 * El primer intento usó una cuota global por día. Eso rompía el reparto.
 *
 * El crédito de personas-día se registra SOLO cuando hay un `ad_impression`.
 * Con cuota global, quien quemaba sus impresiones en el torneo de un
 * organizador y después abría los de otros tres no generaba impresión en esos
 * tres, así que esos organizadores no recibían crédito por una persona que sí
 * visitó su torneo ese día.
 *
 * Lo grave no era perder el dato sino que el sesgo NO era parejo: favorecía al
 * torneo que la persona abre primero, que suele ser el principal. Los
 * secundarios —normalmente los organizadores más chicos— perdían crédito. Todo
 * el razonamiento del plan se apoya en que los sesgos golpeen a todos por
 * igual, porque en un reparto proporcional un sesgo parejo se cancela.
 *
 * Con cuota por torneo, cada organizador siempre captura la persona-día de
 * quien lo visitó. El techo total sube (alguien que abre 4 torneos podría ver
 * hasta 4 × AD_DAILY_CAP en un día), y es el precio de que el reparto sea
 * correcto.
 *
 * El tope tampoco cambia personas-día dentro de un mismo torneo: cuenta
 * personas distintas por día, así que quien entra 20 veces aporta 1 con tope o
 * sin él.
 */

const CAP_KEY = "tp_ad_shown";

/** Impresiones por persona, por torneo y por día. */
export const AD_DAILY_CAP = 7;

interface CapState {
  /** Día local, YYYY-MM-DD. */
  d: string;
  /** Cuántas se mostraron ese día, por `tournament_id`. */
  c: Record<string, number>;
}

/**
 * Día local, no UTC. El tope existe para que la persona no vea el mismo aviso
 * todo el día, así que "día" tiene que ser el suyo.
 *
 * Ojo que la métrica sí se agrupa en UTC (`created_at::date` en Postgres), o
 * sea que en Colombia (UTC-5) el corte del tope y el de personas-día no caen a
 * la misma hora. No importa: son cosas distintas y el tope no alimenta la
 * liquidación.
 */
function localDay(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

/**
 * Estado de hoy. Devuelve el mapa vacío si es otro día, si no hay nada
 * guardado o si lo guardado no se puede interpretar — incluido el formato
 * viejo de cuota global (`{d, n}`), que simplemente arranca de cero.
 *
 * Nunca lanza: `localStorage` tira excepción en algunos modos privados, y la
 * publicidad no puede romper la vista del torneo. Si falla, el tope se abre y
 * se muestra el aviso, que es el comportamiento que había antes de que este
 * tope existiera.
 */
function readState(): CapState {
  const empty: CapState = { d: localDay(), c: {} };
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(CAP_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<CapState>;
    if (parsed?.d !== localDay()) return empty;
    if (!parsed.c || typeof parsed.c !== "object") return empty;
    return { d: parsed.d, c: parsed.c as Record<string, number> };
  } catch {
    return empty;
  }
}

/** Cuántas veces se le mostró hoy el modal a esta persona en este torneo. */
export function adsShownToday(tournamentId: string): number {
  const n = readState().c[tournamentId];
  return typeof n === "number" && n > 0 ? n : 0;
}

/** ¿Ya se le mostró el máximo del día en ESTE torneo? */
export function adCapReached(tournamentId: string): boolean {
  return adsShownToday(tournamentId) >= AD_DAILY_CAP;
}

/** Suma una impresión al día de hoy en este torneo. Silencioso si falla. */
export function recordAdShown(tournamentId: string): void {
  if (typeof window === "undefined") return;
  try {
    const state = readState();
    state.c[tournamentId] = (state.c[tournamentId] ?? 0) + 1;
    localStorage.setItem(CAP_KEY, JSON.stringify(state));
  } catch {
    /* sin storage no hay tope; mejor eso que romper la vista */
  }
}
