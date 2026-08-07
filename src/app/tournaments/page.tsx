"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TournamentFilters } from "@/components/tournaments/tournament-filters";
import { TournamentList } from "@/components/tournaments/tournament-list";
import { useAuth } from "@/context/auth-context";
import { Tournament } from "@/types";
import {
  fetchTournamentsPage,
  TOURNAMENTS_PAGE_SIZE,
  type TournamentQuery,
} from "@/lib/db/tournaments";
import { usePageView } from "@/hooks/use-page-view";

/**
 * Listado público de torneos, paginado **contra la base**.
 *
 * Antes leía la lista completa del `TournamentContext` y filtraba en memoria.
 * Eso obligaba a bajar todos los torneos del sistema —con sus equipos, grupos,
 * playoffs y patrocinadores— para pintar los primeros diez, y empeoraba con
 * cada torneo nuevo.
 *
 * Ahora cada página son 10 filas y **los filtros y la búsqueda corren sobre
 * todo el catálogo**, no sobre lo ya cargado: se aplican en la consulta y
 * recién después se recorta.
 */
function TournamentsContent() {
  usePageView("browse", null, null);
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  /** Qué consulta corresponde a lo que hay en `tournaments` ahora mismo. */
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  // Los organizadores ven solo lo suyo; admins y visitantes anónimos, todo.
  const isOrganizer = !!user && user.role !== "admin";

  const sport = searchParams.get("sport") || undefined;
  const status = searchParams.get("status") || "in-progress";
  const search = searchParams.get("search") || undefined;
  const department = searchParams.get("department") || undefined;
  const municipality = searchParams.get("municipality") || undefined;

  const query: TournamentQuery = useMemo(
    () => ({
      sport,
      // El filtro manda "all" para decir "sin filtro"; la consulta espera que
      // el campo simplemente no venga.
      status: status && status !== "all" ? status : undefined,
      search,
      department,
      municipality,
      createdBy: isOrganizer ? user!.id : undefined,
    }),
    [sport, status, search, department, municipality, isOrganizer, user]
  );
  const queryKey = useMemo(() => JSON.stringify(query), [query]);

  /**
   * Cada carga lleva un número de secuencia y solo escribe si sigue siendo la
   * última. Sin esto, escribir rápido en el buscador deja ganar a la respuesta
   * más lenta y la lista termina mostrando resultados de una búsqueda vieja.
   */
  const seq = useRef(0);

  // Primera página: al entrar y cada vez que cambia un filtro.
  useEffect(() => {
    if (authLoading) return;
    const mine = ++seq.current;
    fetchTournamentsPage(query, 0).then(({ items, total }) => {
      if (seq.current !== mine) return;
      setTournaments(items);
      setTotal(total);
      setPage(0);
      setLoadedKey(queryKey);
    });
  }, [authLoading, query, queryKey]);

  const loadMore = async () => {
    const next = page + 1;
    const mine = seq.current;
    setLoadingMore(true);
    const { items } = await fetchTournamentsPage(query, next);
    // Si mientras se pedía la página siguiente cambió el filtro, esos
    // resultados ya no pertenecen a esta lista.
    if (seq.current === mine) {
      setTournaments((prev) => [...prev, ...items]);
      setPage(next);
    }
    setLoadingMore(false);
  };

  // Derivado y no un `useState`: "está cargando" es exactamente "lo que se ve
  // no corresponde a los filtros actuales". Con una bandera aparte había que
  // acordarse de prenderla en cada camino que dispara una consulta.
  const loading = authLoading || loadedKey !== queryKey;
  const hasMore = tournaments.length < total;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          {isOrganizer ? "Mis Torneos" : "Torneos"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isOrganizer
            ? "Los torneos que organizas"
            : "Explora todos los torneos disponibles"}
        </p>
      </div>

      <TournamentFilters />

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">Cargando torneos...</p>
        </div>
      ) : (
        <>
          {/* `maxColumns={6}`: misma grilla que la portada. La tarjeta está
              diseñada para ~245px de ancho, y a 3 columnas en pantalla ancha
              quedaría de ~410px con la banda de foto estirada. El dashboard y
              el perfil se quedan en 3 porque su contenedor es más angosto. */}
          <TournamentList tournaments={tournaments} maxColumns={6} />

          {total > 0 && (
            <div className="flex flex-col items-center gap-3 pt-2">
              <p className="text-sm text-muted-foreground">
                Mostrando {tournaments.length} de {total} torneo
                {total === 1 ? "" : "s"}
              </p>
              {hasMore && (
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore
                    ? "Cargando…"
                    : `Cargar ${Math.min(
                        TOURNAMENTS_PAGE_SIZE,
                        total - tournaments.length
                      )} más`}
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function TournamentsPage() {
  return (
    <Suspense>
      <TournamentsContent />
    </Suspense>
  );
}
