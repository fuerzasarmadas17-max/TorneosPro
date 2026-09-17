-- ============================================================================
-- ¿Quién clasifica para monetizar? Umbrales configurables + RPC
-- ----------------------------------------------------------------------------
-- Hasta ahora la elegibilidad del reparto solo miraba `revenue_share_excluded`.
-- Los requisitos estaban definidos (ver el Paso 3 de
-- Por hacer/monetizacion-analitica-publicidad.md) pero no se evaluaban.
--
-- Esto los evalúa. Reemplaza la consulta manual
-- `Por hacer/consultas/organizadores-vs-requisitos.sql` por algo que la app
-- puede llamar sola.
--
-- LOS UMBRALES VAN EN UNA TABLA, NO EN LA FUNCIÓN
-- Los números de arranque se pusieron sin mirar datos y la primera medición
-- (2026-07-29) no fue concluyente: la ventana estaba truncada. Se recalibran en
-- septiembre con agosto completo. Que vivan en una tabla significa moverlos con
-- un UPDATE en vez de con un despliegue.
--
-- LA AUDIENCIA SALE DE `page_views`, NO DE LAS IMPRESIONES
-- Las impresiones dependen de que el admin le haya asignado una campaña al
-- torneo. Un organizador con audiencia real pero sin campaña marcaría cero y
-- nunca podría clasificar: la puerta dependería de una decisión del admin y no
-- de su mérito. Para el PAGO sí se usan impresiones — son cosas distintas.

-- ============================================================
-- 1. Umbrales
-- ============================================================

CREATE TABLE IF NOT EXISTS monetization_config (
  -- Fila única: el CHECK sobre un boolean PRIMARY KEY impide que haya más de
  -- una. Sin esto habría que adivinar cuál config es la vigente.
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),

  -- ---- Nivel 1: ve la sección y su progreso ----
  min_tournaments_in_progress INT NOT NULL DEFAULT 1,
  min_teams INT NOT NULL DEFAULT 6,

  -- ---- Nivel 2: liquida ----
  min_person_days INT NOT NULL DEFAULT 300,
  min_active_days INT NOT NULL DEFAULT 8,
  min_matches_with_result INT NOT NULL DEFAULT 10,
  min_account_age_days INT NOT NULL DEFAULT 30,
  require_profile BOOLEAN NOT NULL DEFAULT true,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO monetization_config (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE monetization_config IS
  'Umbrales para clasificar a "Monetizar". Fila única. Sin calibrar todavía: los números de arranque se pusieron sin datos y se recalibran en septiembre 2026 con agosto completo.';

ALTER TABLE monetization_config ENABLE ROW LEVEL SECURITY;

-- Solo admin escribe. El organizador NO lee esta tabla directo: los umbrales le
-- llegan dentro de la respuesta de la RPC, que es SECURITY DEFINER.
DROP POLICY IF EXISTS "Admin gestiona monetization_config" ON monetization_config;
CREATE POLICY "Admin gestiona monetization_config"
  ON monetization_config FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- 2. La RPC
-- ============================================================
-- Sirve a los dos lados: el admin recibe todos los organizadores, cualquier
-- otro recibe solo el suyo. Así el panel de admin y la futura sección
-- "Monetizar" del organizador usan la misma cuenta, y no hay dos versiones de
-- "quién clasifica" que puedan discrepar.
--
-- Devuelve `config` además de las filas, para que el cliente pueda mostrar
-- "160 / 300" sin tener los umbrales cableados.
--
-- NIVELES
--   0 = ni ve la sección
--   1 = la ve y ve su progreso, pero no liquida
--   2 = liquidable
--
-- `missing` trae las claves de lo que falta para el nivel 2, para que el cliente
-- arme el mensaje. Un organizador excluido nunca es elegible.

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

  -- Por defecto el mes en curso. El corte real se hace sobre un mes terminado,
  -- pero el organizador necesita ver su progreso mientras el mes corre.
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

  -- Nivel 1: torneos en curso y el más grande de ellos. El estado lo pone el
  -- organizador a mano, así que por sí solo no prueba nada — de ahí que el
  -- nivel 2 exija partidos con resultado.
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

  -- Prueba de que el torneo se está OPERANDO, no solo que existe. Se mira
  -- `updated_at` (cuándo se cargó el resultado) y no `date` (cuándo se jugó,
  -- que puede caer en otro mes).
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

  -- Se agrupa por ORGANIZADOR antes de contar, igual que el reparto: quien el
  -- mismo día ve dos torneos del mismo organizador aporta 1. Si acá se contara
  -- por torneo y se sumara, la puerta sería más laxa que el pago.
  --
  -- `is_authenticated IS NOT TRUE` excluye al propio organizador revisando su
  -- torneo, que si no sumaría ~30 personas-día a su propio umbral. NULL son
  -- visitas anteriores a la migración 20260729d y se dejan pasar.
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
      COALESCE(ec.tournaments_in_progress, 0) AS tournaments_in_progress,
      COALESCE(ec.max_teams, 0)               AS max_teams,
      COALESCE(pa.matches_with_result, 0)     AS matches_with_result,
      COALESCE(au.person_days, 0)             AS person_days,
      COALESCE(au.active_days, 0)             AS active_days
    FROM orgs o
    JOIN users u                       ON u.id = o.user_id
    LEFT JOIN organization_profiles op ON op.user_id = o.user_id
    LEFT JOIN en_curso ec              ON ec.user_id = o.user_id
    LEFT JOIN partidos pa              ON pa.user_id = o.user_id
    LEFT JOIN audiencia au             ON au.user_id = o.user_id
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

COMMENT ON FUNCTION get_monetization_status(DATE) IS
  'Quién clasifica para monetizar, por mes. Admin ve todos, un organizador ve solo el suyo. La audiencia sale de page_views (no de impresiones) para que la puerta no dependa de que el admin le asigne campaña. Devuelve los umbrales vigentes junto a las filas.';

GRANT EXECUTE ON FUNCTION get_monetization_status(DATE) TO authenticated;
