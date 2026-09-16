"use client";

/**
 * Los partidos de un torneo que se están jugando ahora con la planilla.
 *
 * PARA QUE NO PONGA LENTA LA PÁGINA (sección 6.1 del documento):
 * - Pregunta DESPUÉS de que la página se dibujó, nunca antes.
 * - Lo que trae es chiquito: el "papelito" con los marcadores, no el torneo.
 * - Solo pregunta mientras la pestaña está a la vista. Si bloquean el celular o
 *   cambian de app, deja de preguntar, y al volver pregunta una vez.
 *
 * Ver `Por hacer/deportes/voley/PLANILLA-EN-VIVO-PUBLICO.md`.
 */

import { useCallback, useEffect, useState } from "react";
import {
  EN_VIVO_VENCE_MS,
  REFRESCO_EN_VIVO_MS,
  type PartidoEnVivoDato,
} from "@/lib/volley/en-vivo";

export function useEnVivo(tournamentId: string, activo: boolean) {
  const [partidos, setPartidos] = useState<PartidoEnVivoDato[]>([]);

  const preguntar = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/en-vivo`);
      if (!res.ok) return;
      const json = (await res.json()) as { partidos?: PartidoEnVivoDato[] };
      // La copia compartida puede tener hasta ~1 minuto: lo que ya venció en
      // ese rato se saca acá también, para no mostrar un EN VIVO viejo.
      const ahora = Date.now();
      setPartidos(
        (json.partidos ?? []).filter(
          (p) => ahora - new Date(p.actualizadoEn).getTime() <= EN_VIVO_VENCE_MS
        )
      );
    } catch {
      // Sin señal: se queda lo último que se vio y vuelve a preguntar después.
    }
  }, [tournamentId]);

  useEffect(() => {
    if (!activo) return;
    let intervalo: ReturnType<typeof setInterval> | null = null;

    const arrancar = () => {
      if (intervalo) return;
      void preguntar();
      intervalo = setInterval(() => void preguntar(), REFRESCO_EN_VIVO_MS);
    };
    const parar = () => {
      if (intervalo) clearInterval(intervalo);
      intervalo = null;
    };
    const alCambiarVisibilidad = () =>
      document.visibilityState === "visible" ? arrancar() : parar();

    if (document.visibilityState === "visible") arrancar();
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    return () => {
      parar();
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [activo, preguntar]);

  return { partidos };
}
