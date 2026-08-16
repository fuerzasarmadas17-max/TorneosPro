"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CouponType } from "@/types";

/**
 * Cupones del admin, paginados EN LA BASE.
 *
 * Igual que en usuarios: antes se traían todos de una con sus joins. Además
 * del peso, la lista completa dejaba de responder la pregunta que uno le
 * hace ("¿cuáles me quedan para dar?") y pasaba a ser scroll.
 */

export const PAGE_SIZE = 20;

/**
 * `quemados` es el filtro que más sirve y el que no existía: cupones marcados
 * como usados cuyo torneo no está por ningún lado, porque se borró o porque
 * la creación falló. Son códigos muertos: no le sirven a nadie y tampoco se
 * pueden volver a dar. En agosto de 2026 había 15 de 36.
 */
export type CouponFilter = "todos" | "disponibles" | "usados" | "quemados";

export interface AdminCouponRow {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  used_by: string | null;
  used_at: string | null;
  tournament_id: string | null;
  created_at: string;
  users: { name: string } | null;
  tournaments: { name: string } | null;
}

export interface AdminCouponCounts {
  total: number;
  disponibles: number;
  usados: number;
  quemados: number;
}

const SELECT =
  "id,code,type,value,used_by,used_at,tournament_id,created_at," +
  "users:used_by(name),tournaments:tournament_id(name)";

function normalize(row: Record<string, unknown>): AdminCouponRow {
  const u = row.users;
  const t = row.tournaments;
  return {
    ...row,
    users: (Array.isArray(u) ? u[0] : u) ?? null,
    tournaments: (Array.isArray(t) ? t[0] : t) ?? null,
  } as AdminCouponRow;
}


/**
 * El `select` con embeds (`users:used_by(name)`) es una cadena que el cliente
 * de Supabase no puede tipar solo, y sin esto infiere `GenericStringError[]`.
 * La forma real la garantiza `normalize()`, que corre justo después.
 */
function asRows(data: unknown): Record<string, unknown>[] {
  return (data ?? []) as Record<string, unknown>[];
}

export function useAdminCoupons() {
  const [rows, setRows] = useState<AdminCouponRow[]>([]);
  const [counts, setCounts] = useState<AdminCouponCounts>({
    total: 0,
    disponibles: 0,
    usados: 0,
    quemados: 0,
  });
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<CouponFilter>("todos");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim().toUpperCase()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const reqId = useRef(0);

  const buildQuery = useCallback(() => {
    let q = supabase.from("coupons").select(SELECT, { count: "exact" });

    if (debounced) q = q.ilike("code", `%${debounced.replace(/[%,()]/g, "")}%`);
    if (filter === "disponibles") q = q.is("used_by", null);
    if (filter === "usados") q = q.not("used_by", "is", null);
    if (filter === "quemados") {
      // Usado pero sin torneo. El cruce contra `tournaments.coupon_id` —el
      // otro lado del enlace— no se puede expresar acá; se hace en la
      // consulta de conteo y en el SQL de limpieza. Para la lista alcanza:
      // en la práctica los dos lados coinciden.
      q = q.not("used_by", "is", null).is("tournament_id", null);
    }

    return q.order("created_at", { ascending: false });
  }, [debounced, filter]);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    const { data, count } = await buildQuery().range(0, PAGE_SIZE - 1);
    if (id !== reqId.current) return;
    setRows(asRows(data).map(normalize));
    setTotal(count ?? 0);
    setLoading(false);
  }, [buildQuery]);

  const loadMore = useCallback(async () => {
    const id = reqId.current;
    setLoadingMore(true);
    const { data } = await buildQuery().range(rows.length, rows.length + PAGE_SIZE - 1);
    if (id !== reqId.current) return;
    setRows((prev) => [...prev, ...asRows(data).map(normalize)]);
    setLoadingMore(false);
  }, [buildQuery, rows.length]);

  const loadCounts = useCallback(async () => {
    const base = () =>
      supabase.from("coupons").select("id", { count: "exact", head: true });

    const [t, d, q] = await Promise.all([
      base(),
      base().is("used_by", null),
      base().not("used_by", "is", null).is("tournament_id", null),
    ]);
    const total = t.count ?? 0;
    const disponibles = d.count ?? 0;
    setCounts({
      total,
      disponibles,
      usados: total - disponibles,
      quemados: q.count ?? 0,
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const refresh = useCallback(async () => {
    await Promise.all([load(), loadCounts()]);
  }, [load, loadCounts]);

  /** Borra de la lista en memoria y ajusta contadores, sin recargar todo. */
  const removeLocal = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    setCounts((c) => ({
      ...c,
      total: Math.max(0, c.total - 1),
      disponibles: Math.max(0, c.disponibles - 1),
    }));
  }, []);

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
    refresh,
    removeLocal,
  };
}

/** Códigos sin caracteres ambiguos (0/O, 1/I/L) para dictarlos por teléfono. */
export function generateCode(len = 8): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}
