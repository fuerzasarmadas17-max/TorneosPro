"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useMyAdEarnings, currentPeriodMonth } from "@/hooks/use-my-ad-earnings";
import { usePayoutInfo } from "@/hooks/use-payout-info";
import { MonetizarIntro } from "@/components/monetizar/monetizar-intro";
import { MonetizarSignupDialog } from "@/components/monetizar/monetizar-signup-dialog";
import { MonthGoal } from "@/components/monetizar/month-goal";
import { AudienceThisMonth } from "@/components/monetizar/audience-this-month";
import { ApprovalNotice } from "@/components/monetizar/approval-notice";
import { SettlementsHistory } from "@/components/monetizar/settlements-history";
import { RequirementsProgress } from "@/components/monetizar/requirements-progress";
import { MyDebts } from "@/components/monetizar/my-debts";
import { useTournamentDebts, paidByMonth } from "@/hooks/use-tournament-debts";
import { maskAccount } from "@/lib/ad-analytics";
import { MONETIZAR_ENABLED } from "@/lib/monetizar-flag";

/**
 * Sección "Monetizar" del organizador.
 *
 * Dos pantallas distintas, no una con partes escondidas:
 *
 *   ANTES DE INSCRIBIRSE  la portada: qué es el programa, los mínimos y el
 *                         botón. El formulario se abre en un diálogo.
 *   DESPUÉS               sus cifras. La portada desaparece: ya sabe de qué se
 *                         trata, y dejarla arriba empujaba la plata —que es a lo
 *                         que entra— media pantalla hacia abajo.
 *
 * Lo que se explicaba en la portada no se pierde: queda en el enlace "Cómo
 * funciona", que lleva a las condiciones.
 */
function MonetizarContent() {
  const { user } = useAuth();
  const router = useRouter();
  const month = currentPeriodMonth();
  const [editOpen, setEditOpen] = useState(false);

  const { info, onboarded, needsReaccept, loading: payoutLoading, refetch } =
    usePayoutInfo();
  // Se pide una sola vez acá y se reparte: la tarjeta de deudas y el histórico
  // tienen que mostrar exactamente los mismos números, y dos consultas
  // separadas son dos oportunidades de que difieran.
  const { debts, payments: debtPayments, loading: debtsLoading } =
    useTournamentDebts();
  const {
    audience,
    settlements,
    campaignNames,
    status,
    config,
    loading: earningsLoading,
    error,
  } = useMyAdEarnings(month);

  // Se sale de acá por dos motivos distintos:
  //
  //  - El programa está apagado (`MONETIZAR_ENABLED`). Esconder el enlace del
  //    menú no alcanza: la URL sigue existiendo y se comparte por WhatsApp.
  //  - Es admin, que tiene su propio panel con el reparto de todos. Mismo
  //    criterio que Logos y Configuración.
  useEffect(() => {
    if (!MONETIZAR_ENABLED || user?.role === "admin") {
      router.replace("/dashboard");
    }
  }, [user, router]);

  if (!MONETIZAR_ENABLED || user?.role === "admin") return null;

  const heading = (
    <div className="mb-6 space-y-1">
      <h1 className="text-2xl font-bold tracking-tight">Monetizar</h1>
      <p className="text-sm text-muted-foreground">
        Ganás una parte de lo que pagan los anunciantes que aparecen en tus
        torneos, según cuánta gente los vio.
      </p>
    </div>
  );

  const shell = (children: React.ReactNode) => (
    <div className="container mx-auto px-4 py-8">
      {heading}
      {children}
    </div>
  );

  if (payoutLoading) return shell(<Loading />);

  // Quien todavía no aceptó no ve un solo peso. No es burocracia: tiene que
  // haber aceptado por escrito que el número del mes puede bajar ANTES de ver un
  // número que va a leer como promesa.
  if (!onboarded) {
    return shell(
      <MonetizarIntro
        existing={info}
        config={config}
        needsReaccept={needsReaccept}
        onDone={refetch}
      />
    );
  }

  // Cuenta excluida del reparto: no se le muestra ni meta ni cifras. Antes veía
  // "Ya estás inscrito" y debajo "esta cuenta está por fuera", que se
  // contradicen; y una barra de progreso hacia una plata que nunca va a cobrar
  // es una burla.
  if (status?.excluded) {
    return shell(
      <Card>
        <CardContent className="space-y-2 py-8 text-sm">
          <p className="font-medium">Esta cuenta no participa del reparto</p>
          <p className="text-muted-foreground">
            Tus torneos siguen mostrando publicidad con normalidad, pero esta
            cuenta está marcada como excluida del reparto de ingresos. Si creés
            que es un error, escribinos.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (earningsLoading) return shell(<Loading />);

  return shell(
    <div className="space-y-6">
      {status && (
        <ApprovalNotice status={status} onFix={() => setEditOpen(true)} />
      )}

      {status && config ? (
        <MonthGoal row={status} config={config} month={month} />
      ) : null}

      {/* Va arriba, antes de las cifras. Aceptó unos términos que dicen que se
          le descuenta; si su saldo apareciera recién al final —o peor, recién
          en el primer corte— la pantalla le estaría contradiciendo lo que
          firmó. Se pinta solo si debe algo. */}
      <MyDebts debts={debts} payments={debtPayments} loading={debtsLoading} />

      {error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="mes">
          <TabsList>
            <TabsTrigger value="mes">Este mes</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="mes" className="mt-6">
            <AudienceThisMonth data={audience} />
          </TabsContent>
          <TabsContent value="historico" className="mt-6">
            <SettlementsHistory
              settlements={settlements}
              campaignNames={campaignNames}
              abonosByMonth={paidByMonth(debtPayments)}
            />
          </TabsContent>
        </Tabs>
      )}

      {status && config ? (
        <RequirementsProgress row={status} config={config} />
      ) : (
        // `null` es "no se pudo saber", no "no clasificás". Decir lo segundo por
        // un fallo de red sería mentirle sobre su plata.
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No pudimos consultar tus requisitos ahora mismo. Volvé a entrar en un
            rato.
          </CardContent>
        </Card>
      )}

      {/* El pie: a dónde le transferimos y de qué se trata el programa.
          Los datos de pago tienen que poder editarse desde acá — sin esto, el
          organizador que cambia de banco no tiene ninguna forma de avisarnos, y
          nos enteramos cuando la transferencia se devuelve. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm">
        <p className="text-muted-foreground">
          Te transferimos a {info?.bank}{" "}
          {info?.account_number ? maskAccount(info.account_number) : ""}
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/terminos-monetizacion"
            target="_blank"
            className="text-muted-foreground underline underline-offset-2"
          >
            Cómo funciona
          </Link>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Cambiar datos de pago
          </Button>
        </div>
      </div>

      <MonetizarSignupDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        existing={info}
        reaccepting={false}
        onDone={() => {
          setEditOpen(false);
          refetch();
        }}
      />
    </div>
  );
}

function Loading() {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        Cargando…
      </CardContent>
    </Card>
  );
}

export default function MonetizarPage() {
  return (
    <AuthGuard>
      <MonetizarContent />
    </AuthGuard>
  );
}
