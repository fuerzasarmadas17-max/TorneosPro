/**
 * Interruptor de la sección "Monetizar".
 *
 * En `false` la sección no existe para el organizador: no aparece en el menú y
 * entrar a `/dashboard/monetizar` a mano devuelve al dashboard.
 *
 * POR QUÉ ESTÁ APAGADA (2026-08-08)
 * Está construida y desplegada, pero todavía no hay anunciantes pagando. Con la
 * sección visible, un organizador entraría, dejaría su cédula y su cuenta
 * bancaria, y se quedaría esperando una plata que no puede llegar porque no hay
 * de dónde. Prometer un ingreso antes de tener con qué pagarlo es la peor forma
 * de estrenar un programa de plata.
 *
 * Además faltan dos cosas antes de mostrarla: que el dueño revise los términos
 * (`monetizar-terms.ts` es un borrador sin revisión legal) y calibrar los
 * umbrales, que hoy son números puestos sin datos.
 *
 * PARA PRENDERLA: poner `true` y desplegar. No hace falta tocar nada más — la
 * base, la aprobación y el reparto ya están en producción y funcionando.
 *
 * Mismo patrón que `PACKS_TEST_MODE` en `lib/packs.ts`: un solo lugar, para no
 * tener que acordarse de dos.
 */
export const MONETIZAR_ENABLED = false;
