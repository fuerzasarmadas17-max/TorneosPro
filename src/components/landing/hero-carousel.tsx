"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { HeroImage } from "@/data/sport-images";

/** Cuánto se queda cada foto completamente visible, sin contar el cruce. */
const HOLD_DURATION = 7000;

/** Lo que tarda el cruce. Tiene que coincidir con `duration-[1200ms]`. */
const FADE_DURATION = 1200;

/** Respiro antes de empezar a bajar la segunda foto (ver el efecto). */
const PRELOAD_DELAY = 400;

/** Cada cuánto se vuelve a preguntar si la próxima foto ya terminó de cargar. */
const LOAD_POLL = 150;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Carrusel de fotos del hero.
 *
 * Hereda la mecánica del carrusel de video que reemplaza
 * (`video-background.tsx`): dos capas superpuestas que se cruzan con fundido
 * y respeto por `prefers-reduced-motion`.
 *
 * Tres cosas cambian al pasar de video a foto:
 *
 * 1. **Sigue prendido en celular.** El de video se apagaba por debajo de
 *    768px porque cada clip pesaba ~5 MB y en 4G era la razón principal de
 *    que la landing se sintiera lenta. Estas fotos rondan los 150 KB.
 * 2. **No hay retraso de arranque.** El de video esperaba 1,5 s antes de
 *    bajar el primer clip. Acá la primera foto va en el HTML del servidor.
 * 3. **La primera es fija, no barajada.** Es la que mide el LCP y va
 *    precargada; sortearla rompería la hidratación. Se barajan las demás.
 *
 * ## Por qué el cruce espera a que la foto esté cargada
 *
 * La primera versión cambiaba por reloj: a los N segundos, cruzaba. Si la que
 * venía todavía estaba descargando, el fundido revelaba una capa vacía — se
 * veía como si dudara, o como si empezara a mostrar una y terminara
 * mostrando otra. Ahora el reloj solo *habilita* el cruce: si la próxima no
 * terminó de cargar, se espera. Es preferible que una foto dure un poco de
 * más a que el cambio se vea roto.
 */
export function HeroCarousel({ images }: { images: HeroImage[] }) {
  const key = images.map((i) => i.src).join(",");

  // Las dos capas. `b` arranca vacía a propósito: su contenido se decide con
  // un barajado (que usa Math.random) y ponerlo durante el render haría que
  // el servidor y el cliente generen HTML distinto.
  const [slots, setSlots] = useState<{
    a: HeroImage;
    b: HeroImage | null;
    activeIsA: boolean;
  }>({ a: images[0], b: null, activeIsA: true });

  // Qué fotos ya terminaron de descargar. En un ref y no en estado porque
  // cambiarlo no tiene que provocar un render.
  const loadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (images.length <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // La primera queda donde está; el resto entra barajado, así no siempre se
    // ve la misma secuencia detrás de la primera.
    const order = [images[0], ...shuffle(images.slice(1))];
    let index = 0;
    let activeIsA = true;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    // Se precarga la segunda con un respiro, para no competir con la descarga
    // de la primera, que es la que mide el LCP y va marcada como prioritaria.
    const preloadTimer = setTimeout(() => {
      if (!cancelled) setSlots((s) => ({ ...s, b: order[1] }));
    }, PRELOAD_DELAY);

    // Espera a que la foto esté descargada antes de dejar cruzar.
    const whenReady = (img: HeroImage, done: () => void) => {
      if (cancelled) return;
      if (loadedRef.current.has(img.src)) done();
      else timer = setTimeout(() => whenReady(img, done), LOAD_POLL);
    };

    const cycle = () => {
      if (cancelled) return;
      whenReady(order[(index + 1) % order.length], () => {
        index = (index + 1) % order.length;
        activeIsA = !activeIsA;
        setSlots((s) => ({ ...s, activeIsA }));

        // Recién cuando el cruce terminó se le cambia la foto a la capa que
        // quedó oculta. Hacerlo antes se vería.
        timer = setTimeout(() => {
          if (cancelled) return;
          const upcoming = order[(index + 1) % order.length];
          setSlots((s) =>
            activeIsA ? { ...s, b: upcoming } : { ...s, a: upcoming }
          );
          timer = setTimeout(cycle, HOLD_DURATION);
        }, FADE_DURATION);
      });
    };

    timer = setTimeout(cycle, HOLD_DURATION);

    return () => {
      cancelled = true;
      clearTimeout(preloadTimer);
      clearTimeout(timer);
    };
    // `key` resume la lista: se rearma solo si cambian las fotos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const layer = (img: HeroImage, visible: boolean, priority: boolean) => (
    <Image
      key={img.src}
      src={img.src}
      alt=""
      fill
      priority={priority}
      sizes="100vw"
      style={{ objectPosition: img.position }}
      // Si una foto falla, se marca igual como lista: si no, el carrusel se
      // quedaría esperándola para siempre.
      onLoad={() => loadedRef.current.add(img.src)}
      onError={() => loadedRef.current.add(img.src)}
      className={`object-cover transition-opacity duration-[1200ms] ease-in-out ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    />
  );

  return (
    <>
      {layer(slots.a, slots.activeIsA, true)}
      {slots.b && layer(slots.b, !slots.activeIsA, false)}
    </>
  );
}
