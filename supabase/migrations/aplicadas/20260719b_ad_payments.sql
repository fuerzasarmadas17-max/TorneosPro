-- Pagos de publicidad. El admin genera un link de pago para una campaña con el
-- monto acordado (monthly_price); el anunciante paga en Wompi. Tabla separada
-- de `payments` porque esa exige user_id + tournament_data, que acá no aplican.
--
-- Solo se accede vía service role (endpoint admin + página de pago server-side);
-- RLS prendido sin policies públicas, igual que ad_campaigns.

CREATE TABLE IF NOT EXISTS ad_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  reference TEXT NOT NULL UNIQUE,
  amount_cop INT NOT NULL,
  amount_in_cents INT NOT NULL,
  integrity_signature TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending / approved / declined
  wompi_transaction_id TEXT,
  wompi_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_payments_campaign ON ad_payments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_payments_reference ON ad_payments(reference);

ALTER TABLE ad_payments ENABLE ROW LEVEL SECURITY;
