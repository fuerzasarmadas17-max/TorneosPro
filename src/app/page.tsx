import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SPORTS } from "@/data/sports";
import { VideoBackground } from "@/components/landing/video-background";

export default function HomePage() {
  return (
    <div className="flex flex-col">
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
    </div>
  );
}
