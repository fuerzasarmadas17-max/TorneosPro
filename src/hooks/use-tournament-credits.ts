"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";

/**
 * Saldo de créditos de torneo del usuario logueado.
 *
 * Lee de la RPC `available_tournament_credits`, que es donde vive el criterio
 * de "usable" (no consumido, no vencido, y que cubra el tamaño del torneo). Va
 * por RPC y no por un `select` para que ese criterio no quede duplicado entre
 * la franja de arriba, el diálogo de pago y el consumo — si se separan, tarde o
 * temprano la pantalla dice que hay un crédito que la función después rechaza.
 *
 * `teamCount` acota a los créditos que cubren un torneo de ese tamaño. Sin él,
 * cuenta todos los disponibles.
 */
export interface TournamentCreditBalance {
  total: number;
  /** Vencimiento del más próximo. Null si no hay créditos. */
  nextExpiry: string | null;
  /** El techo de equipos más alto entre los disponibles. */
  maxTeams: number;
}

export function useTournamentCredits(teamCount = 1) {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id;

  const [balance, setBalance] = useState<TournamentCreditBalance | null>(null);
  /** Para qué consulta corresponde el saldo que hay en memoria. */
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  /** Se incrementa para forzar una relectura sin cambiar los filtros. */
  const [nonce, setNonce] = useState(0);

  const key = `${userId ?? ""}:${teamCount}:${nonce}`;

  useEffect(() => {
    if (authLoading || !userId) return;
    let active = true;

    supabase
      .rpc("available_tournament_credits", {
        p_user_id: userId,
        p_team_count: teamCount,
      })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          // Falla en silencio a propósito: la franja de créditos no puede
          // romper la pantalla de crear torneo. Sin saldo, el organizador paga
          // como siempre — que es justo lo que pasaba antes de que existiera.
          console.error("No se pudo leer el saldo de créditos", error);
          setBalance(null);
          setLoadedKey(key);
          return;
        }
        const row = Array.isArray(data) ? data[0] : data;
        setBalance(
          row
            ? {
                total: Number(row.total) || 0,
                nextExpiry: (row.next_expiry as string | null) ?? null,
                maxTeams: Number(row.max_teams) || 0,
              }
            : null
        );
        setLoadedKey(key);
      });

    return () => {
      active = false;
    };
  }, [authLoading, userId, teamCount, key]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  // Derivado y no un `useState`: "está cargando" es exactamente "lo que hay en
  // memoria no corresponde a la consulta actual". Sin sesión no hay nada que
  // esperar.
  const loading = authLoading || (!!userId && loadedKey !== key);

  return { balance, loading, refetch };
}
