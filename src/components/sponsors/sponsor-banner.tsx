"use client";

import { Sponsor } from "@/types";
import { ExternalLink } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

interface SponsorBannerProps {
  sponsors: Sponsor[];
  /** Torneo donde se muestra (para atribuir los clics). Ausente en el
   *  perfil de organización, donde se usa `orgId`. */
  tournamentId?: string;
  /** user_id del organizador, cuando el banner es a nivel organización. */
  orgId?: string;
}

export function SponsorBanner({ sponsors, tournamentId, orgId }: SponsorBannerProps) {
  if (sponsors.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Patrocinadores</p>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {sponsors.map((sponsor) => {
          const hasLink = !!sponsor.linkUrl?.trim();

          const content = (
            <img
              src={sponsor.imageUrl}
              alt="Patrocinador"
              loading="lazy"
              decoding="async"
              className="w-full h-full object-contain p-2"
            />
          );

          if (hasLink) {
            return (
              <a
                key={sponsor.id}
                href={sponsor.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Visitar patrocinador"
                onClick={() =>
                  trackEvent({
                    eventType: "sponsor_click",
                    tournamentId: tournamentId ?? null,
                    entityType: tournamentId
                      ? "tournament"
                      : orgId
                        ? "organization"
                        : null,
                    entityId: tournamentId ? null : orgId ?? null,
                    targetId: sponsor.id,
                    metadata: { linkUrl: sponsor.linkUrl },
                  })
                }
                className="relative h-20 rounded-lg border border-primary/30 bg-muted/30 overflow-hidden cursor-pointer group transition-all hover:border-primary/60 hover:shadow-sm active:scale-[0.98]"
              >
                {content}
                {/* Badge persistente: indica que es clickeable en desktop y
                    móvil sin depender del hover. Fondo semitransparente para
                    que se lea sobre cualquier logo. */}
                <div className="absolute top-1 right-1 rounded-full bg-background/85 backdrop-blur-sm p-1 shadow-sm ring-1 ring-border transition-colors group-hover:bg-primary">
                  <ExternalLink className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-primary-foreground" />
                </div>
              </a>
            );
          }

          return (
            <div
              key={sponsor.id}
              className="h-20 rounded-lg border bg-muted/30 overflow-hidden"
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
