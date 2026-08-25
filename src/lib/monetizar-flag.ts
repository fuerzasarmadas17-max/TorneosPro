/**
 * Interruptor de la sección "Monetizar".
 *
 * En `false` la sección no existe para el organizador: no aparece en el menú y
 * entrar a `/dashboard/monetizar` a mano devuelve al dashboard.
 *
 * PRENDIDA EL 2026-08-25.
 *
 * Estuvo apagada desde el 2026-08-08 porque no había anunciantes pagando: un
 * organizador habría entrado, dejado su cédula y su cuenta bancaria, y se
 * habría quedado esperando una plata que no podía llegar. Ya hay campañas
 * cobradas, los términos cubren los casos que faltaban (el descuento de los
 * torneos fiados y que un mes sin publicidad paga da cero) y la sección de
 * abonos está construida.
 *
 * ⚠️ LO QUE TODAVÍA NO ESTABA AL PRENDERLA — ver
 * `Por hacer/deuda-contra-publicidad.md` §5:
 *   - Los umbrales de `monetization_config` siguen sin calibrar (se calibran
 *     con agosto completo). Mientras tanto es normal que casi nadie clasifique
 *     y que el progreso se vea bajo.
 *   - El punto de impuestos y retenciones de los términos no lo revisó un
 *     contador.
 *   - Los dos números de los términos —el mínimo de $50.000 para transferir y
 *     el plazo de 15 días— siguen siendo una propuesta.
 *
 * PARA APAGARLA: poner `false` y desplegar. Los datos ya cargados no se pierden.
 *
 * Mismo patrón que `PACKS_TEST_MODE` en `lib/packs.ts`: un solo lugar, para no
 * tener que acordarse de dos.
 */
export const MONETIZAR_ENABLED = true;
