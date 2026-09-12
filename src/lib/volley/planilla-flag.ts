/**
 * Interruptor de la planilla en vivo de vóley.
 *
 * En `false` el botón "Planilla en vivo" no aparece en la lista de partidos del
 * planillero, y la mesa sigue cargando el resultado al final como siempre.
 *
 * APAGADA, pero ya no porque falte algo: la planilla está completa y manda el
 * resultado sola. Falta probarla en una cancha de verdad, con una mesa de
 * verdad, y esa prueba la decide el dueño. Se prende poniendo `true` acá y
 * desplegando; nada más hay que tocar.
 *
 * Lo único que NO hace todavía es abrirse sin señal la primera vez (el service
 * worker, entrega 3): una vez cargada la página funciona desconectada, pero
 * llegar a un coliseo sin red y abrir el link no va a andar.
 *
 * PARA VERLA SIN PRENDERLA: agregarle `?planilla=1` al link del planillero. Es
 * para mirar y para probar; no deja el botón puesto para nadie más.
 *
 * Mismo patrón que `MONETIZAR_ENABLED` en `lib/monetizar-flag.ts`: una
 * constante en un solo lugar, para no tener que acordarse de dos.
 */
export const PLANILLA_VOLLEY_ENABLED = false;

/** Si la planilla se puede abrir en esta visita: o está prendida para todos, o
 *  el que abrió el link puso `?planilla=1` a mano. */
export function planillaVolleyVisible(search: string | null | undefined): boolean {
  if (PLANILLA_VOLLEY_ENABLED) return true;
  if (!search) return false;
  try {
    return new URLSearchParams(search).get("planilla") === "1";
  } catch {
    return false;
  }
}
