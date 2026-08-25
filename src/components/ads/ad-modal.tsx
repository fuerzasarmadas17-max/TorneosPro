"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ExternalLink, MessageCircle } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { adCapReached, recordAdShown } from "@/lib/ad-frequency";
import { useAuth } from "@/context/auth-context";

/**
 * Modal de publicidad (Pieza 2 de Por hacer/modal-publicidad-y-tienda.md).
 *
 * Se muestra al espectador ANÓNIMO en la vista pública del torneo, hasta
 * `AD_DAILY_CAP` veces por persona, por torneo y por día (ver
 * `lib/ad-frequency.ts`). Pide a `/api/ads/resolve` qué anuncio mostrar — el
 * pick ponderado por monto ocurre server-side. Si no hay campaña que aplique,
 * no renderiza nada.
 *
 * El tope reemplaza la decisión del 2026-07-03 ("en cada carga, sin tope"),
 * que tenía sentido cuando las impresiones eran la única métrica. Con
 * personas-día liquidando, inflar impresiones solo empeora el informe al
 * anunciante. El tope no cambia personas-día.
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
    // Tope diario por persona Y POR TORNEO: se chequea ANTES de pedir el
    // anuncio, así quien ya cumplió su cuota tampoco gasta el request.
    //
    // La cuota es por torneo y no global porque el crédito de personas-día del
    // reparto se registra solo cuando hay impresión: con cuota global, quien
    // la quemaba en un torneo dejaba sin crédito a los otros organizadores que
    // sí visitó. Ver lib/ad-frequency.ts.
    if (adCapReached(tournamentId)) return;
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
          // El contador sube junto con la impresión que se registra, no al
          // entrar al effect: si la API no devolvió anuncio o la petición
          // falló, no se mostró nada y no debe gastar cuota.
          recordAdShown(tournamentId);
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

  // ------------------------------------------------------------------------
  // POR QUÉ ESTE MODAL VA EN UN PORTAL Y SE DEFIENDE DE RADIX
  // ------------------------------------------------------------------------
  // Este no es un Dialog de Radix, es una capa propia. Cuando encima del torneo
  // hay además un Dialog de Radix abierto —el de la foto del campeón, que se
  // abre solo al entrar a un torneo terminado— pasaban dos cosas, y las dos se
  // veían como "cerrar el anuncio me cierra el campeón":
  //
  //   1. Radix, en modo modal, le pone `pointer-events: none` al `body`. Este
  //      modal vive dentro del body, así que heredaba esa regla y su X dejaba
  //      de recibir clicks: el toque ATRAVESABA el anuncio y aterrizaba en el
  //      fondo del Dialog, que es justo lo que lo cierra.
  //   2. Aunque llegara a recibirlo, Radix escucha `pointerdown` en el
  //      document y cualquier click de acá le cuenta como "click afuera".
  //
  // Las tres defensas de abajo son independientes a propósito: portal al body
  // para quedar realmente encima, `pointer-events` propios para no heredar el
  // bloqueo, y cortar la propagación para que el document nunca se entere.
  const layer = (
    <div
      className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Publicidad"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
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

  // `document.body` recién existe en el navegador. Montarlo directo como hijo
  // del body lo deja después del portal de Radix en el DOM, que es la otra
  // mitad de quedar por encima.
  return typeof document === "undefined"
    ? null
    : createPortal(layer, document.body);
}
