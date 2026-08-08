-- ============================================================================
-- Aprobación del organizador antes de poder cobrar
-- ----------------------------------------------------------------------------
-- Cambia el modelo de quién cobra, y el cambio es a propósito.
--
-- ANTES: lista negra. Cobraba todo el que cumpliera los umbrales, salvo el que
-- estuviera marcado a mano en `users.revenue_share_excluded` (hoy, la cuenta de
-- la propia plataforma). Un organizador nuevo entraba a cobrar sin que nadie
-- hiciera nada.
--
-- AHORA: lista blanca. Nadie cobra hasta que un admin lo apruebe. Es la decisión
-- correcta cuando hay plata de por medio: el que se equivoca por omisión no
-- puede ser el que paga. Y es el lugar exacto donde después se engancha el KYC
-- —pedir cédula, verificar identidad— sin rediseñar nada.
--
-- ⚠️ EFECTO INMEDIATO AL CORRER ESTO
-- Todos los organizadores pasan a NO clasificar, con el motivo "falta aprobar
-- tus datos de pago". Es lo esperado, no un bug. Hay que aprobarlos uno por uno
-- (por ahora con el UPDATE del final; el botón en el panel viene después).
--
-- `users.revenue_share_excluded` se queda como está y sigue significando otra
-- cosa: exclusión permanente por política (cuentas de prueba, demos, socios).
-- "Todavía no aprobado" y "no participa nunca" son estados distintos y tienen
-- que poder distinguirse — al primero se le dice qué falta, al segundo no.

ALTER TABLE organizer_payout_info
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

COMMENT ON COLUMN organizer_payout_info.approval_status IS
  'pending (recién inscrito) / approved (puede cobrar) / rejected (con motivo). Solo lo mueve un admin: el trigger bloquea que el dueño se apruebe a sí mismo. Cambiar los datos bancarios después de aprobado vuelve a pending.';
COMMENT ON COLUMN organizer_payout_info.rejection_reason IS
  'Qué tiene que corregir. Se le muestra al organizador: un rechazo sin motivo es un callejón sin salida.';

-- ============================================================
-- 1. El dueño no se puede aprobar solo
-- ============================================================
-- La policy de la tabla es FOR ALL con `user_id = auth.uid()`, o sea que el
-- organizador puede hacer UPDATE de SU fila. Sin esta guarda, podría mandar
-- `approval_status = 'approved'` desde el navegador y aprobarse a sí mismo. RLS
-- no sabe restringir por columna, así que la restricción tiene que vivir acá.
--
-- Reemplaza a `stamp_terms_acceptance` (20260808b) conservando lo que hacía: es
-- el mismo trigger, ahora con dos trabajos. Se unifica en vez de agregar un
-- segundo trigger para que el orden de ejecución no sea algo en qué pensar.

CREATE OR REPLACE FUNCTION stamp_terms_acceptance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_privileged boolean;
BEGIN
  -- `auth.role() IS NULL` significa que no hay JWT: es una conexión directa a
  -- la base (el editor SQL de Supabase, psql, un backfill). Sin esa condición,
  -- un UPDATE corrido desde el editor se revertiría EN SILENCIO —el trigger lo
  -- trataría como si fuera el dueño— y el admin creería haber aprobado a
  -- alguien que sigue pendiente. No relaja nada: quien está conectado directo a
  -- la base ya puede hacer lo que quiera. Ojo que `anon` NO cae acá: sus
  -- peticiones sí traen JWT, con role = 'anon'.
  v_privileged := auth.role() IS NULL
    OR auth.role() = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin');

  -- ---- Aceptación de términos: la fecha la pone la base ----
  IF NEW.terms_version IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.terms_version IS DISTINCT FROM OLD.terms_version)
  THEN
    NEW.terms_accepted_at := now();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.terms_accepted_at := OLD.terms_accepted_at;
  END IF;

  -- ---- Aprobación: solo un admin la mueve ----
  IF TG_OP = 'INSERT' THEN
    IF NOT v_privileged THEN
      -- Todo el que se inscribe entra en revisión, mande lo que mande.
      NEW.approval_status  := 'pending';
      NEW.approved_at      := NULL;
      NEW.approved_by      := NULL;
      NEW.rejection_reason := NULL;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();

    IF v_privileged THEN
      -- Sella cuándo y quién, para no depender de que el panel lo mande bien.
      IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
        NEW.approved_at := CASE WHEN NEW.approval_status = 'approved'
                                THEN now() ELSE NULL END;
        NEW.approved_by := auth.uid();
      END IF;
    ELSE
      -- El dueño no toca ninguno de los cuatro campos.
      NEW.approval_status  := OLD.approval_status;
      NEW.approved_at      := OLD.approved_at;
      NEW.approved_by      := OLD.approved_by;
      NEW.rejection_reason := OLD.rejection_reason;

      -- Y si cambió a dónde le transferimos, la aprobación anterior deja de
      -- valer: lo aprobado era ESA cuenta, no la cuenta nueva. Sin esto,
      -- aprobar una vez sería aprobar cualquier cuenta futura, que es
      -- exactamente lo que un KYC no puede permitir.
      IF OLD.approval_status = 'approved'
         AND (NEW.full_name       IS DISTINCT FROM OLD.full_name
           OR NEW.document_type   IS DISTINCT FROM OLD.document_type
           OR NEW.document_number IS DISTINCT FROM OLD.document_number
           OR NEW.bank            IS DISTINCT FROM OLD.bank
           OR NEW.account_type    IS DISTINCT FROM OLD.account_type
           OR NEW.account_number  IS DISTINCT FROM OLD.account_number)
      THEN
        NEW.approval_status := 'pending';
        NEW.approved_at     := NULL;
        NEW.approved_by     := NULL;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- El admin necesita poder escribir la aprobación; hasta hoy solo tenía lectura.
DROP POLICY IF EXISTS "Admin aprueba datos de pago" ON organizer_payout_info;
CREATE POLICY "Admin aprueba datos de pago"
  ON organizer_payout_info FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- 2. get_monetization_status v3: la aprobación entra a la elegibilidad
-- ============================================================
-- Igual a la v2 (20260730b) más `payout_approved` y su clave en `missing`.
--
-- ⚠️ La aprobación NO se condiciona a `require_payout_info`. Ese interruptor
-- existía para poder exigir los datos recién cuando hubiera pantalla para
-- llenarlos; la aprobación es la puerta del dinero y no admite un modo "apagado"
-- sin volver al modelo de lista negra. `require_payout_info` queda de hecho
-- redundante: sin fila de datos no hay aprobación posible.

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
      (pi.user_id IS NOT NULL) AS payout_info_complete,
      (pi.approval_status = 'approved') AS payout_approved,
      COALESCE(pi.approval_status, 'missing') AS payout_status,
      pi.rejection_reason,
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
        -- Excluyentes entre sí: sin fila es "faltan los datos", con fila sin
        -- aprobar es "están en revisión". Emitir las dos sería decirle dos veces
        -- lo mismo con distinta cara.
        CASE WHEN NOT b.payout_info_complete
             THEN 'payout_info' END,
        CASE WHEN b.payout_info_complete AND NOT b.payout_approved
             THEN 'payout_approval' END,
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
      e.payout_approved,
      e.payout_status,
      e.rejection_reason,
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

GRANT EXECUTE ON FUNCTION get_monetization_status(DATE) TO authenticated;

-- ============================================================
-- Aprobar a mano, mientras no exista el botón
-- ============================================================
-- Ver quién está esperando:
--
--   select u.email, p.full_name, p.bank, p.account_number, p.approval_status
--   from organizer_payout_info p
--   join users u on u.id = p.user_id
--   where p.approval_status = 'pending';
--
-- Aprobar (desde el editor SQL funciona: no hay JWT, así que cuenta como
-- conexión privilegiada):
--
--   update organizer_payout_info set approval_status = 'approved'
--   where user_id = (select id from users where email = 'correo@ejemplo.com');
--
-- Rechazar con motivo:
--
--   update organizer_payout_info
--   set approval_status = 'rejected',
--       rejection_reason = 'El nombre no coincide con el titular de la cuenta'
--   where user_id = (select id from users where email = 'correo@ejemplo.com');
