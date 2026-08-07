/**
 * Catálogo de paquetes de torneos (créditos prepagos).
 *
 * Ver `Por hacer/paquetes-de-torneos.md` para el razonamiento comercial: por
 * qué el techo es 24 equipos, por qué solo hay uno de 5, y los puntos de
 * equilibrio.
 *
 * ⚠️ Esta es la ÚNICA fuente del precio. La ruta que crea el cobro lo lee de
 * acá y nunca del cliente — un monto que viaja desde el navegador es un monto
 * que el navegador puede cambiar.
 */

/**
 * Modo prueba. En `true` el paquete cuesta $5.000 y la franja de compra solo la
 * ve un admin.
 *
 * Se usó para probar el pago en producción, porque Wompi no se puede probar en
 * local: el webhook nunca llega a localhost. Se apagó el 2026-08-07, después de
 * verificar la compra, la acreditación de los 5 créditos y el consumo.
 *
 * Queda como interruptor por si hay que volver a probar algo del flujo de pago
 * sin exponerlo — es una línea, y apaga las dos cosas a la vez.
 */
export const PACKS_TEST_MODE = false;

export interface TournamentPack {
  id: string;
  label: string;
  /** Cuántos torneos incluye. */
  credits: number;
  priceCop: number;
  /** Equipos que cubre cada crédito. Por encima, se paga la diferencia. */
  maxTeams: number;
  /** Vigencia en meses desde la compra. */
  months: number;
}

/**
 * Vigencia de 12 meses: la temporada real son ~4 meses al año, así que un año
 * cubre una temporada completa con margen de sobra para 5 torneos.
 */
export const TOURNAMENT_PACKS: Record<string, TournamentPack> = {
  "pack-5": {
    id: "pack-5",
    label: "Paquete de 5 torneos",
    credits: 5,
    priceCop: PACKS_TEST_MODE ? 5_000 : 320_000,
    maxTeams: 24,
    months: 12,
  },
};

/** Lo que vale cada torneo del paquete. Es el dato que permite avisarle al
 *  organizador cuándo NO le conviene gastar un crédito. */
export function pricePerCredit(pack: TournamentPack): number {
  return Math.round(pack.priceCop / pack.credits);
}

export function getPack(id: string): TournamentPack | null {
  return TOURNAMENT_PACKS[id] ?? null;
}
