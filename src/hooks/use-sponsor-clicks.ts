"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface SponsorClickEntry {
  target_id: string;
  linkUrl: string | null;
  imageUrl: string | null;
  count: number;
}

export interface SponsorClicksTournament {
  tournament_id: string;
  name: string;
  total: number;
  sponsors: SponsorClickEntry[];
}

/**
 * Clics en patrocinadores agrupados por torneo y por sponsor. Lectura
 * directa de `analytics_events` (la RLS solo deja al admin leer todo).
 * Agregamos en JS — el volumen es bajo y evita otra migración (RPC).
 */
export function useSponsorClicks(days: number = 30) {
  const [data, setData] = useState<SponsorClicksTournament[]>([]);
  const [totalClicks, setTotalClicks] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data: events, error } = await supabase
        .from("analytics_events")
        .select("tournament_id, target_id, metadata")
        .eq("event_type", "sponsor_click")
        .gte("created_at", since)
        .not("tournament_id", "is", null);

      if (cancelled) return;
      if (error || !events) {
        setData([]);
        setTotalClicks(0);
        setIsLoading(false);
        return;
      }

      // Agrupar: torneo → sponsor → conteo.
      const byTournament = new Map<
        string,
        { total: number; sponsors: Map<string, SponsorClickEntry> }
      >();
      for (const e of events) {
        const tId = e.tournament_id as string;
        if (!tId) continue;
        let t = byTournament.get(tId);
        if (!t) {
          t = { total: 0, sponsors: new Map() };
          byTournament.set(tId, t);
        }
        t.total += 1;
        const targetId = (e.target_id as string) ?? "desconocido";
        const linkUrl =
          (e.metadata as { linkUrl?: string } | null)?.linkUrl ?? null;
        const s = t.sponsors.get(targetId);
        if (s) s.count += 1;
        else
          t.sponsors.set(targetId, {
            target_id: targetId,
            linkUrl,
            imageUrl: null,
            count: 1,
          });
      }

      // Resolver nombres de torneo.
      const ids = [...byTournament.keys()];
      const namesById = new Map<string, string>();
      if (ids.length > 0) {
        const { data: ts } = await supabase
          .from("tournaments")
          .select("id, name")
          .in("id", ids);
        for (const t of ts ?? []) namesById.set(t.id as string, t.name as string);
      }
      if (cancelled) return;

      // Resolver logos de los patrocinadores (sponsors es lectura pública).
      const targetIds = [
        ...new Set(
          [...byTournament.values()].flatMap((t) => [...t.sponsors.keys()])
        ),
      ];
      if (targetIds.length > 0) {
        const { data: sp } = await supabase
          .from("sponsors")
          .select("id, image_url")
          .in("id", targetIds);
        const imageById = new Map<string, string>();
        for (const s of sp ?? [])
          imageById.set(s.id as string, s.image_url as string);
        for (const t of byTournament.values()) {
          for (const s of t.sponsors.values())
            s.imageUrl = imageById.get(s.target_id) ?? null;
        }
      }
      if (cancelled) return;

      const result: SponsorClicksTournament[] = ids
        .map((id) => {
          const t = byTournament.get(id)!;
          return {
            tournament_id: id,
            name: namesById.get(id) ?? "(torneo eliminado)",
            total: t.total,
            sponsors: [...t.sponsors.values()].sort((a, b) => b.count - a.count),
          };
        })
        .sort((a, b) => b.total - a.total);

      setData(result);
      setTotalClicks(events.length);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [days]);

  return { data, totalClicks, isLoading };
}
