"use client";

import { useEffect, useRef, useState } from "react";
import { X, ExternalLink, MessageCircle } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/context/auth-context";

/**
 * Modal de publicidad (Pieza 2 de Por hacer/modal-publicidad-y-tienda.md).
 *
 * Se muestra al espectador ANÓNIMO en la vista pública del torneo, en cada
 * carga / refresh (decisión 2026-07-03: sin tope por sesión). Pide a
 * `/api/ads/resolve` qué anuncio mostrar — el pick ponderado por monto ocurre
 * server-side. Si no hay campaña que aplique, no renderiza nada.
 *
 * Los usuarios con sesión iniciada (los organizadores) no ven publicidad: son
 * los clientes que pagan, no la audiencia que el anunciante compró. El chequeo
 * es client-side a propósito — las rutas de torneo tienen edge cache
 * (`revalidate = 60`) y mirar la sesión en el servidor las volvería dinámicas.
 *
 * Debajo de la imagen se muestran los botones de acción cargados (WhatsApp y/o
 * link) para que al espectador le quede claro qué hacer. Si solo hay uno, se
 * muestra solo ese.
 *
 * Cerrable después de 3s (antes muestra la cuenta regresiva en el botón).
 * Cuenta `ad_impression` al mostrarse y `ad_click` al tocar un botón.
 */

interface ResolvedAd {
  id: string;
  imageUrl: string;
  linkUrl: string | null;
  whatsapp: string | null;
}

type CtaType = "whatsapp" | "link";
interface Cta {
  type: CtaType;
  url: string;
  label: string;
}

/** Arma los botones cargados, con WhatsApp primero. */
function buildCtas(ad: ResolvedAd): Cta[] {
  const ctas: Cta[] = [];

  if (ad.whatsapp) {
    const digits = ad.whatsapp.replace(/\D/g, "");
    // Número local colombiano (10 dígitos) → anteponer indicativo país 57.
    const withCc = digits.length === 10 ? `57${digits}` : digits;
    if (withCc) ctas.push({ type: "whatsapp", url: `https://wa.me/${withCc}`, label: "WhatsApp" });
  }

  if (ad.linkUrl) {
    const url = /^https?:\/\//i.test(ad.linkUrl) ? ad.linkUrl : `https://${ad.linkUrl}`;
    ctas.push({ type: "link", url, label: "Ver más" });
  }

  return ctas;
}

const CTA_STYLES: Record<CtaType, string> = {
  whatsapp: "bg-[#25D366] hover:bg-[#20bd5a] text-white",
  link: "bg-zinc-900 hover:bg-zinc-800 text-white",
};

const CLOSE_DELAY_MS = 1000;

interface AdModalProps {
  tournamentId: string;
}

export function AdModal({ tournamentId }: AdModalProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [ad, setAd] = useState<ResolvedAd | null>(null);
  const [canClose, setCanClose] = useState(false);
  // Evita doble impresión si el effect corre dos veces (React Strict Mode).
  const impressionFor = useRef<string | null>(null);

  // Resolver el anuncio al montar, solo para el espectador anónimo.
  //
  // Esperamos a que auth termine de resolver antes de pegarle a la API: si
  // pidiéramos el anuncio de una, el organizador lo vería un instante y
  // contaríamos una `ad_impression` que el anunciante paga sin que su público
  // real la haya visto.
  useEffect(() => {
    if (authLoading || isAuthenticated) return;
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
        setCanClose(false);
        if (impressionFor.current !== data.ad.id) {
          impressionFor.current = data.ad.id;
          trackEvent({
            eventType: "ad_impression",
            tournamentId,
            targetId: data.ad.id,
          });
        }
      } catch {
        /* silencioso: la publicidad nunca debe romper la vista */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId, authLoading, isAuthenticated]);

  // Pequeña espera antes de habilitar el cierre: asegura que el modal se vea
  // sin ser invasivo. La X aparece deshabilitada y se activa al pasar el tiempo.
  useEffect(() => {
    if (!ad) return;
    const done = setTimeout(() => setCanClose(true), CLOSE_DELAY_MS);
    return () => clearTimeout(done);
  }, [ad]);

  // `isAuthenticated` también se chequea acá y no solo en el effect: si la
  // sesión aparece con el modal ya abierto (login en otra pestaña), lo bajamos.
  if (isAuthenticated || !ad) return null;

  const ctas = buildCtas(ad);

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
          <X className="h-4 w-4" />
        </button>

        <div className="overflow-hidden rounded-xl bg-white shadow-2xl">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ad.imageUrl}
              alt="Publicidad"
              loading="lazy"
              decoding="async"
              className="h-auto w-full object-contain"
            />
            {/* Disclosure: aclara que es publicidad. */}
            <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm ring-1 ring-border backdrop-blur-sm">
              Publicidad
            </span>
          </div>

          {ctas.length > 0 && (
            <div className="flex gap-2 p-3">
              {ctas.map((cta) => {
                const Icon = cta.type === "whatsapp" ? MessageCircle : ExternalLink;
                return (
                  <a
                    key={cta.type}
                    href={cta.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      trackEvent({
                        eventType: "ad_click",
                        tournamentId,
                        targetId: ad.id,
                        metadata: { type: cta.type, url: cta.url },
                      })
                    }
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${CTA_STYLES[cta.type]}`}
                  >
                    <Icon className="h-4 w-4" />
                    {cta.label}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
