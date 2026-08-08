"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";
import { MONETIZAR_TERMS_VERSION } from "@/lib/monetizar-terms";

/**
 * Los datos de pago del organizador y si aceptó los términos vigentes.
 *
 * Va directo a la tabla y no por una ruta de servidor porque `RLS` ya acota a
 * lo propio (`user_id = auth.uid()`), y son sus propios datos: acá no hay nada
 * que filtrar como en el reparto.
 */
export interface PayoutInfo {
  full_name: string;
  document_type: "CC" | "CE" | "NIT";
  document_number: string;
  bank: string;
  account_type: "ahorros" | "corriente";
  account_number: string;
  terms_version: string | null;
  terms_accepted_at: string | null;
}

export interface PayoutInfoResult {
  info: PayoutInfo | null;
  /** Tiene datos de pago Y aceptó la versión vigente de los términos. Es lo que
   *  decide si ve la sección o el formulario de entrada. */
  onboarded: boolean;
  /** Ya estaba adentro pero los términos cambiaron: hay que pedirle que acepte
   *  de nuevo, sin volver a pedirle los datos que ya dio. */
  needsReaccept: boolean;
  loading: boolean;
  refetch: () => void;
}

export function usePayoutInfo(): PayoutInfoResult {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id;

  const [info, setInfo] = useState<PayoutInfo | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const key = `${userId ?? ""}:${nonce}`;

  useEffect(() => {
    if (authLoading || !userId) return;
    let active = true;

    supabase
      .from("organizer_payout_info")
      .select(
        "full_name, document_type, document_number, bank, account_type, account_number, terms_version, terms_accepted_at"
      )
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("No se pudieron leer los datos de pago", error);
          setInfo(null);
        } else {
          setInfo((data as PayoutInfo | null) ?? null);
        }
        setLoadedKey(key);
      });

    return () => {
      active = false;
    };
  }, [authLoading, userId, key]);

  const hasInfo = !!info;
  const acceptedCurrent = info?.terms_version === MONETIZAR_TERMS_VERSION;

  return {
    info,
    onboarded: hasInfo && acceptedCurrent,
    needsReaccept: hasInfo && !acceptedCurrent,
    loading: authLoading || (!!userId && loadedKey !== key),
    refetch: useCallback(() => setNonce((n) => n + 1), []),
  };
}
