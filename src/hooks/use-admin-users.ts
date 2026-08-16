"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Usuarios del admin, paginados EN LA BASE.
 *
 * La versión anterior (`getAllUsers()` del auth-context) traía todos los
 * usuarios de una, y encima con `organization_profiles(*, social_links(*),
 * sponsors(*))` — o sea los patrocinadores de cada organizador. Con 20
 * usuarios se aguanta; con 500 la pantalla queda en blanco varios segundos y
 * el payload pesa megas.
 *
 * Acá se piden de a `PAGE_SIZE`, sólo las columnas que la lista muestra, y el
 * total sale de un `count` que no baja ni una fila.
 */

export const PAGE_SIZE = 20;

export type UserFilter =
  | "todos"
  | "activos"
  | "inactivos"
  /** Registrados en los últimos DIAS_NUEVO días. Es el filtro que responde
   *  "¿quiénes son estos correos que me están llegando?". */
  | "nuevos"
  /** Se registraron y nunca crearon nada. Mezcla de gente que se quedó a
   *  mitad de camino y de cuentas de prueba. */
  | "sin-torneos";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  /** Cuántos torneos creó. Viene como conteo embebido en el mismo `select`,
   *  así que no cuesta una consulta extra ni trae las filas de torneos. */
  tournament_count: number;
  /** Perfil de organizador, si lo tiene. Sin social_links ni sponsors: la
   *  lista no los muestra y traerlos multiplicaba el peso por nada. */
  organization_profiles: {
    organization_name: string;
    slug: string | null;
    location: string | null;
    is_public: boolean;
  } | null;
}

export interface AdminUserCounts {
  total: number;
  activos: number;
  inactivos: number;
  /** Registrados en los últimos 7 días. */
  nuevos: number;
  /** Registrados que nunca crearon un torneo. */
  sinTorneos: number;
}

/**
 * `tournaments!left(count)` da el número que se muestra en cada fila.
 *
 * El alias `sin:tournaments!left(id)` parece redundante pero no lo es: sobre
 * un embed con `count` el filtro `is.null` nunca acierta —el agregado siempre
 * devuelve una fila, aunque valga 0—, así que hace falta un segundo embed sin
 * agregar para poder preguntar "los que no tienen ninguno".
 */
const SELECT =
  "id,name,email,is_active,created_at,tournaments!left(count)," +
  "sin:tournaments!left(id)," +
  "organization_profiles(organization_name,slug,location,is_public)";

/** Normaliza el embed: PostgREST devuelve array u objeto según la relación. */
function normalize(row: Record<string, unknown>): AdminUserRow {
  const p = row.organization_profiles;
  const profile = Array.isArray(p) ? p[0] ?? null : p ?? null;
  // PostgREST devuelve el conteo como [{count: n}].
  const t = row.tournaments as { count?: number }[] | undefined;
  return {
    ...row,
    organization_profiles: profile,
    tournament_count: t?.[0]?.count ?? 0,
  } as AdminUserRow;
}

/** Fecha ISO de hace N días, para los filtros y contadores de "nuevos". */
function hace(dias: number): string {
  return new Date(Date.now() - dias * 86400_000).toISOString();
}

/** Ventana de "recién llegados". */
export const DIAS_NUEVO = 7;


/**
 * El `select` con embeds (`users:used_by(name)`) es una cadena que el cliente
 * de Supabase no puede tipar solo, y sin esto infiere `GenericStringError[]`.
 * La forma real la garantiza `normalize()`, que corre justo después.
 */
function asRows(data: unknown): Record<string, unknown>[] {
  return (data ?? []) as Record<string, unknown>[];
}

export function useAdminUsers() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [counts, setCounts] = useState<AdminUserCounts>({
    total: 0,
    activos: 0,
    inactivos: 0,
    nuevos: 0,
    sinTorneos: 0,
  });
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<UserFilter>("todos");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // El texto de búsqueda se debounce para no disparar una consulta por tecla.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Descarta respuestas viejas: si el usuario cambia de filtro mientras una
  // consulta está en vuelo, la que llega tarde no puede pisar a la nueva.
  const reqId = useRef(0);

  const buildQuery = useCallback(() => {
    let q = supabase
      .from("users")
      .select(SELECT, { count: "exact" })
      .neq("role", "admin");

    if (debounced) {
      const s = debounced.replace(/[%,()]/g, "");
      q = q.or(`name.ilike.%${s}%,email.ilike.%${s}%`);
    }
    if (filter === "activos") q = q.eq("is_active", true);
    if (filter === "inactivos") q = q.eq("is_active", false);
    if (filter === "nuevos") q = q.gte("created_at", hace(DIAS_NUEVO));
    if (filter === "sin-torneos") q = q.is("sin", null);

    return q.order("created_at", { ascending: false });
  }, [debounced, filter]);

  /** Primera página. Se vuelve a llamar con cada cambio de filtro o búsqueda. */
  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    const { data, count } = await buildQuery().range(0, PAGE_SIZE - 1);
    if (id !== reqId.current) return;
    setRows(asRows(data).map(normalize));
    setTotal(count ?? 0);
    setLoading(false);
  }, [buildQuery]);

  /** Siguiente página: se agrega al final, no reemplaza. */
  const loadMore = useCallback(async () => {
    const id = reqId.current;
    setLoadingMore(true);
    const { data } = await buildQuery().range(rows.length, rows.length + PAGE_SIZE - 1);
    if (id !== reqId.current) return;
    setRows((prev) => [...prev, ...asRows(data).map(normalize)]);
    setLoadingMore(false);
  }, [buildQuery, rows.length]);

  /**
   * Los tres contadores de arriba. Son `head: true`, así que la base cuenta
   * pero no devuelve ni una fila. No dependen del filtro ni de la búsqueda a
   * propósito: son el panorama completo, y si se movieran con el filtro
   * dejarían de servir para comparar.
   */
  const loadCounts = useCallback(async () => {
    const base = () =>
      supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .neq("role", "admin");

    const [t, a, n, conTorneos] = await Promise.all([
      base(),
      base().eq("is_active", true),
      base().gte("created_at", hace(DIAS_NUEVO)),
      // Cuántos SÍ tienen torneos: el inner join descarta a los que no.
      supabase
        .from("users")
        .select("id,tournaments!inner(id)", { count: "exact", head: true })
        .neq("role", "admin"),
    ]);
    const total = t.count ?? 0;
    const activos = a.count ?? 0;
    setCounts({
      total,
      activos,
      inactivos: total - activos,
      nuevos: n.count ?? 0,
      sinTorneos: Math.max(0, total - (conTorneos.count ?? 0)),
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  /**
   * Activa/desactiva sin recargar la lista entera: se cambia la fila en
   * memoria y se ajusta el contador. Recargar hacía que la lista saltara al
   * principio y se perdiera todo lo que el admin había paginado.
   */
  const toggleActive = useCallback(
    async (userId: string, next: boolean) => {
      const { error } = await supabase
        .from("users")
        .update({ is_active: next })
        .eq("id", userId);
      if (error) return false;

      setRows((prev) =>
        prev.map((r) => (r.id === userId ? { ...r, is_active: next } : r))
      );
      setCounts((c) => ({
        ...c,
        activos: c.activos + (next ? 1 : -1),
        inactivos: c.inactivos + (next ? -1 : 1),
      }));
      return true;
    },
    []
  );

  return {
    rows,
    counts,
    total,
    filter,
    setFilter,
    search,
    setSearch,
    loading,
    loadingMore,
    hasMore: rows.length < total,
    loadMore,
    toggleActive,
    reload: load,
  };
}
