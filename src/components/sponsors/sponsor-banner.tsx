"use client";

import { Sponsor } from "@/types";

interface SponsorBannerProps {
  sponsors: Sponsor[];
}

export function SponsorBanner({ sponsors }: SponsorBannerProps) {
  if (sponsors.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Patrocinadores</p>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {sponsors.map((sponsor) => {
          const content = (
            <img
              src={sponsor.imageUrl}
              alt="Patrocinador"
              className="w-full h-full object-contain p-2"
            />
          );

          if (sponsor.linkUrl) {
            return (
              <a
                key={sponsor.id}
                href={sponsor.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-20 rounded-lg border bg-muted/30 overflow-hidden hover:border-primary/50 transition-colors"
              >
                {content}
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
