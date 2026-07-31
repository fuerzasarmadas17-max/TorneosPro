"use client";

import Image from "next/image";
import { Check } from "lucide-react";
import {
  CATEGORY_LABELS,
  getSportGradient,
  imagesForSport,
  type SportImage,
} from "@/data/sport-images";
import { getSportInfo } from "@/data/sports";

interface CardImagePickerProps {
  sport: string;
  /** Clave elegida, o null/undefined para "que la elija el sistema". */
  value?: string | null;
  onChange: (key: string | undefined) => void;
}

/**
 * Selector de la foto de la tarjeta del torneo.
 *
 * El set es curado y fijo — el organizador elige entre las fotos de su
 * deporte, no sube las propias. Existe porque en un mismo deporte hay
 * torneos infantiles, femeninos y masculinos, y la foto genérica no le queda
 * bien a todos.
 *
 * La opción "Automática" es la primera y es el default: reparte por deporte
 * de forma estable para que dos torneos vecinos no muestren la misma imagen.
 */
export function CardImagePicker({
  sport,
  value,
  onChange,
}: CardImagePickerProps) {
  const images = imagesForSport(sport);
  const sportInfo = getSportInfo(sport);

  if (images.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Todavía no hay fotos cargadas para {sportInfo?.label ?? "este deporte"}.
        Mientras tanto la tarjeta usa el degradado del deporte.
      </div>
    );
  }

  // Agrupadas por categoría para que el organizador de un torneo infantil
  // encuentre las suyas sin recorrer todas.
  const byCategory = images.reduce<Record<string, SportImage[]>>((acc, img) => {
    (acc[img.category] ??= []).push(img);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => onChange(undefined)}
        aria-pressed={!value}
        className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
          !value ? "border-primary bg-accent" : "hover:bg-accent/50"
        }`}
      >
        <span
          className={`grid size-12 shrink-0 place-items-center rounded-md ${getSportGradient(sport)}`}
          aria-hidden
        >
          <span className="text-lg opacity-70">{sportInfo?.emoji}</span>
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">Automática</span>
          <span className="block text-xs text-muted-foreground">
            La elegimos nosotros para que no se repita con torneos vecinos.
          </span>
        </span>
        {!value && <Check className="ml-auto size-4 shrink-0 text-primary" />}
      </button>

      {Object.entries(byCategory).map(([category, imgs]) => (
        <div key={category}>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ??
              category}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {imgs.map((img) => {
              const selected = value === img.key;
              return (
                <button
                  key={img.key}
                  type="button"
                  onClick={() => onChange(img.key)}
                  aria-pressed={selected}
                  title={img.label}
                  className={`relative aspect-[8/3] overflow-hidden rounded-md border-2 transition-colors ${
                    selected
                      ? "border-primary"
                      : "border-transparent hover:border-border"
                  }`}
                >
                  <Image
                    src={`/sports/${img.file}`}
                    alt={img.label}
                    fill
                    sizes="(max-width: 640px) 50vw, 200px"
                    className="object-cover"
                  />
                  {selected && (
                    <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" aria-hidden />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
