"use client";

import type { ReactNode } from "react";
import {
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Star, Trophy } from "lucide-react";

/**
 * Cabecera de los modales de cierre del torneo (campeón y MVP).
 *
 * Tiene dos formas, según haya o no logo del equipo:
 *
 *   Sin logo → todo centrado: ícono arriba, título y texto debajo. Es como se
 *              veía siempre, así que un torneo cuyos equipos no cargaron
 *              escudo no cambia en nada.
 *   Con logo → el texto se va a la izquierda y el logo ocupa la derecha, que
 *              es lo que hace que se lea como un cartel y no como un aviso.
 *
 * Solo cuenta una IMAGEN. El equipo puede tener cargados sus dos colores en
 * vez de escudo (y hay un componente, `TeamMark`, que dibuja ese cuadrito en
 * el calendario y las tablas), pero acá no aplica: al lado de la foto del
 * campeón, dos rectángulos de color no se leen como el escudo de nadie.
 *
 * A la derecha va UNA imagen y una sola. En el campeón es el escudo (cuadrado,
 * sin recortar). En el MVP es su retrato (vertical, recortado a 3:4) — y ahí
 * el escudo del equipo pasa a ser una marquita al lado del nombre del equipo,
 * dentro del texto. Poner el retrato grande abajo Y el escudo grande arriba
 * era el problema: dos imágenes compitiendo, y la cara —que es lo que
 * importa— era la más chica de las dos.
 */
export function ChampionHeader({
  icon = "trophy",
  title,
  description,
  teamLogoUrl,
  teamName,
  portraitUrl,
}: {
  icon?: "trophy" | "star";
  title: string;
  description: ReactNode;
  /** Escudo del equipo, cuadrado. Se ignora si viene `portraitUrl`. */
  teamLogoUrl?: string | null;
  teamName?: string;
  /** Retrato vertical (la foto del MVP). Manda sobre el escudo. */
  portraitUrl?: string | null;
}) {
  const Icon = icon === "star" ? Star : Trophy;
  const image = portraitUrl || teamLogoUrl;

  if (!image) {
    return (
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <Icon className="h-12 w-12 text-amber-500" />
        <DialogTitle className="text-2xl">{title}</DialogTitle>
        <DialogDescription className="text-base">
          {description}
        </DialogDescription>
      </div>
    );
  }

  return (
    // `justify-center` y el texto SIN `flex-1`: los dos bloques quedan juntos y
    // centrados como una unidad. Con `flex-1` el texto se estiraba y empujaba
    // el escudo contra el borde derecho, lejos de lo que acompaña.
    <div className="flex items-center justify-center gap-4 pt-2 text-left">
      <div className="min-w-0">
        <Icon className="mb-1 h-8 w-8 text-amber-500" />
        {/* Un punto menos de título en celular: al lado del escudo, el 2xl
            parte "¡Tenemos campeón!" en tres renglones. */}
        <DialogTitle className="text-xl sm:text-2xl">{title}</DialogTitle>
        <DialogDescription className="text-base">
          {description}
        </DialogDescription>
      </div>
      <div
        className={
          portraitUrl
            ? // Retrato del MVP: se recorta a 3:4 y se enmarca, como una foto.
              // Es grande a propósito — a 256px de ancho mide 341 de alto, casi
              // lo mismo que la foto horizontal del campeón, así que los dos
              // modales quedan del mismo porte y no parece que a uno le falte
              // contenido.
              "w-36 shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:w-64"
            : // Escudo del campeón: cuadrado y sin recortar, que un logo
              // recortado se arruina. Un 25% más chico que el retrato: un
              // escudo es una marca, no una foto, y a 176px se comía la
              // cabecera.
              "h-24 w-24 shrink-0 overflow-hidden rounded-lg sm:h-[132px] sm:w-[132px]"
        }
      >
        <div className={portraitUrl ? "relative aspect-[3/4] w-full" : "h-full w-full"}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={teamName ?? ""}
            width={256}
            height={341}
            loading="lazy"
            decoding="async"
            className={
              portraitUrl
                ? "absolute inset-0 h-full w-full object-cover"
                : "h-full w-full object-contain"
            }
          />
        </div>
      </div>
    </div>
  );
}
