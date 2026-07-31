"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronRight, MapPin, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tournament } from "@/types";
import { getSportInfo } from "@/data/sports";
import { getSportGradient } from "@/data/sport-images";
import { getDepartmentLabel, getMunicipalityLabel } from "@/data/colombia";
import type { OrganizerRef } from "@/hooks/use-organizers";

const statusLabels: Record<string, string> = {
  upcoming: "Próximo",
  "in-progress": "En Curso",
  completed: "Completado",
};

// Fondos sólidos, no el tono /10 de antes: estos chips van encima de la
// foto, y un fondo translúcido deja pasar la imagen y vuelve el texto
// ilegible sobre cualquier zona clara.
const statusColors: Record<string, string> = {
  upcoming: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  "in-progress":
    "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  completed: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

// Un color por deporte para reconocer el torneo de un vistazo. Agrupados por
// familia (goles = verdes, carreras = cálidos, raqueta/red = fríos) para que
// deportes parecidos se lean como parientes sin confundirse entre sí.
//
// El color vive en el círculo del ícono, no en el texto: en el mockup el
// nombre del deporte va en marino y lo que tiñe es la pastilla redonda de la
// izquierda. Cuando existan los íconos por deporte de la Etapa 0, el emoji
// de adentro se reemplaza y el resto queda igual.
//
// Clases completas a propósito: Tailwind no genera nombres construidos por
// interpolación, tienen que estar literales para que el JIT las incluya.
const sportDot: Record<string, string> = {
  futbol: "bg-green-500/20",
  futsal: "bg-emerald-500/20",
  microfutbol: "bg-lime-600/20",
  beisbol: "bg-red-500/20",
  softball: "bg-rose-500/20",
  wiffleball: "bg-amber-500/20",
  volleyball: "bg-sky-500/20",
  basketball: "bg-orange-500/20",
  padel: "bg-violet-500/20",
  "ping-pong": "bg-cyan-500/20",
  tenis: "bg-yellow-500/20",
};

interface TournamentCardProps {
  tournament: Tournament;
  href?: string;
  /**
   * Organizador ya resuelto por el padre. Se pasa por props y no se
   * consulta acá para no disparar una query por tarjeta — ver
   * `useOrganizers`.
   */
  organizer?: OrganizerRef;
  /**
   * Foto de fondo, elegida por `buildSportImageMap()` en el padre. Si no
   * hay (todavía no llegaron las fotos), cae al degradado del deporte.
   */
  image?: string | null;
  /**
   * `true` solo para las tarjetas de la primera fila: le saca el lazy load
   * a la imagen para que el LCP de la portada no espere.
   */
  priority?: boolean;
}

export function TournamentCard({
  tournament,
  href,
  organizer,
  image,
  priority = false,
}: TournamentCardProps) {
  const sport = getSportInfo(tournament.sport);

  const location =
    tournament.scope === "nacional"
      ? "Nacional"
      : tournament.department
        ? `${getDepartmentLabel(tournament.department)}${
            tournament.municipality
              ? `, ${getMunicipalityLabel(tournament.department, tournament.municipality)}`
              : ""
          }`
        : null;

  // El hover se marca con el borde dorado y no solo con la sombra: sobre el
  // marino del modo oscuro una sombra no se ve, y la tarjeta se quedaba sin
  // ninguna señal de que es clickeable.
  //
  // `relative` es lo que ancla el link estirado de "Ver Torneo": el hover
  // pinta la tarjeta entera, así que la tarjeta entera tiene que llevar al
  // torneo. Ver el `after:` de ese Link más abajo.
  return (
    <Card className="group relative gap-0 overflow-hidden py-0 transition-[box-shadow,border-color] hover:border-primary/60 hover:shadow-lg">
      {/* Banda de foto con los chips encima. El degradado oscuro de abajo
          es lo que sostiene el contraste de los chips: sin él, una foto
          clara se los come. */}
      {/* 8:3 medido sobre el mockup: la banda ocupa ~91px de una tarjeta de
          ~245px de ancho. Con una banda más alta la tarjeta se vuelve más
          alta que ancha y deja de leerse como la fila de seis del diseño. */}
      <div className="relative aspect-[8/3] overflow-hidden">
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            priority={priority}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className={`absolute inset-0 ${getSportGradient(tournament.sport)}`}
            aria-hidden
          >
            {/* Con degradado y sin foto, el emoji gigante evita que la
                tarjeta se lea como una imagen que no cargó. Hace el mismo
                zoom que hará la foto, para que el hover ya se sienta
                mientras no tenemos imágenes. */}
            <span className="absolute inset-0 grid place-items-center text-4xl opacity-25 transition-transform duration-500 group-hover:scale-110">
              {sport?.emoji}
            </span>
          </div>
        )}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-black/25"
          aria-hidden
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-background/95 py-1 pr-2 pl-1 text-[11px] font-semibold tracking-wide text-foreground uppercase">
            <span
              className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] ${
                sportDot[tournament.sport] ?? "bg-muted"
              }`}
              aria-hidden
            >
              {sport?.emoji}
            </span>
            {sport?.label}
          </span>
          <span
            className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold ${
              statusColors[tournament.status] ?? "bg-background/95"
            }`}
          >
            {statusLabels[tournament.status]}
          </span>
        </div>
      </div>

      {/* Compacto a propósito, medido contra el mockup: ahí el bloque de
          texto ocupa ~65px de una tarjeta de 188. Sin esto la tarjeta salía
          ~265px de alto contra los 188 del diseño. */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {/* Sin `min-h-[2lh]`: forzar siempre dos líneas sumaba 22px a cada
            tarjeta de nombre corto, que son la mayoría. Los nombres largos
            siguen cortándose en dos líneas y el pie queda alineado igual,
            porque este bloque es el que crece (`flex-1`). */}
        <h3 className="line-clamp-2 leading-snug font-semibold">
          {tournament.name}
        </h3>
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {location && (
            <p className="flex items-center gap-1.5">
              <MapPin className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{location}</span>
            </p>
          )}
          {organizer && (
            <p className="flex min-w-0 items-center gap-1.5">
              <Users className="size-3 shrink-0" aria-hidden />
              <span className="shrink-0">Organizador:</span>
              {organizer.slug ? (
                // `relative z-10`: sin esto el link estirado de la tarjeta
                // le pasa por encima y el perfil del organizador se vuelve
                // inalcanzable.
                <Link
                  href={`/${organizer.slug}`}
                  className="relative z-10 min-w-0 truncate font-medium text-primary hover:underline"
                >
                  {organizer.name}
                </Link>
              ) : (
                <span className="min-w-0 truncate font-medium">
                  {organizer.name}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* El `after:absolute after:inset-0` estira el área clickeable de este
          link sobre toda la tarjeta, sin agregar un segundo link al mismo
          destino (que el lector de pantalla anunciaría dos veces). El
          aria-label le pone el nombre del torneo, porque "Ver Torneo" suelto
          no dice cuál. */}
      <Link
        href={href || `/tournaments/${tournament.id}`}
        aria-label={`Ver Torneo: ${tournament.name}`}
        className="flex items-center justify-center gap-1.5 border-t px-3 py-2.5 text-xs font-medium text-primary transition-colors group-hover:bg-accent after:absolute after:inset-0 after:content-['']"
      >
        Ver Torneo
        <ChevronRight
          className="size-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    </Card>
  );
}
