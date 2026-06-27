"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

// Pull distance (px of finger travel, after resistance) needed to trigger a
// refresh, and the max the indicator travels.
const THRESHOLD = 70;
const MAX_PULL = 110;
// Resistance: the indicator moves at half the speed of the finger so the
// gesture feels elastic instead of 1:1.
const RESISTANCE = 0.5;

/**
 * Custom pull-to-refresh for the installed PWA.
 *
 * En modo standalone no hay barra del navegador, así que el gesto nativo de
 * "tirar para refrescar" no existe. Este componente lo recrea: detecta el
 * arrastre hacia abajo cuando la página está arriba del todo, muestra un
 * spinner que sigue al dedo y, si se supera el umbral, recarga la página.
 *
 * Solo se activa en standalone (PWA instalada). En un navegador normal el
 * gesto nativo ya funciona y duplicarlo se sentiría roto.
 */
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Handlers leen estos refs para no re-suscribir los listeners en cada
  // frame del arrastre.
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari expone esto en lugar del media query.
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!isStandalone) return;

    const setPullBoth = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current || e.touches.length !== 1 || window.scrollY > 0) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null || refreshingRef.current) return;
      const delta = e.touches[0].clientY - startY.current;
      // delta > 0 = el dedo baja = gesto de refresh. Hacia arriba o si ya no
      // estamos arriba del todo: cancelamos y dejamos el scroll normal.
      if (delta <= 0 || window.scrollY > 0) {
        if (pullRef.current !== 0) setPullBoth(0);
        if (window.scrollY > 0) startY.current = null;
        return;
      }
      setPullBoth(Math.min(MAX_PULL, delta * RESISTANCE));
      // Evita el rubber-band / overscroll nativo mientras mostramos el spinner.
      if (e.cancelable) e.preventDefault();
    };

    const onTouchEnd = () => {
      if (startY.current === null) return;
      startY.current = null;
      if (pullRef.current >= THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPullBoth(THRESHOLD);
        // Pequeño delay para que el spinner sea visible antes de recargar.
        window.setTimeout(() => window.location.reload(), 300);
      } else {
        setPullBoth(0);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  const visible = pull > 0 || refreshing;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center"
      style={{
        transform: `translateY(${pull}px)`,
        opacity: visible ? 1 : 0,
        transition: "transform 0.15s ease-out, opacity 0.15s ease-out",
      }}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-md"
        style={{ marginTop: -48 }}
      >
        <Loader2
          className={`h-5 w-5 text-primary ${refreshing ? "animate-spin" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${pull * 2.5}deg)` }}
        />
      </div>
    </div>
  );
}
