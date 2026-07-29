/**
 * Tope de frecuencia del modal de publicidad: cuántas veces por día se le
 * muestra a una misma persona.
 *
 * Hasta el 2026-07-29 el modal se mostraba en CADA carga, sin tope (decisión
 * 2026-07-03). Esa decisión se tomó cuando las impresiones eran la única
 * métrica que teníamos y maximizarlas era lo racional. Hoy personas-día es lo
 * que liquida y las impresiones son lo que se le reporta al anunciante, así que
 * inflarlas juega en contra: "llegamos a 3.000 personas" vende mejor que "nos
 * mostramos 40.000 veces a las mismas 200".
 *
 * El tope NO afecta la liquidación. Personas-día cuenta personas distintas por
 * día, así que quien entra 20 veces aporta 1 con tope o sin él.
 */

const CAP_KEY = "tp_ad_shown";

/** Impresiones por persona y día. */
export const AD_DAILY_CAP = 7;

interface CapState {
  /** Día local, YYYY-MM-DD. */
  d: string;
  /** Cuántas se mostraron ese día. */
  n: number;
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
 * Lee el contador de hoy. Devuelve 0 si es otro día, si no hay nada guardado o
 * si lo guardado no se puede interpretar.
 *
 * Nunca lanza: `localStorage` tira excepción en algunos modos privados, y la
 * publicidad no puede romper la vista del torneo. Si falla, devuelve 0 — o sea
 * el tope se abre y se muestra el aviso, que es el comportamiento que había
 * antes de que este tope existiera.
 */
export function adsShownToday(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(CAP_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as Partial<CapState>;
    if (parsed?.d !== localDay()) return 0;
    return typeof parsed.n === "number" && parsed.n > 0 ? parsed.n : 0;
  } catch {
    return 0;
  }
}

/** ¿Ya se le mostró el máximo del día a esta persona? */
export function adCapReached(): boolean {
  return adsShownToday() >= AD_DAILY_CAP;
}

/** Suma una impresión al día de hoy. Silencioso si `localStorage` falla. */
export function recordAdShown(): void {
  if (typeof window === "undefined") return;
  try {
    const next: CapState = { d: localDay(), n: adsShownToday() + 1 };
    localStorage.setItem(CAP_KEY, JSON.stringify(next));
  } catch {
    /* sin storage no hay tope; mejor eso que romper la vista */
  }
}
