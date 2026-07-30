-- ============================================================================
-- Datos de pago del organizador
-- ----------------------------------------------------------------------------
-- `ad_settlements` podía marcar un corte como "pagada" sin que existiera en
-- ninguna parte a dónde mandar el dinero. Ni `users` ni `organization_profiles`
-- guardan cédula, banco ni cuenta.
--
-- Decisión del organizador (2026-07-30): nombre completo, cédula, banco, tipo de
-- cuenta y número, provistos por él en la sección "Monetizar", y obligatorios
-- para clasificar.
--
-- ⚠️ EL REQUISITO ARRANCA APAGADO (`require_payout_info = false`).
-- La pantalla para llenar estos datos todavía no existe. Prenderlo ahora dejaría
-- a TODOS los organizadores sin clasificar por un motivo que ninguno puede
-- resolver, y el panel mostraría el reparto entero en retenido sin razón real.
-- Se prende con un UPDATE el día que la sección se despliegue.
--
-- ESTO ES INFORMACIÓN SENSIBLE
-- Cédula + cuenta bancaria. Va en tabla aparte y NO en el perfil, que es
-- público (`organization_profiles.is_public`). El dueño escribe y lee lo suyo;
-- el admin solo LEE, porque necesita el dato para transferir pero no tiene por
-- qué modificarlo.
--
-- Queda en texto plano, igual que el resto de la base. Si más adelante se
-- quiere cifrar a nivel de columna, Supabase tiene Vault — pero eso cambia cómo
-- se lee y conviene decidirlo aparte, no de pasada.

CREATE TABLE IF NOT EXISTS organizer_payout_info (
  -- Una fila por organizador: la unidad monetizable es la cuenta.
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  full_name TEXT NOT NULL,
  -- CC / CE para persona natural, NIT si el organizador factura como empresa.
  -- Se incluye el tipo aunque hoy solo se pidan cédulas, para no necesitar otra
  -- migración cuando aparezca el primero que facture con NIT.
  document_type TEXT NOT NULL DEFAULT 'CC'
    CHECK (document_type IN ('CC', 'CE', 'NIT')),
  document_number TEXT NOT NULL,

  bank TEXT NOT NULL,
  account_type TEXT NOT NULL
    CHECK (account_type IN ('ahorros', 'corriente')),
  account_number TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Sin campos en blanco: un dato de pago a medias no sirve para transferir, y
  -- dejarlo pasar haría que el requisito se cumpla con basura.
  CONSTRAINT payout_fields_not_blank CHECK (
    length(btrim(full_name)) > 2
    AND length(btrim(document_number)) > 4
    AND length(btrim(bank)) > 1
    AND length(btrim(account_number)) > 4
  )
);

COMMENT ON TABLE organizer_payout_info IS
  'A dónde transferirle a cada organizador. SENSIBLE (cédula + cuenta): el dueño escribe lo suyo, el admin solo lee. Aparte del perfil, que es público.';

ALTER TABLE organizer_payout_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "El organizador gestiona sus datos de pago" ON organizer_payout_info;
CREATE POLICY "El organizador gestiona sus datos de pago"
  ON organizer_payout_info FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Solo lectura para el admin: necesita el dato para pagar, no para editarlo.
DROP POLICY IF EXISTS "Admin lee datos de pago" ON organizer_payout_info;
CREATE POLICY "Admin lee datos de pago"
  ON organizer_payout_info FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- El requisito, apagado por defecto
-- ============================================================

ALTER TABLE monetization_config
  ADD COLUMN IF NOT EXISTS require_payout_info BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN monetization_config.require_payout_info IS
  'Exigir datos de pago para clasificar. Arranca en false porque la pantalla para llenarlos no existe todavía; prender con un UPDATE cuando la sección "Monetizar" se despliegue.';

-- ============================================================
-- get_monetization_status v2: agrega el requisito de datos de pago
-- ============================================================
-- Igual a la v1 (20260730_monetization_status.sql) más `payout_info_complete` y
-- su clave en `missing`.

CREATE OR REPLACE FUNCTION get_monetization_status(p_month DATE DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_month    date;
  v_from     timestamptz;
  v_to       timestamptz;
  v_cfg      monetization_config;
  result     json;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

  v_month := COALESCE(date_trunc('month', p_month)::date,
                      date_trunc('month', now())::date);
  v_from  := v_month::timestamptz;
  v_to    := (v_month + interval '1 month')::timestamptz;

  SELECT * INTO v_cfg FROM monetization_config WHERE id;

  WITH orgs AS (
    SELECT DISTINCT t.created_by AS user_id
    FROM tournaments t
    WHERE t.created_by IS NOT NULL
      AND (v_is_admin OR t.created_by = auth.uid())
  ),

  en_curso AS (
    SELECT
      t.created_by AS user_id,
      COUNT(*)                     AS tournaments_in_progress,
      COALESCE(MAX(tt.equipos), 0) AS max_teams
    FROM tournaments t
    LEFT JOIN (
      SELECT tournament_id, COUNT(*) AS equipos
      FROM tournament_teams
      GROUP BY tournament_id
    ) tt ON tt.tournament_id = t.id
    WHERE t.status = 'in-progress'
    GROUP BY t.created_by
  ),

  -- Se mira `updated_at` (cuándo se cargó el resultado) y no `date` (cuándo se
  -- jugó, que puede caer en otro mes).
  partidos AS (
    SELECT t.created_by AS user_id, COUNT(*) AS matches_with_result
    FROM matches m
    JOIN tournaments t ON t.id = m.tournament_id
    WHERE m.status = 'completed'
      AND (m.home_score IS NOT NULL OR m.away_score IS NOT NULL
           OR m.walkover IS TRUE)
      AND m.updated_at >= v_from
      AND m.updated_at <  v_to
    GROUP BY t.created_by
  ),

  -- Agrupado por ORGANIZADOR antes de contar, igual que el reparto. Se excluyen
  -- las visitas logueadas para no contar al propio organizador revisando.
  audiencia AS (
    SELECT
      t.created_by AS user_id,
      COUNT(DISTINCT (pv.visitor_id, pv.created_at::date)) AS person_days,
      COUNT(DISTINCT pv.created_at::date)                  AS active_days
    FROM page_views pv
    JOIN tournaments t ON t.id = pv.entity_id
    WHERE pv.entity_type = 'tournament'
      AND pv.visitor_id IS NOT NULL
      AND pv.is_authenticated IS NOT TRUE
      AND pv.created_at >= v_from
      AND pv.created_at <  v_to
    GROUP BY t.created_by
  ),

  base AS (
    SELECT
      o.user_id,
      COALESCE(op.organization_name, u.name) AS organizer_name,
      COALESCE(u.revenue_share_excluded, false) AS excluded,
      EXTRACT(day FROM (now() - u.created_at))::int AS account_age_days,
      (op.organization_name IS NOT NULL AND op.logo_url IS NOT NULL)
        AS profile_complete,
      -- Basta con que exista la fila: los CHECK de la tabla ya garantizan que
      -- ningún campo venga en blanco.
      (pi.user_id IS NOT NULL) AS payout_info_complete,
      COALESCE(ec.tournaments_in_progress, 0) AS tournaments_in_progress,
      COALESCE(ec.max_teams, 0)               AS max_teams,
      COALESCE(pa.matches_with_result, 0)     AS matches_with_result,
      COALESCE(au.person_days, 0)             AS person_days,
      COALESCE(au.active_days, 0)             AS active_days
    FROM orgs o
    JOIN users u                        ON u.id = o.user_id
    LEFT JOIN organization_profiles op  ON op.user_id = o.user_id
    LEFT JOIN organizer_payout_info pi  ON pi.user_id = o.user_id
    LEFT JOIN en_curso ec               ON ec.user_id = o.user_id
    LEFT JOIN partidos pa               ON pa.user_id = o.user_id
    LEFT JOIN audiencia au              ON au.user_id = o.user_id
  ),

  evaluado AS (
    SELECT
      b.*,
      (b.tournaments_in_progress >= v_cfg.min_tournaments_in_progress
        AND b.max_teams >= v_cfg.min_teams) AS lvl1,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN b.matches_with_result < v_cfg.min_matches_with_result
             THEN 'matches_with_result' END,
        CASE WHEN b.person_days < v_cfg.min_person_days
             THEN 'person_days' END,
        CASE WHEN b.active_days < v_cfg.min_active_days
             THEN 'active_days' END,
        CASE WHEN b.account_age_days < v_cfg.min_account_age_days
             THEN 'account_age_days' END,
        CASE WHEN v_cfg.require_profile AND NOT b.profile_complete
             THEN 'profile' END,
        CASE WHEN v_cfg.require_payout_info AND NOT b.payout_info_complete
             THEN 'payout_info' END,
        CASE WHEN b.excluded THEN 'excluded' END
      ], NULL) AS missing
    FROM base b
  ),

  final AS (
    SELECT
      e.user_id AS organizer_id,
      e.organizer_name,
      e.excluded,
      e.person_days,
      e.active_days,
      e.matches_with_result,
      e.max_teams,
      e.tournaments_in_progress,
      e.account_age_days,
      e.profile_complete,
      e.payout_info_complete,
      e.missing,
      CASE
        WHEN e.lvl1 AND cardinality(e.missing) = 0 THEN 2
        WHEN e.lvl1 THEN 1
        ELSE 0
      END AS level,
      (e.lvl1 AND cardinality(e.missing) = 0) AS eligible
    FROM evaluado e
  )

  SELECT json_build_object(
    'month', v_month,
    'config', row_to_json(v_cfg),
    'organizers', (
      SELECT COALESCE(json_agg(row_to_json(f) ORDER BY f.level DESC,
                               f.person_days DESC), '[]'::json)
      FROM final f
    )
  ) INTO result;

  RETURN result;
END;
$$;
