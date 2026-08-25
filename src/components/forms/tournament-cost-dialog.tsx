"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TournamentPriceInfo, formatCOP } from "@/lib/pricing";
import { TournamentFormat, Sport, CouponType } from "@/types";
import { getSportInfo } from "@/data/sports";
import { redirectToWompiCheckout, paymentReturnUrl } from "@/lib/payments/wompi-redirect";
import { useTournamentCredits } from "@/hooks/use-tournament-credits";
import { TOURNAMENT_PACKS, pricePerCredit } from "@/lib/packs";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";

export const FORMAT_LABELS: Record<TournamentFormat, string> = {
  elimination: "Eliminacion Directa",
  "round-robin": "Liga",
  "group-playoff": "Fase de Grupos + Playoffs",
};

interface AppliedCoupon {
  id: string;
  type: CouponType;
  value: number;
}

interface TournamentCostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (couponId?: string, paymentId?: string, useCredit?: boolean) => void;
  priceInfo: TournamentPriceInfo;
  tournamentName: string;
  format: TournamentFormat;
  teamCount: number;
  sport: Sport;
  userId: string;
  tournamentData: Record<string, unknown>;
}

export function TournamentCostDialog({
  open,
  onOpenChange,
  onConfirm,
  priceInfo,
  tournamentName,
  format,
  teamCount,
  sport,
  userId,
  tournamentData,
}: TournamentCostDialogProps) {
  const sportInfo = getSportInfo(sport);
  const [processing, setProcessing] = useState(false);

  // Créditos que cubren un torneo de ESTE tamaño. Si el organizador tiene
  // créditos de hasta 24 equipos y arma uno de 30, acá da 0 — y el diálogo no
  // le ofrece algo que la función de consumo después va a rechazar.
  const { balance: credits } = useTournamentCredits(teamCount);
  const creditCount = credits?.total ?? 0;

  // Un crédito vale más que un torneo chico: gastarlo ahí es perderle plata.
  // Se lo avisamos en vez de dejarlo pasar — cuesta una línea y es lo que hace
  // que confíe en el resto.
  const creditValue = pricePerCredit(TOURNAMENT_PACKS["pack-5"]);
  const creditIsWasteful = creditCount > 0 && priceInfo.price < creditValue;

  // Coupon
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [validating, setValidating] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setProcessing(false);
      setCouponCode("");
      setAppliedCoupon(null);
    }
    onOpenChange(isOpen);
  };

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidating(true);

    const { data, error } = await supabase
      .from("coupons")
      .select("id, type, value, used_by")
      .eq("code", couponCode.trim().toUpperCase())
      .single();

    if (error || !data) {
      toast.error("Código no encontrado");
      setValidating(false);
      return;
    }

    if (data.used_by) {
      toast.error("Este código ya fue utilizado");
      setValidating(false);
      return;
    }

    setAppliedCoupon({
      id: data.id,
      type: data.type as CouponType,
      value: data.value,
    });
    toast.success("Código aplicado");
    setValidating(false);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
  };

  // Calculate effective cost based on coupon
  const effectiveCost = appliedCoupon
    ? appliedCoupon.type === "free_tournament"
      ? 0
      : appliedCoupon.type === "percentage"
        ? Math.round(priceInfo.price * (100 - appliedCoupon.value) / 100)
        : priceInfo.price
    : priceInfo.price;

  // Un `percentage` de 100 deja el torneo en $0 igual que un `free_tournament`,
  // así que también tiene que saltear el pago: si sale a cobrar, va a
  // `create-reference` con monto 0 y esa ruta lo rechaza ("Faltan campos
  // requeridos"), dejando el torneo sin crear con un error que no explica nada.
  const skipPayment = appliedCoupon
    ? appliedCoupon.type === "free_tournament" ||
      (appliedCoupon.type === "percentage" && appliedCoupon.value >= 100)
    : false;

  const handleCreditConfirm = () => {
    setProcessing(true);
    // El consumo real lo hace `createTournament` DESPUÉS de crear el torneo,
    // porque el crédito se ata a su id. Acá solo se avisa la intención.
    onConfirm(undefined, undefined, true);
  };

  const handleFreeConfirm = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      onConfirm(appliedCoupon?.id);
    }, 500);
  };

  const handleContinueToPayment = async () => {
    setProcessing(true);

    try {
      const response = await fetch("/api/payments/create-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          amountCop: effectiveCost,
          couponId: appliedCoupon?.id,
          tournamentData,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Error al iniciar el pago");
        setProcessing(false);
        return;
      }

      const { reference, amountInCents, integrity } = await response.json();

      const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;
      if (!publicKey) {
        toast.error("Error al cargar el sistema de pago. Intenta de nuevo.");
        setProcessing(false);
        return;
      }

      // Redirect to Wompi's hosted checkout (HTML form GET). On completion Wompi
      // returns to redirect-url?id=<txn>; the tournament is created server-side
      // (webhook / confirm) and the return page polls until it's ready.
      const returnUrl = paymentReturnUrl(reference);

      // Keep `processing` true: we're navigating away.
      redirectToWompiCheckout({
        publicKey,
        amountInCents,
        reference,
        integrity,
        redirectUrl: returnUrl,
      });
    } catch (err) {
      console.error("Payment error:", err);
      toast.error("Error al procesar el pago");
      setProcessing(false);
    }
  };

  return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Creacion</DialogTitle>
            <DialogDescription>{tournamentName}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                {sportInfo?.emoji} {sportInfo?.label}
              </Badge>
              <Badge variant="outline">{FORMAT_LABELS[format]}</Badge>
              <Badge variant="outline">{teamCount} equipos</Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                {priceInfo.tierLabel}
              </Badge>
            </div>

            {/* Price display */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Pago unico</p>
              {appliedCoupon ? (
                <>
                  {appliedCoupon.type === "free_tournament" ? (
                    <>
                      <p className="text-sm line-through text-muted-foreground">
                        {formatCOP(priceInfo.price)}
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        Gratis
                      </p>
                    </>
                  ) : appliedCoupon.type === "percentage" ? (
                    <>
                      <p className="text-sm line-through text-muted-foreground">
                        {formatCOP(priceInfo.price)}
                      </p>
                      <p className="text-2xl font-bold text-primary">
                        {formatCOP(effectiveCost)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {appliedCoupon.value}% de descuento
                      </p>
                    </>
                  ) : null}
                </>
              ) : (
                <p className="text-2xl font-bold text-primary">
                  {formatCOP(priceInfo.price)}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Duracion ilimitada
              </p>
            </div>

            {/* Coupon input */}
            <div className="space-y-2">
              <Label className="text-xs">Código de descuento</Label>
              {appliedCoupon ? (
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-md px-3 py-2">
                  <span className="font-mono font-bold text-sm text-green-600 flex-1">
                    {couponCode.toUpperCase()}
                  </span>
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                    {appliedCoupon.type === "free_tournament"
                      ? "Torneo Gratis"
                      : `${appliedCoupon.value}% OFF`}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={removeCoupon}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="TORNEO2024"
                    className="h-9"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 px-4 flex-shrink-0"
                    onClick={validateCoupon}
                    disabled={validating || !couponCode.trim()}
                  >
                    {validating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Aplicar"
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {creditCount > 0 && !appliedCoupon && (
            <div
              className={
                creditIsWasteful
                  ? "rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-500"
                  : "rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs"
              }
            >
              {creditIsWasteful ? (
                <>
                  <strong>Te conviene pagarlo.</strong> Este torneo cuesta menos
                  que uno de tus créditos ({formatCOP(creditValue)} cada uno).
                  Guardalos para un torneo más grande — pero si preferís usar
                  uno, podés.
                </>
              ) : (
                <>
                  Tenés <strong>{creditCount}</strong> torneo
                  {creditCount === 1 ? "" : "s"} de tu paquete. Podés usar uno
                  —te quedarían {creditCount - 1}— o pagar este aparte y
                  guardarlos todos.
                </>
              )}
            </div>
          )}

          {/* Con créditos disponibles se muestran SIEMPRE las dos formas de
              pagar, nunca una sola. Gastar un crédito es gastar plata: quitarle
              el botón de pagar sería decidir por él.

              Lo único que cambia según el caso es CUÁL va arriba y destacada.
              Si el torneo vale menos que un crédito, se recomienda pagarlo; si
              no, usar el crédito. */}
          {creditCount > 0 && !appliedCoupon && !skipPayment ? (
            <div className="space-y-2 pt-2">
              <Button
                className="w-full"
                variant={creditIsWasteful ? "outline" : "default"}
                onClick={handleCreditConfirm}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  `Usar 1 de tus ${creditCount} torneos`
                )}
              </Button>

              <Button
                className="w-full"
                variant={creditIsWasteful ? "default" : "outline"}
                onClick={handleContinueToPayment}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Redirigiendo...
                  </>
                ) : (
                  `Pagar ${formatCOP(effectiveCost)} y guardar mis créditos`
                )}
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => handleOpenChange(false)}
                disabled={processing}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleOpenChange(false)}
                disabled={processing}
              >
                Cancelar
              </Button>
              {skipPayment ? (
                <Button
                  className="flex-1"
                  onClick={handleFreeConfirm}
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    "Crear Torneo"
                  )}
                </Button>
              ) : (
                <Button
                  className="flex-1"
                  onClick={handleContinueToPayment}
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Redirigiendo...
                    </>
                  ) : (
                    "Ir a pagar"
                  )}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
  );
}
