import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import {
  TIER_PRICES,
  TIER_LABELS,
  TIER_TEAM_RANGES,
  FREE_TIER_LIMITS,
  formatCOP,
} from "@/lib/pricing";
import { TournamentTier } from "@/types";

interface PlanFeature {
  label: string;
  free: boolean;
  paid: boolean;
}

const FEATURES: PlanFeature[] = [
  { label: "Eliminacion directa", free: true, paid: true },
  { label: "Liga (round-robin)", free: false, paid: true },
  { label: "Fase de grupos + playoffs", free: false, paid: true },
  { label: "Estadísticas avanzadas", free: false, paid: true },
  { label: "Fase de grupos", free: false, paid: true },
  { label: "Duracion ilimitada", free: true, paid: true },
  { label: "Torneos activos ilimitados", free: false, paid: true },
];

export default function PricingPage() {
  return (
    <div className="container mx-auto px-4 py-16 space-y-12">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold">Planes y Precios</h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Un solo pago por torneo, sin suscripciones ni cargos mensuales.
          Tu torneo no expira nunca.
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* Free */}
        <Card className="border-2 flex flex-col">
          <CardHeader className="pb-2">
            <p className="font-semibold text-lg">Gratis</p>
            <p className="text-3xl font-bold">$0</p>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <Badge variant="outline">
              Hasta {FREE_TIER_LIMITS.maxTeams} equipos
            </Badge>
            <ul className="text-sm space-y-2">
              {FEATURES.map((f) => (
                <li key={f.label} className="flex items-start gap-2">
                  {f.free ? (
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
                  )}
                  <span className={f.free ? "" : "text-muted-foreground/60"}>
                    {f.label}
                  </span>
                </li>
              ))}
              <li className="flex items-start gap-2">
                <X className="h-4 w-4 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground/60">
                  Max 1 torneo activo
                </span>
              </li>
            </ul>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/tournaments/create">Crear Torneo</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Paid tiers */}
        {(Object.keys(TIER_PRICES) as TournamentTier[]).map((tier) => {
          const range = TIER_TEAM_RANGES[tier];
          const isPopular = tier === "pro";
          return (
            <Card
              key={tier}
              className={`flex flex-col ${
                isPopular ? "border-2 border-primary" : "border-2"
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-lg">{TIER_LABELS[tier]}</p>
                  {isPopular && <Badge className="text-xs">Popular</Badge>}
                </div>
                <p className="text-3xl font-bold">
                  {formatCOP(TIER_PRICES[tier])}
                </p>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <Badge variant="outline">
                  {range.min}-{range.max ?? "+"} equipos
                </Badge>
                <ul className="text-sm space-y-2">
                  {FEATURES.map((f) => (
                    <li key={f.label} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{f.label}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full ${isPopular ? "" : ""}`}
                  variant={isPopular ? "default" : "outline"}
                  asChild
                >
                  <Link href="/tournaments/create">Crear Torneo</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* FAQ / Notes */}
      <div className="max-w-2xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold text-center">
          Preguntas frecuentes
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Es un pago unico?</h3>
            <p className="text-sm text-muted-foreground">
              Si. Pagas una sola vez al crear el torneo y lo puedes usar sin
              limite de tiempo. No hay suscripciones ni cargos recurrentes.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Que pasa si agrego mas equipos?</h3>
            <p className="text-sm text-muted-foreground">
              El precio se define por la cantidad de equipos al crear el
              torneo. Puedes agregar equipos libremente dentro de tu rango.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Puedo usar el plan gratis?</h3>
            <p className="text-sm text-muted-foreground">
              Si. Los torneos de hasta {FREE_TIER_LIMITS.maxTeams} equipos en
              formato de eliminacion directa son completamente gratis. Solo
              puedes tener {FREE_TIER_LIMITS.maxActiveFree} torneo gratis
              activo a la vez.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Que metodos de pago aceptan?</h3>
            <p className="text-sm text-muted-foreground">
              Aceptamos tarjetas de credito, debito, PSE y Nequi a traves de
              Wompi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
