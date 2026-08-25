"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Las deudas de torneos fiados y sus abonos.
 *
 * Sirve para los dos lados sin cambiar nada: `get_tournament_debts` devuelve
 * todas las deudas si quien llama es admin, y solo las propias si es un
 * organizador. Los abonos hacen lo mismo por RLS. Así la pantalla del admin y
 * la del organizador leen exactamente lo mismo y no hay dos versiones de la
 * cuenta que puedan diferir.
 *
 * Ver `Por hacer/deuda-contra-publicidad.md`.
 */

export interface TournamentDebt {
  tournamentId: string;
  tournamentName: string;
  organizerId: string;
  organizerName: string;
  /** Precio de lista del torneo HOY. Sube solo si el torneo sube de plan. */
  priceCop: number;
  paidCop: number;
  balanceCop: number;
  note: string | null;
  createdAt: string;
}

export interface DebtPayment {
  id: string;
  tournamentId: string;
  organizerId: string;
  /** De qué corte salió. `null` = ajuste a mano (por ejemplo, pagó en efectivo). */
  periodMonth: string | null;
  amountCop: number;
  note: string | null;
  createdAt: string;
}

interface DebtRow {
  tournament_id: string;
  tournament_name: string | null;
  organizer_id: string;
  organizer_name: string | null;
  price_cop: number;
  paid_cop: number;
  balance_cop: number;
  note: string | null;
  created_at: string;
}

interface PaymentRow {
  id: string;
  tournament_id: string;
  organizer_id: string;
  period_month: string | null;
  amount_cop: number;
  note: string | null;
  created_at: string;
}

/** Lee las dos tablas. Sin estado adentro, para poder llamarla desde el efecto
 *  y desde el refetch sin duplicar la consulta. */
async function fetchDebts(): Promise<{
  debts: TournamentDebt[];
  payments: DebtPayment[];
}> {
  const [debtRes, payRes] = await Promise.all([
    supabase.rpc("get_tournament_debts"),
    supabase
      .from("tournament_debt_payments")
      .select("id, tournament_id, organizer_id, period_month, amount_cop, note, created_at")
      .order("created_at", { ascending: false }),
  ]);

  if (debtRes.error) console.error("No se pudieron leer las deudas", debtRes.error);
  if (payRes.error) console.error("No se pudieron leer los abonos", payRes.error);

  return {
    debts: ((debtRes.data as DebtRow[] | null) ?? []).map((d) => ({
      tournamentId: d.tournament_id,
      tournamentName: d.tournament_name ?? "Torneo sin nombre",
      organizerId: d.organizer_id,
      organizerName: d.organizer_name ?? "Organizador sin nombre",
      priceCop: d.price_cop,
      paidCop: Number(d.paid_cop),
      balanceCop: Number(d.balance_cop),
      note: d.note,
      createdAt: d.created_at,
    })),
    payments: ((payRes.data as PaymentRow[] | null) ?? []).map((p) => ({
      id: p.id,
      tournamentId: p.tournament_id,
      organizerId: p.organizer_id,
      periodMonth: p.period_month,
      amountCop: p.amount_cop,
      note: p.note,
      createdAt: p.created_at,
    })),
  };
}

export function useTournamentDebts() {
  const [debts, setDebts] = useState<TournamentDebt[]>([]);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [loading, setLoading] = useState(true);

  // `loading` arranca en `true` y solo se apaga al terminar: así un `refetch`
  // después de guardar un abono no parpadea la sección entera — las cifras se
  // actualizan en su lugar.
  useEffect(() => {
    let active = true;
    (async () => {
      const r = await fetchDebts();
      if (!active) return;
      setDebts(r.debts);
      setPayments(r.payments);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    const r = await fetchDebts();
    setDebts(r.debts);
    setPayments(r.payments);
    setLoading(false);
  }, []);

  return { debts, payments, loading, refetch };
}

/** Lo abonado en un mes, por organizador. Para restarlo de lo que se transfiere. */
export function paidInMonth(
  payments: DebtPayment[],
  month: string
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of payments) {
    if (p.periodMonth !== month) continue;
    out[p.organizerId] = (out[p.organizerId] ?? 0) + p.amountCop;
  }
  return out;
}
