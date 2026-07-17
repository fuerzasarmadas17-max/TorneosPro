import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SPORTS } from "@/data/sports";
import { VideoBackground } from "@/components/landing/video-background";
import {
  TIER_PRICES,
  TIER_LABELS,
  TIER_TEAM_RANGES,
  FREE_TIER_LIMITS,
  formatCOP,
} from "@/lib/pricing";
import { TournamentTier } from "@/types";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <PageViewTracker />
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center gap-6 py-32 px-4 text-center min-h-[70vh]">
        <VideoBackground />
        <h1 className="relative z-10 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl text-white drop-shadow-lg">
          Organiza tus torneos
          <br />
          <span className="underline decoration-white/40 underline-offset-8">deportivos</span>
        </h1>
        <p className="relative z-10 max-w-[600px] text-lg text-white/80">
          Crea torneos de eliminacion directa o liga, gestiona equipos, registra
          resultados y sigue el progreso en tiempo real.
        </p>
        <div className="relative z-10 flex gap-4">
          <Button size="lg" asChild>
            <Link href="/tournaments">Explorar Torneos</Link>
          </Button>
          <Button size="lg" variant="outline" className="bg-white/10 text-white border-white/40 hover:bg-white/20 backdrop-blur-sm" asChild>
            <Link href="/tournaments/create">Crear Torneo</Link>
          </Button>
        </div>
      </section>

      {/* Sports Grid */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-3">
          Multiples Deportes
        </h2>
        <p className="text-center text-muted-foreground mb-10">
          Crea torneos para cualquiera de estos deportes
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {SPORTS.map((sport) => (
            <Link
              key={sport.key}
              href={`/tournaments?sport=${sport.key}`}
            >
              <Card className="group hover:border-primary hover:shadow-lg transition-all duration-200 cursor-pointer">
                <CardContent className="flex flex-col items-center justify-center p-8 gap-3">
                  <span className="text-6xl group-hover:scale-110 transition-transform duration-200">
                    {sport.emoji}
                  </span>
                  <span className="text-base font-semibold">{sport.label}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-8">
          Todo lo que necesitas
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-2">
                Eliminacion y Liga
              </h3>
              <p className="text-muted-foreground text-sm">
                Soporta brackets de eliminacion directa y ligas round-robin con
                tabla de posiciones automatica.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-2">
                Gestion de Equipos
              </h3>
              <p className="text-muted-foreground text-sm">
                Crea equipos, agrega jugadores y organiza tus torneos de forma
                simple y rapida.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-2">
                Resultados en Vivo
              </h3>
              <p className="text-muted-foreground text-sm">
                Registra resultados de partidos y ve como se actualizan los
                brackets y las clasificaciones al instante.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Pricing */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-3">
          Planes y Precios
        </h2>
        <p className="text-center text-muted-foreground mb-10">
          Pago unico por torneo · Duracion ilimitada
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Free */}
          <Card className="border-2">
            <CardContent className="p-6 space-y-4">
              <div>
                <p className="font-semibold text-lg">Gratis</p>
                <p className="text-2xl font-bold mt-1">$0</p>
              </div>
              <Badge variant="outline" className="text-xs">
                Hasta {FREE_TIER_LIMITS.maxTeams} equipos
              </Badge>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Solo eliminacion directa</li>
                <li>Sin estadisticas</li>
                <li>Max 1 torneo activo</li>
              </ul>
            </CardContent>
          </Card>

          {/* Paid tiers */}
          {(Object.keys(TIER_PRICES) as TournamentTier[]).map((tier) => {
            const range = TIER_TEAM_RANGES[tier];
            return (
              <Card
                key={tier}
                className={
                  tier === "pro"
                    ? "border-2 border-primary"
                    : "border-2"
                }
              >
                <CardContent className="p-6 space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-lg">{TIER_LABELS[tier]}</p>
                      {tier === "pro" && (
                        <Badge className="text-xs">Popular</Badge>
                      )}
                    </div>
                    <p className="text-2xl font-bold mt-1">
                      {formatCOP(TIER_PRICES[tier])}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {range.min}-{range.max ?? "+"} equipos
                  </Badge>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>Todos los formatos</li>
                    <li>Estadísticas avanzadas</li>
                    <li>Fase de grupos</li>
                    <li>Duracion ilimitada</li>
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div className="text-center mt-8">
          <Button variant="outline" asChild>
            <Link href="/pricing">Ver todos los detalles</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
