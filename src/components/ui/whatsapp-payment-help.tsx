"use client";

import { MessageCircle } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { whatsappPagoUrl } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

interface WhatsappPaymentHelpProps {
  /** Qué está comprando, en palabras: `el torneo "WB GAMMA KINGS" (16 equipos)`. */
  detalle: string;
  /** El monto ya formateado, tal cual se ve en pantalla. */
  monto: string;
  /** Para acomodarlo en otra disposición (p. ej. al lado del botón). */
  className?: string;
  /** Versión para una franja angosta: sin la pregunta; en el celular solo
   *  el ícono de WhatsApp y en la compu el ícono con "Ayuda". */
  compact?: boolean;
}

/**
 * Salida por WhatsApp para quien no quiere pagar con tarjeta.
 *
 * Va DEBAJO del botón de pagar y en tamaño chico a propósito: el que iba a
 * pagar con tarjeta no debe encontrarse un obstáculo nuevo. Esto es para el
 * que ya estaba dudando, que hoy simplemente cierra la ventana y se pierde.
 */
export function WhatsappPaymentHelp({ detalle, monto, className, compact = false }: WhatsappPaymentHelpProps) {
  const { user } = useAuth();
  return (
    <p className={cn("pt-1 text-center text-xs text-muted-foreground", className)}>
      {!compact && <>¿Prefieres Nequi o transferencia?{" "}</>}
      <a
        aria-label={compact ? "¿Prefieres Nequi o transferencia? Escríbenos por WhatsApp" : undefined}
        href={whatsappPagoUrl({ nombre: user?.name, detalle, monto })}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-medium text-emerald-600 underline underline-offset-2 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:text-emerald-400 dark:hover:text-emerald-300"
      >
        <MessageCircle
          className={compact ? "h-5 w-5 sm:h-3.5 sm:w-3.5" : "h-3.5 w-3.5"}
          aria-hidden="true"
        />
        {compact ? <span className="hidden sm:inline">Ayuda</span> : "Escríbenos"}
      </a>
    </p>
  );
}
