"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface OrganizerRef {
  name: string;
  slug?: string;
}

/**
 * Trae el organizador de una lista de torneos en UNA sola consulta.
 *
 * Antes cada `TournamentCard` disparaba la suya en un `useEffect` propio:
 * con seis tarjetas eran seis viajes a la base, y con las doce de la
 * portada nueva, doce. Es la diferencia entre una grilla que entra de una y
 * una que va apareciendo de a pedazos.
 *
 * Devuelve un mapa `userId → organizador`. La tarjeta no muestra nada
 * mientras no llegue, igual que antes.
 */
export function useOrganizers(
  createdByIds: (string | undefined)[]
): Map<string, OrganizerRef> {
  const [organizers, setOrganizers] = useState<Map<string, OrganizerRef>>(
    new Map()
  );

  // Clave estable: sin esto el array nuevo de cada render volvería a
  // disparar el efecto en bucle.
  const ids = useMemo(
    () => [...new Set(createdByIds.filter((id): id is string => !!id))].sort(),
    [createdByIds]
  );
  const key = ids.join(",");

  useEffect(() => {
    if (ids.length === 0) return;
    let cancelled = false;

    // Se consulta `organization_profiles` directo y no `users`: esa tabla
    // tiene RLS que bloquea leer otros usuarios y devuelve 406.
    supabase
      .from("organization_profiles")
      .select("user_id, organization_name, slug")
      .in("user_id", ids)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setOrganizers(
          new Map(
            data.map((row) => [
              row.user_id as string,
              {
                name: row.organization_name as string,
                slug: (row.slug as string) ?? undefined,
              },
            ])
          )
        );
      });

    return () => {
      cancelled = true;
    };
    // `key` resume `ids`: se re-consulta solo si cambió el conjunto de ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return organizers;
}
