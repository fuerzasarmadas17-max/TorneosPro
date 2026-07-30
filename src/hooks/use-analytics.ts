"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface ViewsByDay {
  date: string;
  views: number;
  unique_visitors: number;
  unique_persons: number;
}

interface ReferrerEntry {
  referrer: string;
  count: number;
}

interface DeviceEntry {
  device_type: string;
  count: number;
}

interface BrowserEntry {
  browser: string;
  count: number;
}

export interface EntityAnalytics {
  total_views: number;
  unique_visitors: number;
  unique_persons: number;
  avg_duration_ms: number;
  new_visitors: number;
  returning_visitors: number;
  views_by_day: ViewsByDay[];
  top_referrers: ReferrerEntry[];
  direct_views: number;
  device_breakdown: DeviceEntry[];
  browser_breakdown: BrowserEntry[];
}

export interface PeriodTotals {
  total_views: number;
  unique_visitors: number;
  unique_persons: number;
  avg_duration_ms: number;
}

export interface OrganizerAnalytics {
  total_views: number;
  unique_visitors: number;
  unique_persons: number;
  avg_duration_ms: number;
  views_by_day: ViewsByDay[];
  previous?: PeriodTotals;
}

interface TournamentViewEntry {
  tournament_id: string;
  views: number;
  unique_visitors: number;
  unique_persons: number;
}

export function useEntityAnalytics(
  entityType: string | null,
  entityId: string | null | undefined,
  days: number = 30
) {
  const [data, setData] = useState<EntityAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!entityType || !entityId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    supabase
      .rpc("get_entity_analytics", {
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_days: days,
      })
      .then(({ data: result, error }) => {
        if (!error && result) {
          setData(result as EntityAnalytics);
        }
        setIsLoading(false);
      });
  }, [entityType, entityId, days]);

  return { data, isLoading };
}

/**
 * Analytics AGREGADAS del organizador: suma su perfil público + todos sus
 * torneos, deduplicando personas/sesiones entre entidades. Es el resumen del
 * dashboard. El scope lo pone el RPC vía auth.uid(), no hace falta pasar el id.
 */
export function useOrganizerAnalytics(
  enabled: boolean,
  days: number = 30
) {
  const [data, setData] = useState<OrganizerAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    supabase
      .rpc("get_organizer_analytics", { p_days: days })
      .then(({ data: result, error }) => {
        if (!error && result) {
          setData(result as OrganizerAnalytics);
        }
        setIsLoading(false);
      });
  }, [enabled, days]);

  return { data, isLoading };
}

export function useOrganizerTournamentViews(
  userId: string | null | undefined,
  days: number = 30
) {
  const [data, setData] = useState<TournamentViewEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    supabase
      .rpc("get_organizer_tournament_views", {
        p_user_id: userId,
        p_days: days,
      })
      .then(({ data: result, error }) => {
        if (!error && result) {
          setData(result as TournamentViewEntry[]);
        }
        setIsLoading(false);
      });
  }, [userId, days]);

  return { data, isLoading };
}

/**
 * Personas-día del período: pares (persona, día) distintos.
 *
 * Sale de sumar las personas únicas de cada día, y no es una aproximación:
 * contar pares (persona, día) distintos es exactamente lo mismo que, para cada
 * día, contar personas distintas y sumar. Por eso no hace falta un
 * COUNT(DISTINCT) nuevo en la base — la serie diaria ya llega al cliente para
 * las sparklines.
 *
 * Es la unidad con la que se le paga al organizador por publicidad. La de
 * publicidad es un SUBCONJUNTO de esta: solo las que vieron un aviso.
 */
export function personDaysOf(viewsByDay?: ViewsByDay[]): number {
  return (viewsByDay ?? []).reduce((a, d) => a + (d.unique_persons ?? 0), 0);
}
