"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface ViewsByDay {
  date: string;
  views: number;
  unique_visitors: number;
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
  avg_duration_ms: number;
  views_by_day: ViewsByDay[];
  top_referrers: ReferrerEntry[];
  device_breakdown: DeviceEntry[];
  browser_breakdown: BrowserEntry[];
}

interface TournamentViewEntry {
  tournament_id: string;
  views: number;
  unique_visitors: number;
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
