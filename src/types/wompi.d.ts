interface WompiWidgetConfig {
  currency: string;
  amountInCents: number;
  reference: string;
  publicKey: string;
  signature: { integrity: string };
  redirectUrl?: string;
}

interface WompiTransactionResult {
  transaction: {
    id: string;
    reference: string;
    status: "APPROVED" | "DECLINED" | "VOIDED" | "ERROR" | "PENDING";
    amount_in_cents: number;
    currency: string;
    payment_method_type: string;
    created_at: string;
  } | null;
}

declare class WidgetCheckout {
  constructor(config: WompiWidgetConfig);
  open(callback: (result: WompiTransactionResult) => void): void;
}

interface Window {
  WidgetCheckout: typeof WidgetCheckout;
}
