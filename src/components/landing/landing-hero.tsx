import { HERO_IMAGES } from "@/data/sport-images";
import { SPORTS } from "@/data/sports";
import { HeroCarousel } from "./hero-carousel";

/**
 * Hero de la portada.
 *
 * Va pasando entre las fotos de los deportes que ya tienen imagen cargada.
 * La primera es fija (la del mockup, volleyball, si existe): es la que mide
 * el LCP y va precargada, así que sortearla rompería la hidratación. Las
 * demás entran barajadas.
 *
 * La foto va a la derecha y el degradado la funde hacia la izquierda: la
 * mitad izquierda es del título y tiene que quedar legible sí o sí. Por eso
 * las fotos del hero se piden con la acción hacia la derecha.
 */
export function LandingHero() {
  // Orden estable: primero volleyball (la del mockup) y después el resto en
  // el orden de `SPORTS`, para que el HTML del servidor sea siempre igual.
  const heroImages = [
    ...(HERO_IMAGES.volleyball ? [HERO_IMAGES.volleyball] : []),
    ...SPORTS.map((s) => s.key)
      .filter((key) => key !== "volleyball" && HERO_IMAGES[key])
      .map((key) => HERO_IMAGES[key]),
  ];
  const hasHero = heroImages.length > 0;

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0" aria-hidden>
        {hasHero ? (
          // Cada foto trae su propio punto de anclaje: ver `HeroImage` en
          // sport-images.ts para por qué no puede ser uno solo para todas.
          <HeroCarousel images={heroImages} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-primary/25" />
        )}
        {/* El velo va de opaco (izquierda, donde está el texto) a
            transparente (derecha, donde se ve la foto).
            En CLARO se afloja: el velo toma el color de fondo, que acá es
            blanco hueso, y sobre una foto ya de por sí muy luminosa le lavaba
            todo el contraste. En OSCURO se deja fuerte — el marino sobre la
            foto se lee como intención, no como bruma. */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent dark:via-background/85 dark:to-background/20" />
      </div>

      <div className="relative container mx-auto px-4 py-20 sm:py-28">
        <div className="max-w-xl">
          <p className="text-sm font-semibold tracking-[0.2em] text-primary uppercase">
            Encuentra tu próximo reto
          </p>
          <h1 className="mt-3 text-5xl font-extrabold tracking-tight italic sm:text-6xl md:text-7xl">
            TORNEOS
            <br />
            DEPORTIVOS
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            Explora los mejores torneos, compite y vive la{" "}
            <span className="font-semibold text-primary">pasión</span> del
            deporte.
          </p>
        </div>
      </div>
    </section>
  );
}
