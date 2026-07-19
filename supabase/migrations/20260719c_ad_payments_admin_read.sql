-- El panel de admin (finanzas + estado en la card de publicidad) necesita leer
-- ad_payments desde el cliente. Las escrituras siguen por service role
-- (endpoint + webhook); acá solo habilitamos LECTURA para admins, igual que
-- ad_campaigns.

CREATE POLICY "Admin lee ad_payments"
  ON ad_payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
