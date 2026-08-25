-- ============================================================================
-- Paso 0.1 del plan: aprobar organizadores para que puedan cobrar
-- ----------------------------------------------------------------------------
-- Para correr a mano en el editor SQL de Supabase. Ver
-- `Por hacer/deuda-contra-publicidad.md` §5, Fase 0.
--
-- POR QUÉ HAY QUE HACER ESTO
-- Desde la migración 20260808d el reparto es LISTA BLANCA: nadie cobra hasta
-- que un admin lo apruebe. Al correr esa migración todos quedaron en
-- `pending`, así que **hoy no clasifica nadie** y no hay ningún error que lo
-- avise: aparecen como que les falta un requisito, igual que si les faltara
-- audiencia.
--
-- Todavía no hay botón en el panel. Se aprueba con el UPDATE del final.
--
-- ⚠️ APROBAR ES AUTORIZAR UN PAGO. Antes de aprobar, mirar que el nombre del
-- titular tenga sentido con el organizador y que el documento no esté a medias.
-- Es el lugar donde después se engancha el KYC.

-- ============================================================
-- 1. Quién está esperando
-- ============================================================
SELECT
  u.email,
  COALESCE(op.organization_name, u.name)  AS organizador,
  pi.full_name                            AS titular_cuenta,
  pi.document_type || ' ' || pi.document_number AS documento,
  pi.bank,
  pi.account_type,
  pi.account_number,
  pi.approval_status,
  pi.rejection_reason,
  pi.created_at::date                     AS se_inscribio,
  u.revenue_share_excluded                AS excluido_por_politica
FROM organizer_payout_info pi
JOIN users u                       ON u.id = pi.user_id
LEFT JOIN organization_profiles op ON op.user_id = pi.user_id
ORDER BY
  CASE pi.approval_status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END,
  pi.created_at;

-- CÓMO LEERLA
--   approval_status = 'pending'   → esperando tu decisión
--   approval_status = 'rejected'  → le dijiste qué corregir; él lo ve en pantalla
--   approval_status = 'approved'  → ya puede cobrar (si cumple los mínimos)
--   excluido_por_politica = true  → cuenta de prueba/socio: NO aprobar. Nunca
--                                   cobra, y aprobarla solo confunde el panel.

-- ============================================================
-- 2. Quién ni siquiera se inscribió
-- ============================================================
-- Organizadores con torneos que todavía no cargaron datos de pago. No están
-- esperando nada: les falta entrar a Monetizar y llenarlos. Sirve para saber a
-- quién escribirle.
SELECT
  u.email,
  COALESCE(op.organization_name, u.name) AS organizador,
  COUNT(t.id)                            AS torneos
FROM tournaments t
JOIN users u                       ON u.id = t.created_by
LEFT JOIN organization_profiles op ON op.user_id = t.created_by
LEFT JOIN organizer_payout_info pi ON pi.user_id = t.created_by
WHERE pi.user_id IS NULL
  AND COALESCE(u.revenue_share_excluded, false) = false
GROUP BY u.email, organizador
ORDER BY torneos DESC;

-- ============================================================
-- 3. Aprobar / rechazar
-- ============================================================
-- Desde el editor SQL funciona: no hay JWT, así que cuenta como conexión
-- privilegiada y el trigger que impide auto-aprobarse no aplica.
--
-- Aprobar:
--
--   UPDATE organizer_payout_info
--   SET approval_status = 'approved'
--   WHERE user_id = (SELECT id FROM users WHERE email = 'correo@ejemplo.com');
--
-- Rechazar CON MOTIVO (sin motivo es un callejón sin salida: él ve el rechazo
-- y no sabe qué corregir):
--
--   UPDATE organizer_payout_info
--   SET approval_status  = 'rejected',
--       rejection_reason = 'El nombre no coincide con el titular de la cuenta'
--   WHERE user_id = (SELECT id FROM users WHERE email = 'correo@ejemplo.com');
--
-- OJO: si el organizador cambia su cuenta bancaria después, el trigger lo
-- devuelve solo a 'pending'. Lo que aprobaste fue esa cuenta, no cualquiera.
