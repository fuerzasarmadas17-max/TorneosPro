"use client";

import { MessageCircle } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { whatsappAyudaUrl } from "@/lib/whatsapp";

/**
 * Botón flotante de WhatsApp, sólo en el panel del organizador.
 *
 * NO va en las páginas públicas de torneo, y no es un olvido: el 95% del
 * tráfico son espectadores mirando resultados (~8.000 visitas al mes). Un
 * botón de WhatsApp ahí llenaría el teléfono de "¿a qué hora juega mi equipo?"
 * y taparía a los organizadores, que son los que pagan.
 */
export function WhatsappFab() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <a
      href={whatsappAyudaUrl(user.name)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribirnos por WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 motion-safe:hover:scale-105"
    >
      <MessageCircle className="h-5 w-5" aria-hidden="true" />
      {/* En móvil sólo el ícono: el 80% entra desde el celular y una etiqueta
          fija ahí le tapa media pantalla. */}
      <span className="hidden sm:inline">Ayuda</span>
    </a>
  );
}
