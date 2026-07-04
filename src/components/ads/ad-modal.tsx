"use client";

import { useEffect, useRef, useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

/**
 * Modal de publicidad (Pieza 2 de Por hacer/modal-publicidad-y-tienda.md).
 *
 * Se muestra al espectador en la VISTA PÚBLICA del torneo, en cada carga /
 * refresh (decisión 2026-07-03: sin tope por sesión). Pide a
 * `/api/ads/resolve` qué anuncio mostrar — el pick ponderado por monto ocurre
 * server-side. Si no hay campaña que aplique, no renderiza nada.
 *
 * Cerrable después de 3s (antes muestra la cuenta regresiva en el botón).
 * Cuenta `ad_impression` al mostrarse y `ad_click` al tocarse, reutilizando
 * `analytics_events` vía trackEvent.
 */

interface ResolvedAd {
  id: string;
  imageUrl: string;
  linkUrl: string;
}

const CLOSE_DELAY_MS = 3000;

interface AdModalProps {
  tournamentId: string;
}

export function AdModal({ tournamentId }: AdModalProps) {
  const [ad, setAd] = useState<ResolvedAd | null>(null);
  const [canClose, setCanClose] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(
    Math.ceil(CLOSE_DELAY_MS / 1000)
  );
  // Evita doble impresión si el effect corre dos veces (React Strict Mode).
  const impressionFor = useRef<string | null>(null);

  // Resolver el anuncio al montar.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/ads/resolve?tournamentId=${encodeURIComponent(tournamentId)}`
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { ad: ResolvedAd | null };
        if (cancelled || !data.ad) return;
        setAd(data.ad);
        if (impressionFor.current !== data.ad.id) {
          impressionFor.current = data.ad.id;
          trackEvent({
            eventType: "ad_impression",
            tournamentId,
            targetId: data.ad.id,
            metadata: { linkUrl: data.ad.linkUrl },
          });
        }
      } catch {
        /* silencioso: la publicidad nunca debe romper la vista */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  // Cuenta regresiva para habilitar el cierre.
  useEffect(() => {
    if (!ad) return;
    setCanClose(false);
    const started = Date.now();
    const tick = setInterval(() => {
      const remain = Math.ceil((CLOSE_DELAY_MS - (Date.now() - started)) / 1000);
      setSecondsLeft(Math.max(remain, 0));
    }, 250);
    const done = setTimeout(() => {
      setCanClose(true);
      clearInterval(tick);
    }, CLOSE_DELAY_MS);
    return () => {
      clearTimeout(done);
      clearInterval(tick);
    };
  }, [ad]);

  if (!ad) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Publicidad"
    >
      <div className="relative w-full max-w-sm">
        {/* Botón de cierre: cuenta regresiva → X a los 3s. */}
        <button
          type="button"
          aria-label={canClose ? "Cerrar anuncio" : "Espera para cerrar"}
          disabled={!canClose}
          onClick={() => canClose && setAd(null)}
          className="absolute -right-3 -top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background text-foreground shadow-md ring-1 ring-border transition-opacity disabled:cursor-default disabled:opacity-70"
        >
          {canClose ? (
            <X className="h-4 w-4" />
          ) : (
            <span className="text-xs font-semibold tabular-nums">
              {secondsLeft}
            </span>
          )}
        </button>

        <a
          href={ad.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            trackEvent({
              eventType: "ad_click",
              tournamentId,
              targetId: ad.id,
              metadata: { linkUrl: ad.linkUrl },
            })
          }
          className="group relative block overflow-hidden rounded-xl bg-white shadow-2xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ad.imageUrl}
            alt="Publicidad"
            className="h-auto w-full object-contain"
          />
          {/* Disclosure: es publicidad + indica que es clickeable. */}
          <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm ring-1 ring-border backdrop-blur-sm">
            Publicidad
            <ExternalLink className="h-3 w-3" />
          </span>
        </a>
      </div>
    </div>
  );
}
