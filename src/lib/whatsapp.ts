// WhatsApp de servicio al cliente de Torneos Pro.
//
// POR QUÉ EXISTE ESTO
// Entre julio y agosto de 2026, siete clientes reales llegaron hasta la
// pasarela de Wompi y ninguno completó: Wompi nunca confirmó ni uno. Eran un
// paquete de 5 torneos de Abel, otro de Daniel, el torneo "WB GAMMA KINGS" de
// William y dos upgrades. $770.000 en intención de compra que se cayó en el
// último paso. Mientras tanto, los pagos que SÍ se cobraron fueron los de la
// gente que escribió por privado y pagó por Nequi.
//
// La salida por WhatsApp no reemplaza la pasarela: le da una puerta al que
// duda, justo antes de irse.
export const WHATSAPP_SOPORTE = "573243729012";

/**
 * Link de WhatsApp con el mensaje ya escrito. La idea es que el organizador no
 * tenga que explicar nada y que del otro lado se sepa de una quién es, qué
 * quiere comprar y cuánto — si el mensaje llega vacío, la conversación arranca
 * con tres preguntas y ahí se pierde otra vez.
 */
export function whatsappPagoUrl(params: {
  nombre?: string | null;
  detalle: string;
  monto: string;
}): string {
  const quien = params.nombre?.trim() ? `Hola, soy ${params.nombre.trim()}.` : "Hola.";
  const texto = `${quien} Estoy comprando ${params.detalle} por ${params.monto} en Torneos Pro y quiero pagar por otro medio (Nequi o transferencia).`;
  return `https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(texto)}`;
}

/**
 * Link de ayuda general, sin nada que ver con un cobro. Se usa en el botón
 * flotante del panel del organizador y en el modal de bienvenida.
 */
export function whatsappAyudaUrl(nombre?: string | null): string {
  const quien = nombre?.trim() ? `Hola, soy ${nombre.trim()}.` : "Hola.";
  const texto = `${quien} Estoy usando Torneos Pro y necesito una mano.`;
  return `https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(texto)}`;
}
