-- Botón de WhatsApp en el modal de publicidad, además del link de destino que
-- ya existía. El modal muestra los botones cargados (WhatsApp y/o link); si solo
-- hay uno, muestra solo ese.
--
-- El WhatsApp es público (es la acción que ve el espectador), a diferencia de
-- `contact`, que es el dato interno para renovar la pauta.
--
-- link_url deja de ser obligatorio: un anuncio puede tener solo WhatsApp.

ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ALTER COLUMN link_url DROP NOT NULL;
