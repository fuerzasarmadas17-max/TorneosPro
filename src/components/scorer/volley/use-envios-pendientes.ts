"use client";

/**
 * Reintenta solo los resultados que quedaron sin mandar.
 *
 * Vive en la página del planillero y no dentro de la planilla a propósito: el
 * partido que terminó sin señal se manda igual aunque la mesa haya cerrado esa
 * pantalla, o incluso la pestaña, y vuelva un rato después. Si el reintento
 * viviera adentro de la planilla, habría que volver a entrar al partido para que
 * saliera, que es justo lo que nadie se acuerda de hacer.
 *
 * Dos momentos en que se reintenta: al abrir la página, y cuando el navegador
 * avisa que volvió la red.
 */

import { useEffect } from "react";
import { reintentarPendientes } from "@/lib/volley/envio";

export function useEnviosPendientes(onEnviado: () => void) {
  useEffect(() => {
    let vivo = true;
    const reintentar = () => {
      void reintentarPendientes(() => {
        // El componente puede haberse desmontado mientras viajaba el envío: el
        // resultado ya está guardado igual, lo único que sobra es refrescar.
        if (vivo) onEnviado();
      });
    };
    reintentar();
    window.addEventListener("online", reintentar);
    return () => {
      vivo = false;
      window.removeEventListener("online", reintentar);
    };
  }, [onEnviado]);
}
