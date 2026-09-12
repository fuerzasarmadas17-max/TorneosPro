/**
 * Dónde vive la planilla mientras se juega: en el navegador del teléfono de la
 * mesa, no en la base.
 *
 * POR QUÉ. En un coliseo de barrio a veces hay señal y a veces no (respuesta del
 * dueño, 2026-09-12), así que la planilla tiene que funcionar desconectada. Y
 * aunque hubiera señal, guardar en el teléfono a cada punto es lo que hace que
 * un toque mal dado, una pantalla que se apaga o una pestaña que se cambia no
 * borren medio set. Sin esto no la usan dos veces.
 *
 * Se guarda entera en cada cambio. Un set son unos 50 eventos y un partido
 * completo no llega a 5 KB: no vale la pena nada más fino.
 *
 * CUÁNDO SE BORRA. Cuando el resultado del partido ya se mandó y el servidor lo
 * aceptó. Antes no, ni siquiera al cerrar un set: mientras el partido no esté
 * guardado, lo único que existe es esto.
 */

import type { Planilla } from "./planilla";

/** Una clave por partido y por link. Dos mesas distintas en el mismo teléfono
 *  no se pisan, y el mismo partido abierto con otro link tampoco. */
function clave(token: string, matchId: string): string {
  return `planilla_volley_${token}_${matchId}`;
}

/**
 * Lee la planilla guardada, o `null` si no hay ninguna.
 *
 * Todo va en try/catch a propósito: en una ventana privada, con el
 * almacenamiento lleno o con las cookies bloqueadas, `localStorage` tira
 * excepción al leer. Ahí la planilla arranca vacía, que es molesto pero
 * funciona; que la pantalla no abra sería peor.
 */
export function leerPlanilla(token: string, matchId: string): Planilla | null {
  if (typeof window === "undefined") return null;
  try {
    const crudo = window.localStorage.getItem(clave(token, matchId));
    if (!crudo) return null;
    const parsed = JSON.parse(crudo) as Planilla;
    // Una planilla de una versión que no conocemos se ignora en vez de
    // romperse: es preferible volver a anotar la nómina que quedar con una
    // pantalla en blanco por un dato viejo.
    if (parsed?.version !== 1 || parsed.matchId !== matchId) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Guarda. Devuelve `false` si el navegador no dejó, para que la pantalla pueda
 *  avisar que lo anotado no va a sobrevivir a una recarga. */
export function guardarPlanilla(
  token: string,
  matchId: string,
  planilla: Planilla
): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(clave(token, matchId), JSON.stringify(planilla));
    return true;
  } catch {
    return false;
  }
}

/** Borra la planilla del teléfono. Solo después de que el resultado quedó
 *  guardado en el servidor. */
export function borrarPlanilla(token: string, matchId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(clave(token, matchId));
  } catch {
    // Si no se pudo borrar no pasa nada: la próxima vez que se abra ese
    // partido, el partido ya está terminado y la planilla no se usa.
  }
}
