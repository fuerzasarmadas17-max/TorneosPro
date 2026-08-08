import type { MonetizationConfig, MonetizationRow } from "@/lib/ad-analytics";

/**
 * Los requisitos del mes, en forma de lista mostrable.
 *
 * Vive fuera de los componentes porque lo usan dos: la barra grande de "cómo vas
 * este mes" y el detalle de abajo. Si cada uno armara su lista, tarde o temprano
 * la barra diría 80% mientras el detalle muestra un requisito que la barra no
 * está mirando.
 */
export interface Requirement {
  label: string;
  current: number;
  target: number;
  /** Requisitos de sí/no (perfil, datos de pago) en vez de una cuenta. */
  boolean?: boolean;
}

export function buildRequirements(
  row: MonetizationRow,
  config: MonetizationConfig
): Requirement[] {
  const list: Requirement[] = [
    {
      // "Entraron", no "vieron un aviso". Este requisito se mide sobre las
      // VISITAS a los torneos, no sobre las impresiones de publicidad, así que
      // da un número distinto del que muestra la tabla de campañas. Si las dos
      // etiquetas dijeran lo mismo, el organizador compararía dos cifras que no
      // son comparables y concluiría que una está mal.
      label: "Personas que entraron a tus torneos",
      current: row.person_days,
      target: config.min_person_days,
    },
    {
      label: "Días con audiencia",
      current: row.active_days,
      target: config.min_active_days,
    },
    {
      label: "Partidos con resultado cargado",
      current: row.matches_with_result,
      target: config.min_matches_with_result,
    },
    {
      label: "Equipos en tu torneo más grande",
      current: row.max_teams,
      target: config.min_teams,
    },
    {
      label: "Torneos en curso",
      current: row.tournaments_in_progress,
      target: config.min_tournaments_in_progress,
    },
    {
      label: "Días desde que creaste la cuenta",
      current: row.account_age_days,
      target: config.min_account_age_days,
    },
  ];

  if (config.require_profile) {
    list.push({
      label: "Perfil con nombre y logo",
      current: row.profile_complete ? 1 : 0,
      target: 1,
      boolean: true,
    });
  }
  if (config.require_payout_info) {
    list.push({
      label: "Datos para transferirte",
      current: row.payout_info_complete ? 1 : 0,
      target: 1,
      boolean: true,
    });
  }

  // Un requisito con umbral en cero no es un requisito: mostrarlo como "0 / 0 ✓"
  // es ruido que hace parecer la puerta más alta de lo que es.
  return list.filter((r) => r.target > 0);
}

export function requirementPct(r: Requirement): number {
  if (r.target <= 0) return 100;
  return Math.min(100, Math.round((r.current / r.target) * 100));
}

/**
 * Cómo va el mes, en un solo número.
 *
 * Es el MÍNIMO de los requisitos, no el promedio. Clasificar exige cumplirlos
 * todos, así que lo que falta es siempre el que va más atrás: un promedio diría
 * "vas al 85%" con un requisito en cero, y el organizador llegaría a fin de mes
 * creyendo que estaba a punto cuando no lo estaba ni cerca.
 *
 * `blocking` es ese requisito — el que hay que nombrar para que el número sea
 * accionable en vez de un veredicto.
 */
export function monthProgress(requirements: Requirement[]): {
  pct: number;
  met: boolean;
  blocking: Requirement | null;
} {
  if (requirements.length === 0) {
    return { pct: 100, met: true, blocking: null };
  }

  let worst = requirements[0];
  let worstPct = requirementPct(worst);
  for (const r of requirements.slice(1)) {
    const pct = requirementPct(r);
    if (pct < worstPct) {
      worst = r;
      worstPct = pct;
    }
  }

  return {
    pct: worstPct,
    met: worstPct >= 100,
    blocking: worstPct >= 100 ? null : worst,
  };
}
