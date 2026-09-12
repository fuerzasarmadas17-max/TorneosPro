/**
 * Mandar el resultado del partido, aunque en ese momento no haya señal.
 *
 * POR QUÉ UNA COLA Y NO UN `fetch` Y LISTO. En los coliseos a veces hay señal y
 * a veces no (respuesta del dueño, 2026-09-12). Si el envío fuera un fetch
 * suelto, el partido que termina en un momento sin red se pierde o queda
 * esperando a que la mesa se acuerde de reintentar, que es lo mismo que
 * perderse. Con la cola, el resultado queda anotado en el teléfono como
 * "pendiente de mandar" y sale solo cuando vuelve la red.
 *
 * CUÁNDO SE MANDA. Al terminar el PARTIDO, no al cerrar cada set. El endpoint
 * del planillero valida el partido completo —`validateVolleyballSets` exige que
 * el ganador llegue a los sets que se piden— así que un 1-0 a mitad de camino se
 * rechaza, y con razón: es la regla que impide que un partido a medio cargar
 * desordene la tabla de posiciones.
 *
 * NO SE MANDAN LOS PUNTOS, solo los parciales de cada set. Es lo único que el
 * sistema guarda hoy de un partido de vóley. Mandar punto por punto es la
 * entrega 2, y como la planilla ya guarda la lista adentro del teléfono, ese día
 * es agregar el envío y nada más.
 */

import { borrarPlanilla } from "./planilla-storage";

const CLAVE = "planilla_volley_envios";

/** Lo que viaja al endpoint del planillero. */
export interface CuerpoDelEnvio {
  scorerName: string;
  homeScore: number;
  awayScore: number;
  sets: { setNumber: number; homePoints: number; awayPoints: number }[];
}

export interface EnvioPendiente {
  token: string;
  matchId: string;
  cuerpo: CuerpoDelEnvio;
  /** Cuándo terminó el partido, para poder decir "hace 20 minutos". */
  creadoEn: string;
  /**
   * Por qué no se pudo mandar, cuando reintentar no va a servir: el link
   * venció, o el servidor rechazó el marcador. Se guarda para poder mostrarlo;
   * mientras esté puesto, la cola no lo reintenta sola.
   */
  errorPermanente?: string;
}

// ============================================================
// La cola, en el teléfono
// ============================================================

export function listarPendientes(): EnvioPendiente[] {
  if (typeof window === "undefined") return [];
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return [];
    const lista = JSON.parse(crudo) as EnvioPendiente[];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function escribir(lista: EnvioPendiente[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    // Si no se puede escribir, el envío igual se intenta ahora mismo. Lo que se
    // pierde es el reintento automático, y de eso ya avisa la planilla.
  }
}

/** Mete un envío en la cola, o reemplaza el que hubiera de ese mismo partido. */
export function encolar(envio: EnvioPendiente): void {
  const lista = listarPendientes().filter((e) => e.matchId !== envio.matchId);
  escribir([...lista, envio]);
}

export function quitarDeLaCola(matchId: string): void {
  escribir(listarPendientes().filter((e) => e.matchId !== matchId));
}

export function pendienteDe(matchId: string): EnvioPendiente | undefined {
  return listarPendientes().find((e) => e.matchId === matchId);
}

// ============================================================
// El envío
// ============================================================

export type ResultadoDelEnvio =
  | { estado: "enviado" }
  /** No hay red, o el servidor falló. Reintentar después sirve. */
  | { estado: "sin-red"; mensaje: string }
  /** El servidor lo rechazó. Reintentar no sirve: hay que arreglar algo. */
  | { estado: "rechazado"; mensaje: string };

/**
 * Intenta mandar un envío. Si sale bien, lo saca de la cola y borra la planilla
 * del teléfono — recién ahí, porque mientras el resultado no esté guardado en el
 * servidor lo único que existe es lo del teléfono.
 */
export async function intentarEnviar(
  envio: EnvioPendiente
): Promise<ResultadoDelEnvio> {
  let res: Response;
  try {
    res = await fetch(`/api/scorer/${envio.token}/match/${envio.matchId}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envio.cuerpo),
    });
  } catch {
    return {
      estado: "sin-red",
      mensaje: "No hay señal. El resultado queda guardado y sale solo cuando vuelva.",
    };
  }

  if (res.ok) {
    quitarDeLaCola(envio.matchId);
    borrarPlanilla(envio.token, envio.matchId);
    return { estado: "enviado" };
  }

  // 429 es el tope de guardados por minuto y 5xx es el servidor con problemas:
  // los dos se arreglan solos esperando, así que se tratan como falta de red.
  if (res.status === 429 || res.status >= 500) {
    return {
      estado: "sin-red",
      mensaje: "El servidor no pudo recibirlo ahora. Se reintenta solo.",
    };
  }

  let mensaje = "El servidor rechazó el resultado.";
  try {
    const json = (await res.json()) as { error?: string };
    if (json?.error) mensaje = json.error;
  } catch {
    // Un cuerpo que no es JSON no cambia nada: queda el mensaje genérico.
  }
  if (res.status === 404) {
    mensaje = "Este link de planillero ya no vale. Pedile uno nuevo al organizador.";
  }

  // Se deja en la cola con el motivo escrito, para que la mesa lo vea y pueda
  // reintentar a mano después de arreglarlo. Borrarlo sería perder el partido.
  const lista = listarPendientes().map((e) =>
    e.matchId === envio.matchId ? { ...e, errorPermanente: mensaje } : e
  );
  escribir(lista);
  return { estado: "rechazado", mensaje };
}

/**
 * Reintenta todo lo que quedó pendiente. Se llama al abrir la página del
 * planillero y cuando el navegador avisa que volvió la red.
 *
 * Los que fueron rechazados no se tocan: reintentarlos solo repetiría el mismo
 * error contra el servidor cada vez que hay señal.
 */
export async function reintentarPendientes(
  onEnviado?: (matchId: string) => void
): Promise<void> {
  for (const envio of listarPendientes()) {
    if (envio.errorPermanente) continue;
    const r = await intentarEnviar(envio);
    if (r.estado === "enviado") onEnviado?.(envio.matchId);
    // Si sigue sin red, se corta: los demás van a fallar igual.
    if (r.estado === "sin-red") break;
  }
}
