/**
 * Interruptor de la planilla en vivo de vóley.
 *
 * En `false` el botón "Planilla en vivo" no aparece en la lista de partidos del
 * planillero, y la mesa sigue cargando el resultado al final como siempre.
 *
 * APAGADA. Se prende cuando esté la pantalla del marcador (paso 4) y se haya
 * probado en una cancha real. Mientras tanto están construidas las dos
 * pantallas de antes del partido —quiénes juegan y la rotación de arranque— y
 * una mesa que se las encuentre por accidente quedaría a mitad de camino, sin
 * poder anotar un punto.
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
