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
import { TournamentCostBreakdown, formatCOP } from "@/lib/pricing";
import { TournamentFormat, Sport } from "@/types";
import { getSportInfo } from "@/data/sports";
import { CreditCard, Building2, ArrowLeft, Loader2 } from "lucide-react";

const FORMAT_LABELS: Record<TournamentFormat, string> = {
  elimination: "Eliminacion Directa",
  "round-robin": "Liga",
  "group-playoff": "Fase de Grupos + Playoffs",
};

type PaymentMethod = "pse" | "card" | null;
type Step = "summary" | "payment";

interface TournamentCostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  breakdown: TournamentCostBreakdown;
  tournamentName: string;
  format: TournamentFormat;
  teamCount: number;
  sport: Sport;
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
}: TournamentCostDialogProps) {
  const sportInfo = getSportInfo(sport);
  const [step, setStep] = useState<Step>("summary");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [processing, setProcessing] = useState(false);

  // Card fields (mock)
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");

  // PSE fields (mock)
  const [pseBank, setPseBank] = useState("");

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setStep("summary");
      setPaymentMethod(null);
      setProcessing(false);
      setCardNumber("");
      setCardExpiry("");
      setCardCvc("");
      setCardName("");
      setPseBank("");
    }
    onOpenChange(isOpen);
  };

  const handlePay = () => {
    setProcessing(true);
    // Simulate payment processing
    setTimeout(() => {
      setProcessing(false);
      onConfirm();
      setStep("summary");
      setPaymentMethod(null);
    }, 1500);
  };

  const isCardValid =
    cardNumber.replace(/\s/g, "").length >= 13 &&
    cardExpiry.length >= 4 &&
    cardCvc.length >= 3 &&
    cardName.trim().length > 0;

  const isPseValid = pseBank.trim().length > 0;

  const canPay =
    (paymentMethod === "card" && isCardValid) ||
    (paymentMethod === "pse" && isPseValid);

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {step === "summary" ? (
          <>
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

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">Costo mensual</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCOP(breakdown.monthlyCost)}
                  <span className="text-sm font-normal text-muted-foreground">
                    /mes
                  </span>
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button className="flex-1" onClick={() => setStep("payment")}>
                Continuar al Pago
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Metodo de Pago</DialogTitle>
              <DialogDescription>
                {formatCOP(breakdown.monthlyCost)}/mes — {tournamentName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Payment method selection */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("card")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors ${
                    paymentMethod === "card"
                      ? "bg-primary/10 border-primary text-primary"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <CreditCard className="h-6 w-6" />
                  <span className="text-sm font-medium">Tarjeta</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("pse")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors ${
                    paymentMethod === "pse"
                      ? "bg-primary/10 border-primary text-primary"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <Building2 className="h-6 w-6" />
                  <span className="text-sm font-medium">PSE</span>
                </button>
              </div>

              {/* Card form */}
              {paymentMethod === "card" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Numero de tarjeta</Label>
                    <Input
                      placeholder="1234 5678 9012 3456"
                      value={cardNumber}
                      onChange={(e) =>
                        setCardNumber(formatCardNumber(e.target.value))
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nombre en la tarjeta</Label>
                    <Input
                      placeholder="Juan Perez"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Vencimiento</Label>
                      <Input
                        placeholder="MM/AA"
                        value={cardExpiry}
                        onChange={(e) =>
                          setCardExpiry(formatExpiry(e.target.value))
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">CVC</Label>
                      <Input
                        placeholder="123"
                        value={cardCvc}
                        onChange={(e) =>
                          setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))
                        }
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* PSE form */}
              {paymentMethod === "pse" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Banco</Label>
                    <select
                      value={pseBank}
                      onChange={(e) => setPseBank(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">Seleccionar banco</option>
                      <option value="bancolombia">Bancolombia</option>
                      <option value="davivienda">Davivienda</option>
                      <option value="bbva">BBVA</option>
                      <option value="bogota">Banco de Bogota</option>
                      <option value="occidente">Banco de Occidente</option>
                      <option value="popular">Banco Popular</option>
                      <option value="avvillas">AV Villas</option>
                      <option value="nequi">Nequi</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setStep("summary");
                  setPaymentMethod(null);
                }}
                disabled={processing}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button
                className="flex-1"
                disabled={!canPay || processing}
                onClick={handlePay}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  `Pagar ${formatCOP(breakdown.monthlyCost)}`
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
