"use client";

import { ExternalLink } from "lucide-react";
import { Sponsor } from "@/types";
import { trackEvent } from "@/lib/analytics";

interface ChampionSponsorsStripProps {
  sponsors: Sponsor[] | undefined;
  /** Torneo donde se muestra, para atribuir los clics. */
  tournamentId?: string;
}

/**
 * Pieza J: small strip of sponsor logos shown beneath the champion photo
 * in both the editor modal (TournamentChampionModal) and the public viewer
 * modal (TournamentChampionViewerModal). Centered flex-wrap so it looks
 * right with 1, 2, 3 or N sponsors on every screen.
 *
 * Each logo keeps a fixed tile so a single sponsor doesn't stretch across
 * the modal; clicking a sponsor that has a `linkUrl` opens it in a new tab
 * (same convention as the existing SponsorBanner).
 */
export function ChampionSponsorsStrip({
  sponsors,
  tournamentId,
}: ChampionSponsorsStripProps) {
  if (!sponsors || sponsors.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground text-center">
        Patrocinadores
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {sponsors.map((sponsor) => {
          const hasLink = !!sponsor.linkUrl?.trim();
          const tile = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sponsor.imageUrl}
              alt="Patrocinador"
              loading="lazy"
              decoding="async"
              className="w-full h-full object-contain p-1.5"
            />
          );

          const baseClass =
            "relative w-20 h-12 sm:w-24 sm:h-14 rounded-md border bg-muted/30 overflow-hidden";

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
                    entityType: tournamentId ? "tournament" : null,
                    targetId: sponsor.id,
                    metadata: { linkUrl: sponsor.linkUrl },
                  })
                }
                className={`${baseClass} border-primary/30 cursor-pointer group transition-all hover:border-primary/60 hover:shadow-sm active:scale-[0.98]`}
              >
                {tile}
                {/* Badge persistente de "enlace" (no depende de hover) */}
                <div className="absolute top-0.5 right-0.5 rounded-full bg-background/85 backdrop-blur-sm p-0.5 shadow-sm ring-1 ring-border transition-colors group-hover:bg-primary">
                  <ExternalLink className="h-2.5 w-2.5 text-muted-foreground transition-colors group-hover:text-primary-foreground" />
                </div>
              </a>
            );
          }

          return (
            <div key={sponsor.id} className={baseClass}>
              {tile}
            </div>
          );
        })}
      </div>
    </div>
  );
}
