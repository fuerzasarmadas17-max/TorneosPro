"use client";

import { useState } from "react";
import { firstWords } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronDown, MousePointerClick } from "lucide-react";
import {
  useSponsorClicks,
  type SponsorClicksTournament,
} from "@/hooks/use-sponsor-clicks";

function TournamentRow({ t }: { t: SponsorClicksTournament }) {
  const [expanded, setExpanded] = useState(false);
  const max = Math.max(...t.sponsors.map((s) => s.count), 1);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 sm:gap-4 p-4 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          {/* En móvil, las dos primeras palabras del nombre del torneo. */}
          <span className="truncate font-medium sm:hidden">
            {firstWords(t.name, 2)}
          </span>
          <span className="hidden truncate font-medium sm:inline">{t.name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap sm:text-sm">
          <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-semibold tabular-nums">{t.total}</span>
          <span className="text-muted-foreground">clics</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t bg-muted/30 px-4 py-3 space-y-2.5">
          {t.sponsors.map((s) => {
            const pct = Math.round((s.count / max) * 100);
            const logo = (
              <div className="h-9 w-14 shrink-0 rounded-md border bg-white overflow-hidden flex items-center justify-center">
                {s.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.imageUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            );
            return (
              <div key={s.target_id} className="flex items-center gap-3">
                {s.linkUrl ? (
                  <a
                    href={s.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={s.linkUrl}
                  >
                    {logo}
                  </a>
                ) : (
                  logo
                )}
                {/* Barra proporcional al sponsor más clickeado del torneo */}
                <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-semibold tabular-nums">
                  {s.count}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Cuántas filas se muestran de entrada. Igual que el ranking de organizadores. */
const TOP_N = 7;
/** Cuántas se agregan con cada "ver más". */
const PAGE_N = 10;

export function SponsorClicksPanel({ days }: { days: number }) {
  const { data, totalClicks, isLoading } = useSponsorClicks(days);
  const [shown, setShown] = useState(TOP_N);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Clics en Patrocinadores</span>
          {!isLoading && (
            <span className="text-sm font-normal text-muted-foreground">
              {totalClicks} clics · {data.length} torneos
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aun no hay clics en patrocinadores en este periodo.
          </p>
        ) : (
          <>
            {/* Mismo criterio que el ranking de organizadores: arrancan los 7
                con más clics del período, y el resto se pide de a 10. La lista
                completa crece con cada torneo y deja de responder la pregunta
                que se le hace: "¿dónde le están haciendo clic a los
                patrocinadores?". */}
            <div
              className={
                shown > TOP_N
                  ? "max-h-96 space-y-2 overflow-y-auto pr-1"
                  : "space-y-2"
              }
            >
              {data.slice(0, shown).map((t) => (
                <TournamentRow key={t.tournament_id} t={t} />
              ))}
            </div>
            {data.length > shown && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setShown((v) => v + PAGE_N)}
              >
                Ver {Math.min(PAGE_N, data.length - shown)} más · quedan{" "}
                {data.length - shown}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
