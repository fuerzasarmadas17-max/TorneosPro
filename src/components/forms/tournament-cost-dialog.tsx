"use client";

import { useState } from "react";
import Script from "next/script";
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
import { TournamentCostBreakdown, formatCOP } from "@/lib/pricing";
import { TournamentFormat, Sport, CouponType } from "@/types";
import { getSportInfo } from "@/data/sports";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";

const FORMAT_LABELS: Record<TournamentFormat, string> = {
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
  onConfirm: (couponId?: string, paymentId?: string) => void;
  breakdown: TournamentCostBreakdown;
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
  breakdown,
  tournamentName,
  format,
  teamCount,
  sport,
  userId,
  tournamentData,
}: TournamentCostDialogProps) {
  const sportInfo = getSportInfo(sport);
  const [processing, setProcessing] = useState(false);
  const [wompiReady, setWompiReady] = useState(false);

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
      toast.error("Codigo no encontrado");
      setValidating(false);
      return;
    }

    if (data.used_by) {
      toast.error("Este codigo ya fue utilizado");
      setValidating(false);
      return;
    }

    setAppliedCoupon({
      id: data.id,
      type: data.type as CouponType,
      value: data.value,
    });
    toast.success("Codigo aplicado");
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
        ? Math.round(breakdown.monthlyCost * (100 - appliedCoupon.value) / 100)
        : breakdown.monthlyCost
    : breakdown.monthlyCost;

  // Skip Wompi for free_tournament and free_months
  const skipPayment = appliedCoupon
    ? appliedCoupon.type === "free_tournament" || appliedCoupon.type === "free_months"
    : false;

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
      // 1. Call API to create payment reference and integrity signature
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

      const { reference, amountInCents, integrity, paymentId } =
        await response.json();

      // 2. Open Wompi widget
      const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;

      if (!publicKey || !window.WidgetCheckout) {
        toast.error("Error al cargar el sistema de pago. Intenta de nuevo.");
        setProcessing(false);
        return;
      }

      const checkout = new window.WidgetCheckout({
        currency: "COP",
        amountInCents,
        reference,
        publicKey,
        signature: { integrity },
      });

      checkout.open((result: WompiTransactionResult) => {
        const transaction = result?.transaction;

        if (!transaction) {
          toast.error("No se recibio respuesta del pago");
          setProcessing(false);
          return;
        }

        if (transaction.status === "APPROVED") {
          toast.success("Pago aprobado");
          onConfirm(appliedCoupon?.id, paymentId);
        } else if (transaction.status === "DECLINED") {
          toast.error("Pago rechazado. Intenta con otro metodo de pago.");
          setProcessing(false);
        } else if (transaction.status === "VOIDED") {
          toast.error("Pago anulado");
          setProcessing(false);
        } else {
          toast.error("Error en el pago. Intenta de nuevo.");
          setProcessing(false);
        }
      });
    } catch (err) {
      console.error("Payment error:", err);
      toast.error("Error al procesar el pago");
      setProcessing(false);
    }
  };

  return (
    <>
      <Script
        src="https://checkout.wompi.co/widget.js"
        strategy="lazyOnload"
        onReady={() => setWompiReady(true)}
      />
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
              <Badge variant="outline">
                {breakdown.matchRecords} partidos
              </Badge>
            </div>

            {/* Price display */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Costo mensual</p>
              {appliedCoupon ? (
                <>
                  {appliedCoupon.type === "free_tournament" ? (
                    <>
                      <p className="text-sm line-through text-muted-foreground">
                        {formatCOP(breakdown.monthlyCost)}/mes
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        Gratis
                      </p>
                    </>
                  ) : appliedCoupon.type === "percentage" ? (
                    <>
                      <p className="text-sm line-through text-muted-foreground">
                        {formatCOP(breakdown.monthlyCost)}/mes
                      </p>
                      <p className="text-2xl font-bold text-primary">
                        {formatCOP(effectiveCost)}
                        <span className="text-sm font-normal text-muted-foreground">
                          /mes
                        </span>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-primary">
                        {appliedCoupon.value} mes{appliedCoupon.value > 1 ? "es" : ""} gratis
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Luego {formatCOP(breakdown.monthlyCost)}/mes
                      </p>
                    </>
                  )}
                </>
              ) : (
                <p className="text-2xl font-bold text-primary">
                  {formatCOP(breakdown.monthlyCost)}
                  <span className="text-sm font-normal text-muted-foreground">
                    /mes
                  </span>
                </p>
              )}
            </div>

            {/* Coupon input */}
            <div className="space-y-2">
              <Label className="text-xs">Codigo de descuento</Label>
              {appliedCoupon ? (
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-md px-3 py-2">
                  <span className="font-mono font-bold text-sm text-green-600 flex-1">
                    {couponCode.toUpperCase()}
                  </span>
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                    {appliedCoupon.type === "free_tournament"
                      ? "Torneo Gratis"
                      : appliedCoupon.type === "percentage"
                        ? `${appliedCoupon.value}% OFF`
                        : `${appliedCoupon.value} mes${appliedCoupon.value > 1 ? "es" : ""} gratis`}
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
                disabled={processing || !wompiReady}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  "Continuar al Pago"
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
