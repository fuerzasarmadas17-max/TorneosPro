"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";
import { useTournaments } from "@/context/tournament-context";
import { collectVenues, isInVenue } from "@/lib/venues";
import {
  findVenueSuggestions,
  venuePairKey,
  type VenueSuggestion,
} from "@/lib/venue-suggestions";

/**
 * Las canchas del organizador que parecen la misma, listas para preguntarle.
 *
 * Se calcula ENTERO en el navegador. Los torneos con sus partidos ya están
 * cargados para dibujar el calendario, y cada partido trae su cancha adentro:
 * comparar esa lista consigo misma son unas pocas decenas de comparaciones de
 * dos palabras. No hay consulta que correr ni nada que mantener al día.
 *
 * Lo único que viaja a la base son los "no, son distintas". Esa respuesta tiene
 * que sobrevivir al teléfono: si viviera en el navegador, el mismo organizador
 * entrando desde la computadora se comería la pregunta otra vez.
 */
export type MergeResult =
  | { ok: false }
  | {
      ok: true;
      /** Cuántos partidos cambiaron de nombre. */
      changed: number;
      /** El nombre que quedó. */
      keptLabel: string;
      /** Devuelve esos mismos partidos a su nombre anterior. */
      undo: () => Promise<boolean>;
    };

/** Set vacío estable: evita recalcular las sugerencias en cada render mientras
 *  los descartes todavía no llegaron. */
const SIN_DESCARTES: ReadonlySet<string> = new Set();

export function useVenueSuggestions() {
  const { user } = useAuth();
  const userId = user?.id;
  const { tournaments, setMatchesVenue } = useTournaments();
  const [dismissed, setDismissed] = useState<Set<string> | null>(null);

  // Sin sesión no hay descartes que esperar. Con sesión, `null` significa que
  // todavía no llegaron: mejor un segundo sin aviso que preguntarle algo que
  // ya contestó que no.
  const loading = !!userId && dismissed === null;

  const myTournaments = useMemo(
    () => tournaments.filter((t) => t.createdBy === userId),
    [tournaments, userId]
  );

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("venue_merge_dismissals")
        .select("venue_a, venue_b");
      if (cancelled) return;
      if (error) {
        // Todavía sin la tabla (migración sin correr) o sin conexión. Se
        // asume que no descartó nada: se sigue pudiendo unir canchas, solo
        // que un "no" no se recuerda hasta que la tabla exista.
        console.warn("venue_merge_dismissals no disponible", error.message);
        setDismissed(new Set());
        return;
      }
      setDismissed(
        new Set(
          (data ?? []).map(
            (r: { venue_a: string; venue_b: string }) => `${r.venue_a}|${r.venue_b}`
          )
        )
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const venues = useMemo(
    () => collectVenues(myTournaments.flatMap((t) => t.matches)),
    [myTournaments]
  );

  const suggestions = useMemo(() => {
    if (loading) return [];
    const descartadas = dismissed ?? SIN_DESCARTES;
    return findVenueSuggestions(venues).filter(
      (s) => !descartadas.has(`${s.pairKey[0]}|${s.pairKey[1]}`)
    );
  }, [venues, dismissed, loading]);

  /** "No, son distintas." Se guarda para no volver a preguntarlo. */
  const dismiss = useCallback(
    async (suggestion: VenueSuggestion) => {
      const [a, b] = venuePairKey(suggestion.a.key, suggestion.b.key);
      // Primero en pantalla: la sugerencia desaparece al instante aunque la
      // escritura tarde. Si falla, lo peor que pasa es que vuelva a preguntar
      // en la próxima carga, no que se pierda nada.
      setDismissed((prev) => {
        const next = new Set(prev ?? []);
        next.add(`${a}|${b}`);
        return next;
      });
      if (!userId) return;
      const { error } = await supabase
        .from("venue_merge_dismissals")
        .insert({ user_id: userId, venue_a: a, venue_b: b });
      // 23505 = ya estaba descartado. No es un problema: es la respuesta que
      // ya había dado, llegando dos veces.
      if (error && error.code !== "23505") {
        console.warn("No se pudo guardar el descarte de cancha", error.message);
      }
    },
    [userId]
  );

  /**
   * "Sí, es la misma." Los partidos de la cancha que se descarta pasan a decir
   * el nombre que se conserva.
   *
   * Devuelve un `undo` que revierte EXACTAMENTE esos partidos, ni uno más. Es
   * la razón de anotar los ids acá: después del cambio las dos canchas se
   * llaman igual, así que buscar por nombre para deshacer arrastraría también
   * a los que ya se llamaban así desde siempre.
   */
  const merge = useCallback(
    async (suggestion: VenueSuggestion, keepKey: string): Promise<MergeResult> => {
      const keep = suggestion.a.key === keepKey ? suggestion.a : suggestion.b;
      const drop = suggestion.a.key === keepKey ? suggestion.b : suggestion.a;

      const matchIds: string[] = [];
      for (const t of myTournaments) {
        for (const m of t.matches) {
          if (isInVenue(m.venue, drop.key)) matchIds.push(m.id);
        }
      }

      const ok = await setMatchesVenue(matchIds, keep.label);
      if (!ok) return { ok: false };

      return {
        ok: true,
        changed: matchIds.length,
        keptLabel: keep.label,
        undo: () => setMatchesVenue(matchIds, drop.label),
      };
    },
    [myTournaments, setMatchesVenue]
  );

  return { suggestions, dismiss, merge, loading };
}
