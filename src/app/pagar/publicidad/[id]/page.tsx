import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabaseAdmin } from "@/lib/supabase-server";
import { AdPayButton } from "./pay-button";

export const metadata: Metadata = {
  title: "Pago de publicidad | TorneosPro",
  robots: { index: false, follow: false },
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cop = (v: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(v);

export default async function AdPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { id } = await params;
  const { paid } = await searchParams;
  if (!UUID_RE.test(id)) notFound();

  const { data: payment } = await supabaseAdmin
    .from("ad_payments")
    .select(
      "id, reference, amount_cop, amount_in_cents, integrity_signature, status, campaign_id"
    )
    .eq("id", id)
    .maybeSingle();

  if (!payment) notFound();

  const { data: campaign } = await supabaseAdmin
    .from("ad_campaigns")
    .select("advertiser_name")
    .eq("id", payment.campaign_id)
    .maybeSingle();

  const advertiser = campaign?.advertiser_name ?? "Publicidad";
  const isApproved = payment.status === "approved";
  const isCanceled = payment.status === "canceled";
  const returning = !!paid;

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center justify-center px-4 py-12">
      <Card className="w-full">
        <CardHeader className="text-center">
          <p className="text-sm text-muted-foreground">Pago de publicidad</p>
          <CardTitle className="text-2xl">{advertiser}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/30 p-4 text-center">
            <p className="text-sm text-muted-foreground">Monto a pagar</p>
            <p className="text-3xl font-bold tracking-tight">{cop(payment.amount_cop)}</p>
          </div>

          {isApproved ? (
            <p className="text-center text-sm font-medium text-green-600">
              Este pago ya fue confirmado. ¡Gracias!
            </p>
          ) : isCanceled ? (
            <p className="text-center text-sm text-muted-foreground">
              Este link de pago ya no está vigente. Pedile al organizador un link
              actualizado.
            </p>
          ) : returning ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                Recibimos tu pago. Estamos verificándolo con Wompi; tu publicidad se
                activará una vez confirmado.
              </p>
              <AdPayButton
                id={payment.id}
                amountInCents={payment.amount_in_cents}
                reference={payment.reference}
                integrity={payment.integrity_signature}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <AdPayButton
                id={payment.id}
                amountInCents={payment.amount_in_cents}
                reference={payment.reference}
                integrity={payment.integrity_signature}
              />
              <p className="text-center text-xs text-muted-foreground">
                Pago seguro procesado por Wompi.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
