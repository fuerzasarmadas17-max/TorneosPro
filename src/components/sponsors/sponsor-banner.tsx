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

      {/* Mobile: horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 md:hidden">
        {sponsors.map((sponsor) => (
          <a
            key={sponsor.id}
            href={sponsor.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 snap-start w-32 h-20 rounded-lg border bg-muted/30 overflow-hidden hover:border-primary/50 transition-colors"
          >
            <img
              src={sponsor.imageUrl}
              alt="Patrocinador"
              className="w-full h-full object-contain p-2"
            />
          </a>
        ))}
      </div>

      {/* Desktop: grid */}
      <div className="hidden md:grid grid-cols-4 lg:grid-cols-6 gap-3">
        {sponsors.map((sponsor) => (
          <a
            key={sponsor.id}
            href={sponsor.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-20 rounded-lg border bg-muted/30 overflow-hidden hover:border-primary/50 transition-colors"
          >
            <img
              src={sponsor.imageUrl}
              alt="Patrocinador"
              className="w-full h-full object-contain p-2"
            />
          </a>
        ))}
      </div>
    </div>
  );
}
