"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PeriodTotals } from "@/hooks/use-analytics";

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

interface PageTypeEntry {
  page_type: string;
  count: number;
}

interface TopPageEntry {
  page_path: string;
  count: number;
}

export interface GlobalAnalytics {
  total_views: number;
  unique_visitors: number;
  unique_persons: number;
  avg_duration_ms: number;
  views_by_day: ViewsByDay[];
  top_referrers: ReferrerEntry[];
  device_breakdown: DeviceEntry[];
  browser_breakdown: BrowserEntry[];
  views_by_page_type: PageTypeEntry[];
  top_pages: TopPageEntry[];
  previous?: PeriodTotals;
}

interface TournamentEntry {
  tournament_id: string;
  name: string;
  views: number;
  unique_visitors: number;
}

export interface OrganizerSummary {
  user_id: string;
  organization_name: string;
  profile_views: number;
  profile_unique: number;
  tournaments: TournamentEntry[];
}

export function useAdminAnalytics(days: number = 30) {
  const [data, setData] = useState<GlobalAnalytics | null>(null);
  const [organizers, setOrganizers] = useState<OrganizerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      supabase.rpc("get_global_analytics", { p_days: days }),
      supabase.rpc("get_admin_organizer_summary", { p_days: days }),
    ]).then(([globalRes, orgRes]) => {
      if (!globalRes.error && globalRes.data) {
        setData(globalRes.data as GlobalAnalytics);
      }
      if (!orgRes.error && orgRes.data) {
        setOrganizers(orgRes.data as OrganizerSummary[]);
      }
      setIsLoading(false);
    });
  }, [days]);

  return { data, organizers, isLoading };
}
