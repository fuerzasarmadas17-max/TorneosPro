-- ============================================================================
-- Registrar el pago de publicidad de GuauHotDog cobrado POR FUERA de Wompi
-- ----------------------------------------------------------------------------
-- $85.000 recibidos en efectivo/transferencia, no por la pasarela. Sin esta
-- fila, Negocios muestra $0 de ingreso por publicidad aunque la plata ya entró.
--
-- Campaña: GuauHotDog (530fc0c7-fc64-48b5-b592-4b6ee021a0b4)
--          activa del 2026-08-10 al 2026-09-06, precio mensual $85.000.
--
-- ⚠️ EL REPARTO CON ORGANIZADORES NO SE TOCA ACÁ, Y NO HACE FALTA.
-- Son dos cosas distintas y es fácil confundirlas:
--
--   ad_payments        → lo que ENTRÓ a la caja. Es lo que suma Negocios.
--   ad_period_revenue  → lo cobrado por campaña y mes. Es la base del 50%
--                        que se reparte entre organizadores.
--
-- `ad_period_revenue` YA tiene la fila de GuauHotDog para agosto por $85.000
-- (la cargaste el 2026-08-11 desde /admin/publicidad). O sea que los
-- organizadores ya tienen su parte contada. Esto solo completa el otro lado.
--
-- Verificado contra la base el 2026-08-15.

BEGIN;

INSERT INTO ad_payments (
  campaign_id,
  reference,
  amount_cop,
  amount_in_cents,
  integrity_signature,
  status,
  created_at
)
VALUES (
  '530fc0c7-fc64-48b5-b592-4b6ee021a0b4',   -- GuauHotDog
  'PUB-MANUAL-2026-001',                     -- referencia propia, no de Wompi
  85000,
  8500000,
  'n/a-pago-manual-externo',                 -- no hay firma: no pasó por Wompi
  'approved',
  -- 👇 CAMBIÁ ESTA FECHA si la plata entró otro día.
  '2026-08-10T12:00:00-05:00'
)
-- Si ya existe esa referencia (por si corrés esto dos veces), no duplica.
ON CONFLICT (reference) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verificación
-- ---------------------------------------------------------------------------
-- 1) La fila quedó aprobada:
SELECT p.reference, p.amount_cop, p.status, p.created_at, c.advertiser_name
FROM   ad_payments p
JOIN   ad_campaigns c ON c.id = p.campaign_id
WHERE  p.reference = 'PUB-MANUAL-2026-001';

-- 2) Esto es lo que va a mostrar Negocios como "ingreso por publicidad".
--    Debe dar 85000.
SELECT COALESCE(SUM(amount_cop), 0) AS ingreso_publicidad
FROM   ad_payments
WHERE  status = 'approved';
