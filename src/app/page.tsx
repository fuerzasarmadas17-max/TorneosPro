import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingFilters } from "@/components/landing/landing-filters";
import { ValuesStrip } from "@/components/landing/values-strip";
import { FeaturedTournament } from "@/components/landing/featured-tournament";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import {
  fetchFeaturedTournaments,
  fetchLandingTournaments,
} from "@/lib/db/tournaments-server";
import { buildSportImageMap } from "@/data/sport-images";

/**
 * Igual que el detalle del torneo: caché de 60 segundos. La portada la
 * abren muchos visitantes distintos con el mismo contenido, así que solo el
 * primero de cada minuto paga la consulta; el resto recibe el HTML ya
 * armado. Corto suficiente para que un torneo nuevo aparezca enseguida.
 */
export const revalidate = 60;

export default async function HomePage() {
  // En paralelo: son dos consultas independientes y no hay razón para que
  // una espere a la otra.
  const [items, featured] = await Promise.all([
    fetchLandingTournaments(12),
    fetchFeaturedTournaments(),
  ]);

  // Un solo mapa para los dos bloques, así un torneo que está destacado Y en
  // la grilla muestra la misma foto en ambos lados.
  const images = buildSportImageMap([
    ...items.map((i) => i.tournament),
    ...featured,
  ]);

  const featuredItems = featured.map((tournament) => ({
    tournament,
    image: images.get(tournament.id) ?? null,
  }));

  return (
    <div className="flex flex-col">
      <PageViewTracker />

      <LandingHero />

      <div className="container mx-auto space-y-10 px-4 pb-16">
        {/* La barra monta sobre el hero, como en el mockup. */}
        <div className="-mt-8 relative z-10">
          <LandingFilters />
        </div>

        {/* Si el admin no marcó ninguno, esto no renderiza nada. */}
        <FeaturedTournament items={featuredItems} />

        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="flex items-center gap-2 text-lg font-bold tracking-wide uppercase">
              <Trophy className="size-5 text-primary" aria-hidden />
              Todos los torneos
            </h2>
            <Link
              href="/tournaments"
              className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Ver todos los torneos
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border py-12 text-center">
              <p className="text-muted-foreground">
                Todavía no hay torneos publicados.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
              {items.map(({ tournament, organizer }, i) => (
                <TournamentCard
                  key={tournament.id}
                  tournament={tournament}
                  organizer={organizer}
                  image={images.get(tournament.id)}
                  // Solo la primera fila sin lazy load: son las que compiten
                  // por el LCP.
                  priority={i < 6}
                />
              ))}
            </div>
          )}
        </section>

        <ValuesStrip />
      </div>
    </div>
  );
}
