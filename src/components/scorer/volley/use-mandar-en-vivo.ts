"use client";

/**
 * La planilla manda cómo va el partido, para el marcador en vivo del público.
 *
 * CUÁNDO MANDA (sección 4 del documento):
 * - Cambió el marcador → como máximo una vez cada 30 segundos. Si entraron tres
 *   puntos en ese rato, va una sola foto con el último.
 * - Se cerró un set → de inmediato.
 * - Volvió la señal → de inmediato.
 * - No pasa nada → un latido cada 2 minutos, para no salir del en vivo.
 *
 * NUNCA FRENA A LA MESA. Se manda y se olvida: sin cola, sin reintentos, sin
 * esperar la respuesta. Cada envío es la foto completa, así que perder uno no
 * rompe nada. Si el navegador sabe que no hay señal, ni lo intenta.
 *
 * Ver `Por hacer/deportes/voley/PLANILLA-EN-VIVO-PUBLICO.md`.
 */

import { useEffect, useRef } from "react";
import type { Planilla } from "@/lib/volley/planilla";
import {
  ENVIO_EN_VIVO_CADA_MS,
  LATIDO_EN_VIVO_CADA_MS,
  type FotoEnVivo,
  fotoDeLaPlanilla,
} from "@/lib/volley/en-vivo";

function mandar(token: string, matchId: string, foto: FotoEnVivo) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const control = new AbortController();
  const corte = setTimeout(() => control.abort(), 8_000);
  fetch(`/api/scorer/${token}/match/${matchId}/en-vivo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ foto }),
    signal: control.signal,
    keepalive: true,
  })
    .catch(() => {
      // Sin señal o servidor caído: el próximo envío trae la foto completa.
    })
    .finally(() => clearTimeout(corte));
}

/**
 * @param activo  si el partido está en juego. Terminado o aplazado no manda:
 *                esos ya salen del en vivo por su propia puerta.
 */
export function useMandarEnVivo(
  token: string,
  matchId: string,
  planilla: Planilla,
  activo: boolean
) {
  const foto = activo ? fotoDeLaPlanilla(planilla) : null;
  const clave = foto ? JSON.stringify(foto) : null;
  const setsCerrados = planilla.setsCerrados.length;

  // Lo que hace falta recordar entre renders sin volver a dibujar.
  const ultimo = useRef<{ clave: string | null; en: number; sets: number }>({
    clave: null,
    en: 0,
    sets: -1,
  });
  const pendiente = useRef<ReturnType<typeof setTimeout> | null>(null);
  // La foto más nueva, para que un envío programado mande la del momento en que
  // sale y no la del momento en que se programó.
  const actual = useRef<{ foto: FotoEnVivo | null; sets: number }>({
    foto: null,
    sets: 0,
  });

  // Solo se llama desde efectos y temporizadores, nunca mientras se dibuja.
  const mandarAhora = () => {
    const { foto: f, sets } = actual.current;
    if (!f) return;
    if (pendiente.current) {
      clearTimeout(pendiente.current);
      pendiente.current = null;
    }
    ultimo.current = { clave: JSON.stringify(f), en: Date.now(), sets };
    mandar(token, matchId, f);
  };
  const mandarAhoraRef = useRef(mandarAhora);

  // Va primero: los efectos corren en orden, y los de abajo leen esto.
  useEffect(() => {
    actual.current = { foto, sets: setsCerrados };
    mandarAhoraRef.current = mandarAhora;
  });

  // El marcador cambió.
  useEffect(() => {
    if (!clave) return;
    const u = ultimo.current;
    if (clave === u.clave) return;
    // Se cerró un set (o es el primer envío): de inmediato.
    if (setsCerrados !== u.sets) {
      mandarAhoraRef.current();
      return;
    }
    const espera = u.en + ENVIO_EN_VIVO_CADA_MS - Date.now();
    if (espera <= 0) {
      mandarAhoraRef.current();
    } else if (!pendiente.current) {
      // Se programa uno solo. Si ya había uno, no hace falta otro: ese manda la
      // foto más nueva, porque la lee en el momento de salir.
      pendiente.current = setTimeout(() => {
        pendiente.current = null;
        mandarAhoraRef.current();
      }, espera);
    }
  }, [clave, setsCerrados]);

  // El latido y la vuelta de la señal.
  useEffect(() => {
    if (!activo) return;
    const latido = setInterval(() => {
      if (Date.now() - ultimo.current.en >= LATIDO_EN_VIVO_CADA_MS - 1_000) {
        mandarAhoraRef.current();
      }
    }, 15_000);
    const volvioLaSenal = () => mandarAhoraRef.current();
    window.addEventListener("online", volvioLaSenal);
    // Si la mesa cambia de app o bloquea el celular, el navegador congela los
    // temporizadores y el envío programado no sale hasta que vuelva. Por eso se
    // manda YA al esconderse, y otra vez al volver, si hay algo nuevo.
    const alCambiarVisibilidad = () => {
      const hayNuevo =
        actual.current.foto &&
        JSON.stringify(actual.current.foto) !== ultimo.current.clave;
      if (hayNuevo) mandarAhoraRef.current();
    };
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    return () => {
      clearInterval(latido);
      window.removeEventListener("online", volvioLaSenal);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      if (pendiente.current) {
        clearTimeout(pendiente.current);
        pendiente.current = null;
      }
    };
  }, [activo]);
}
