"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, HandCoins, Wallet } from "lucide-react";
import { MonetizarSignupDialog } from "./monetizar-signup-dialog";
import type { PayoutInfo } from "@/hooks/use-payout-info";
import type { MonetizationConfig } from "@/lib/ad-analytics";

/**
 * La portada de "Monetizar": qué es el programa y el botón para entrar.
 *
 * El formulario NO vive acá — se abre en un diálogo al tocar el botón. Así, el
 * organizador que solo está curioseando lee de qué se trata sin que le pongan
 * una cédula y una cuenta bancaria enfrente; y el que ya decidió entra a llenar
 * sin distracciones.
 */
export function MonetizarIntro({
  existing,
  config,
  /** Estaba adentro pero cambiaron los términos y tiene que volver a aceptar. */
  needsReaccept,
  onDone,
}: {
  existing: PayoutInfo | null;
  config: MonetizationConfig | null;
  needsReaccept: boolean;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ganá con tus torneos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Vendemos espacios de publicidad a negocios locales. Cuando esos
            avisos aparecen en tus torneos, te llevás una parte de lo que pagó el
            anunciante: mientras más gente los vea en tus torneos, más grande es
            tu parte.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <Explainer
              icon={<Eye className="h-5 w-5" />}
              title="La gente ve tus torneos"
              text="No tenés que vender nada. La audiencia se cuenta sola cuando entran a consultar tus torneos."
            />
            {/* Acá decía "la mitad es para vos", que se lee como "te llevás el
                50%" y no es cierto: esa mitad se reparte ENTRE TODOS los
                organizadores donde salió el aviso, así que a cada uno le toca
                una fracción. Prometer de más en la portada es la peor forma de
                arrancar una relación donde hay plata. */}
            <Explainer
              icon={<HandCoins className="h-5 w-5" />}
              title="Ganás según tu audiencia"
              text="Cuanta más gente vea los avisos en tus torneos, más te toca. Si tus torneos ponen la mayor parte del público de una campaña, te llevás la mayor parte de lo que deja."
            />
            <Explainer
              icon={<Wallet className="h-5 w-5" />}
              title="Te transferimos"
              text="Al terminar el mes se cierra el corte y te llega a tu cuenta."
            />
          </div>

          <Thresholds config={config} />

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setOpen(true)} size="lg">
              {needsReaccept
                ? "Aceptar las condiciones nuevas"
                : "Quiero monetizar"}
            </Button>
            <p className="text-sm text-muted-foreground">
              {needsReaccept
                ? "Tus datos siguen guardados."
                : "Te vamos a pedir a dónde transferirte."}
            </p>
          </div>
        </CardContent>
      </Card>

      <MonetizarSignupDialog
        open={open}
        onOpenChange={setOpen}
        existing={existing}
        reaccepting={needsReaccept}
        onDone={() => {
          setOpen(false);
          onDone();
        }}
      />
    </>
  );
}

/**
 * Los mínimos para cobrar, con los números de verdad.
 *
 * Salen de `monetization_config`, no de un texto escrito a mano, por dos
 * razones. La primera es que se pueden ajustar con un UPDATE: cualquier número
 * copiado acá quedaría desactualizado sin que nadie se entere, y el organizador
 * estaría apuntando a una meta que ya no existe. La segunda es que por eso mismo
 * NO van en el texto de las condiciones, que es versionado: cambiar un umbral
 * obligaría a que todos vuelvan a aceptar los términos.
 *
 * Si no se pudieron leer, se dice en general en vez de inventar cifras. Un
 * número equivocado acá es una promesa equivocada.
 */
function Thresholds({ config }: { config: MonetizationConfig | null }) {
  if (!config) {
    return (
      <div className="rounded-md border bg-muted/40 p-4">
        <p className="text-sm font-medium">Qué necesitás para cobrar un mes</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Hay unos mínimos de audiencia y actividad. Apenas entrés vas a ver los
          tuyos con tu progreso.
        </p>
      </div>
    );
  }

  const items: string[] = [];
  if (config.min_person_days > 0)
    items.push(
      `${config.min_person_days} personas distintas viendo tus torneos en el mes`
    );
  if (config.min_active_days > 0)
    items.push(`Con público en al menos ${config.min_active_days} días distintos`);
  if (config.min_matches_with_result > 0)
    items.push(
      `${config.min_matches_with_result} partidos con el resultado cargado`
    );
  if (config.min_teams > 0)
    items.push(`Un torneo con al menos ${config.min_teams} equipos`);
  if (config.min_tournaments_in_progress > 0)
    items.push(
      `${config.min_tournaments_in_progress} torneo${
        config.min_tournaments_in_progress > 1 ? "s" : ""
      } en curso`
    );
  if (config.min_account_age_days > 0)
    items.push(`Cuenta creada hace más de ${config.min_account_age_days} días`);
  if (config.require_profile) items.push("Tu perfil con nombre y logo");

  return (
    <div className="rounded-md border bg-muted/40 p-4">
      <p className="text-sm font-medium">Qué necesitás para cobrar un mes</p>
      <ul className="mt-2 space-y-1">
        {items.map((t) => (
          <li key={t} className="flex gap-2 text-sm text-muted-foreground">
            <span aria-hidden>·</span>
            {t}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">
        Se miden mes a mes y arrancan de cero cada mes. Adentro vas a ver una
        barra con cuánto llevás de cada uno.
      </p>
    </div>
  );
}

function Explainer({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-primary">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
