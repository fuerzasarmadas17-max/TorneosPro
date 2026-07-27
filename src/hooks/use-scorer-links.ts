"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";
import { useTournaments } from "@/context/tournament-context";
import { getBestTier, getOrganizerScorerLinkCap, getTierLabel } from "@/lib/pricing";

/**
 * Fila de `scorer_links` tal como la ve el cliente. La RLS filtra por
 * `created_by = auth.uid()`, así que un select sin filtros devuelve todos los
 * links del organizador logueado — de todos sus torneos.
 */
export interface ScorerLinkRow {
  token: string;
  /** Torneo único, o null si el link cruza varios. Usá `scorerLinkTournamentIds`. */
  tournament_id: string | null;
  tournament_ids: string[] | null;
  match_ids: string[];
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  usage_count: number;
}

/** Activo = ni revocado ni expirado. Ambas cosas liberan sus partidos. */
export function isScorerLinkActive(link: ScorerLinkRow): boolean {
  return (
    !link.revoked_at && new Date(link.expires_at).getTime() > Date.now()
  );
}

/** Torneos que cubre el link, con fallback a la columna vieja. */
export function scorerLinkTournamentIds(link: ScorerLinkRow): string[] {
  if (link.tournament_ids && link.tournament_ids.length > 0) {
    return link.tournament_ids;
  }
  return link.tournament_id ? [link.tournament_id] : [];
}

export type CreateLinkResult =
  | { ok: true; token: string }
  | { ok: false; error: string; takenMatchIds?: string[] };

export type UpdateLinkResult =
  | { ok: true }
  | { ok: false; error: string; takenMatchIds?: string[] };

/**
 * Carga y gestiona los scorer-links del organizador. Es global (no por
 * torneo) porque desde que un link puede cruzar torneos, tanto el cupo como
 * el set de "partidos ya repartidos" son de la cuenta entera.
 */
export function useScorerLinks() {
  const { user } = useAuth();
  const { tournaments } = useTournaments();
  const [links, setLinks] = useState<ScorerLinkRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("scorer_links")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error loading scorer links", error);
    }
    setLinks((data ?? []) as ScorerLinkRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const activeLinks = useMemo(() => links.filter(isScorerLinkActive), [links]);
  const historicalLinks = useMemo(
    () => links.filter((l) => !isScorerLinkActive(l)),
    [links]
  );

  /** Partidos ya cubiertos por un link vigente — se esconden de la selección. */
  const linkedMatchIds = useMemo(() => {
    const set = new Set<string>();
    for (const l of activeLinks) {
      for (const id of l.match_ids) set.add(id);
    }
    return set;
  }, [activeLinks]);

  const createLink = useCallback(
    async (matchIds: string[]): Promise<CreateLinkResult> => {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess.session?.access_token;
      if (!accessToken) {
        return { ok: false, error: "Tu sesión expiró. Recargá la página." };
      }
      try {
        const res = await fetch("/api/scorer/link", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ matchIds }),
        });
        const json = await res.json();
        if (!res.ok) {
          if (json.error === "tier-limit") {
            // El server contó más links activos que el cliente: resincronizamos
            // para que el contador del cupo deje de mentir.
            await reload();
            return {
              ok: false,
              error: `Llegaste al máximo de links activos de tu plan (${json.current}/${json.max ?? "∞"}). Revocá uno para liberar espacio.`,
            };
          }
          if (json.error === "matches-already-linked") {
            // Perdimos una carrera contra otra pestaña: recargamos para que
            // esos partidos desaparezcan de la lista, no solo de la selección.
            await reload();
            return {
              ok: false,
              error:
                "Alguno de esos partidos ya se le repartió a otro anotador. Actualizamos la lista.",
              takenMatchIds: json.matchIds ?? [],
            };
          }
          return { ok: false, error: json.error || "No pudimos crear el link" };
        }
        await reload();
        return { ok: true, token: json.token as string };
      } catch (err) {
        console.error(err);
        return { ok: false, error: "Error inesperado" };
      }
    },
    [reload]
  );

  /**
   * Reemplaza el set de partidos de un link existente. El token no cambia, así
   * que el anotador conserva la URL que ya tiene.
   */
  const updateLinkMatches = useCallback(
    async (token: string, matchIds: string[]): Promise<UpdateLinkResult> => {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess.session?.access_token;
      if (!accessToken) {
        return { ok: false, error: "Tu sesión expiró. Recargá la página." };
      }
      try {
        const res = await fetch(`/api/scorer/link/${token}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ matchIds }),
        });
        const json = await res.json();
        if (!res.ok) {
          await reload();
          if (json.error === "matches-already-linked") {
            return {
              ok: false,
              error:
                "Ese partido ya se le repartió a otro anotador. Actualizamos la lista.",
              takenMatchIds: json.matchIds ?? [],
            };
          }
          return {
            ok: false,
            error: json.error || "No pudimos actualizar el link",
          };
        }
        await reload();
        return { ok: true };
      } catch (err) {
        console.error(err);
        return { ok: false, error: "Error inesperado" };
      }
    },
    [reload]
  );

  const revokeLink = useCallback(
    async (token: string): Promise<boolean> => {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess.session?.access_token;
      if (!accessToken) return false;
      const res = await fetch(`/api/scorer/${token}/revoke`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return false;
      await reload();
      return true;
    },
    [reload]
  );

  // Cupo GLOBAL: lo define el mejor plan entre TODOS los torneos del
  // organizador (incluidos los ya terminados), y se reparte libremente.
  const cap = useMemo(() => {
    const mine = tournaments.filter((t) => t.createdBy === user?.id);
    return getOrganizerScorerLinkCap(mine.map((t) => t.tier));
  }, [tournaments, user?.id]);

  const bestTierLabel = useMemo(() => {
    const mine = tournaments.filter((t) => t.createdBy === user?.id);
    return getTierLabel(getBestTier(mine.map((t) => t.tier)));
  }, [tournaments, user?.id]);

  const atCap = cap !== Number.POSITIVE_INFINITY && activeLinks.length >= cap;
  const capLabel = cap === Number.POSITIVE_INFINITY ? "∞" : String(cap);

  return {
    links,
    activeLinks,
    historicalLinks,
    linkedMatchIds,
    loading,
    reload,
    createLink,
    updateLinkMatches,
    revokeLink,
    cap,
    capLabel,
    atCap,
    bestTierLabel,
  };
}
