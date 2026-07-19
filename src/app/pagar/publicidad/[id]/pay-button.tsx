"use client";

import { Button } from "@/components/ui/button";
import { redirectToWompiCheckout } from "@/lib/payments/wompi-redirect";

interface AdPayButtonProps {
  id: string;
  amountInCents: number;
  reference: string;
  integrity: string;
}

export function AdPayButton({ id, amountInCents, reference, integrity }: AdPayButtonProps) {
  const handlePay = () => {
    const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;
    if (!publicKey) return;
    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || window.location.origin;
    redirectToWompiCheckout({
      publicKey,
      amountInCents,
      reference,
      integrity,
      redirectUrl: `${origin}/pagar/publicidad/${id}?paid=1`,
    });
  };

  return (
    <Button className="w-full" size="lg" onClick={handlePay}>
      Pagar con Wompi
    </Button>
  );
}
