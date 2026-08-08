"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { authHeader } from "@/lib/auth-header";
import { useAuth } from "@/context/auth-context";
import {
  currentPeriodMonth,
  EMPTY_AUDIENCE,
  MonetizationRow,
  MonetizationStatus,
  MyAudienceSummary,
  MySettlement,
} from "@/lib/ad-analytics";

/**
 * Todo lo que la sección "Monetizar" del organizador necesita.
 *
 * Junta tres cosas que se leen a la vez pero significan cosas distintas:
 *
 *  - `audience`    cuánta gente vio cada aviso este mes. SIN plata: durante el
 *                  mes el monto se movería con la audiencia de los demás, y un
 *                  número en pesos se lee como promesa aunque diga "estimado".
 *  - `status`      qué le falta para clasificar. Sale de
 *                  `get_monetization_status`, la MISMA función que usa el panel
 *                  de admin: dos cuentas separadas de "quién clasifica"
 *                  terminarían discrepando, y con plata de por medio esa
 *                  discusión no termina bien.
 *  - `settlements` los cortes ya cerrados. Congelados: el número que vio el día
 *                  del cierre es el que sigue viendo, salga lo que salga de
 *                  recalcular hoy.
 *
 * La proyección y los cortes vienen de `/api/monetizar/earnings` y no de una
 * consulta directa, porque calcularlos exige datos que el organizador no debe
 * ver (la audiencia total de cada campaña y lo que pagó el anunciante). Los
 * requisitos sí van directo: esa RPC ya está hecha para que él la llame.
 */
export interface MyAdEarningsResult {
  audience: MyAudienceSummary;
  settlements: MySettlement[];
  /** Nombre del anunciante por id de campaña, para el histórico. */
  campaignNames: Record<string, string>;
  /** La fila de requisitos del organizador. `null` = no se pudo saber. */
  status: MonetizationRow | null;
  config: MonetizationStatus["config"] | null;
  loading: boolean;
  /** Mensaje de error de la proyección, o `null`. Se distingue de "no aportó
   *  audiencia", que es un resultado válido y vacío. */
  error: string | null;
  refetch: () => void;
}

// El mes en curso lo define `currentPeriodMonth` (lib/ad-analytics), que usa el
// calendario colombiano y no el del dispositivo. Se re-exporta para que la
// pantalla no tenga que conocer dos módulos.
export { currentPeriodMonth };

export function useMyAdEarnings(periodMonth?: string): MyAdEarningsResult {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id;
  const month = periodMonth ?? currentPeriodMonth();

  const [audience, setAudience] = useState<MyAudienceSummary>(EMPTY_AUDIENCE);
  const [settlements, setSettlements] = useState<MySettlement[]>([]);
  const [campaignNames, setCampaignNames] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<MonetizationRow | null>(null);
  const [config, setConfig] = useState<MonetizationStatus["config"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const key = `${userId ?? ""}:${month}:${nonce}`;

  useEffect(() => {
    if (authLoading || !userId) return;
    let active = true;

    (async () => {
      const [earnings, monRes] = await Promise.all([
        (async () => {
          try {
            const res = await fetch(
              `/api/monetizar/earnings?month=${encodeURIComponent(month)}`,
              { headers: await authHeader() }
            );
            const body = await res.json();
            if (!res.ok) throw new Error(body?.error || "Error del servidor");
            return body as {
              audience: MyAudienceSummary;
              settlements: MySettlement[];
              campaignNames: Record<string, string>;
            };
          } catch (e) {
            console.error("No se pudo leer el reparto", e);
            return e instanceof Error ? e : new Error("Error desconocido");
          }
        })(),
        supabase.rpc("get_monetization_status", { p_month: month }),
      ]);

      if (!active) return;

      if (earnings instanceof Error) {
        setError(earnings.message);
        setAudience(EMPTY_AUDIENCE);
        setSettlements([]);
        setCampaignNames({});
      } else {
        setError(null);
        setAudience(earnings.audience);
        setSettlements(earnings.settlements);
        setCampaignNames(earnings.campaignNames ?? {});
      }

      if (monRes.error) {
        // No se cae a un fallback permisivo como el panel de admin: allá el
        // permisivo evita que un fallo de red deje el reparto en cero; acá
        // mostraría "clasificás" a alguien que quizá no. Quien lo pinte tiene
        // que tratar `null` como "no sé", no como "sí".
        console.error("get_monetization_status falló", monRes.error);
        setStatus(null);
        setConfig(null);
      } else {
        const data = monRes.data as MonetizationStatus | null;
        setConfig(data?.config ?? null);
        setStatus(
          data?.organizers?.find((o) => o.organizer_id === userId) ?? null
        );
      }

      setLoadedKey(key);
    })();

    return () => {
      active = false;
    };
  }, [authLoading, userId, month, key]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return {
    audience,
    settlements,
    campaignNames,
    status,
    config,
    loading: authLoading || (!!userId && loadedKey !== key),
    error,
    refetch,
  };
}
