"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, HandCoins } from "lucide-react";
import { formatCOP } from "@/lib/pricing";
import {
  useTournamentDebts,
  paidInMonth,
  type TournamentDebt,
} from "@/hooks/use-tournament-debts";

/**
 * Abonos de los torneos fiados, sobre un mes YA CERRADO.
 *
 * POR QUÉ DESPUÉS DE CERRAR Y NO DURANTE
 * Dos motivos, y el segundo es el que manda:
 *
 *   1. No se puede decidir cuánto abonarle hasta saber cuánto ganó, y eso lo
 *      produce el cierre.
 *   2. Así `close_ad_period` no se toca. Es la función que valida y congela la
 *      plata, la más probada del módulo; meterle la escritura de los abonos
 *      sería arriesgar lo que ya funciona por algo que puede vivir al lado.
 *
 * Lo que ganó (`ad_settlements.amount_cop`) queda intacto e inmutable. El abono
 * va en su propia tabla y la transferencia es la resta de los dos, así un abono
 * mal cargado se corrige sin tocar la cifra que el organizador ya vio.
 *
 * Ver `Por hacer/deuda-contra-publicidad.md`.
 */

interface Props {
  /** Mes cerrado, primer día. */
  periodMonth: string;
  /** Lo que ganó cada organizador en este corte, por id. */
  earnedByOrganizer: Record<string, number>;
}

export function DebtPayments({ periodMonth, earnedByOrganizer }: Props) {
  const { user } = useAuth();
  const { debts, payments, loading, refetch } = useTournamentDebts();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [settling, setSettling] = useState<string | null>(null);

  const yaAbonado = useMemo(
    () => paidInMonth(payments, periodMonth),
    [payments, periodMonth]
  );

  // Solo las deudas vivas. Una con saldo cero ya se saldó —con publicidad, en
  // efectivo, o las dos— y mostrarla sería ruido que crece para siempre.
  const vivas = useMemo(
    () => debts.filter((d) => d.balanceCop > 0),
    [debts]
  );

  const porOrganizador = useMemo(() => {
    const map = new Map<string, TournamentDebt[]>();
    for (const d of vivas) {
      const list = map.get(d.organizerId);
      if (list) list.push(d);
      else map.set(d.organizerId, [d]);
    }
    return [...map.entries()];
  }, [vivas]);

  if (loading || porOrganizador.length === 0) return null;

  const montoDe = (id: string) => {
    const raw = draft[id];
    if (raw === undefined || raw.trim() === "") return 0;
    const n = parseInt(raw.replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  /** Lo que le queda disponible del corte, después de lo ya abonado este mes. */
  const disponibleDe = (organizerId: string) =>
    Math.max(
      0,
      (earnedByOrganizer[organizerId] ?? 0) - (yaAbonado[organizerId] ?? 0)
    );

  const guardar = async () => {
    const filas = vivas
      .map((d) => ({ d, monto: montoDe(d.tournamentId) }))
      .filter((x) => x.monto > 0);

    if (filas.length === 0) {
      toast.error("No cargaste ningún abono.");
      return;
    }

    // El tope que la base NO puede validar: el trigger sabe cuánto vale el
    // torneo, pero no cuánto ganó el organizador este mes. Eso solo se sabe
    // acá, con el corte ya cerrado en la mano.
    for (const [organizerId, lista] of porOrganizador) {
      const suma = lista.reduce((a, d) => a + montoDe(d.tournamentId), 0);
      if (suma > disponibleDe(organizerId)) {
        toast.error(
          `${lista[0].organizerName}: los abonos suman ${formatCOP(suma)} y solo ganó ${formatCOP(disponibleDe(organizerId))} disponibles este mes.`
        );
        return;
      }
    }

    setSaving(true);
    const { error } = await supabase.from("tournament_debt_payments").insert(
      filas.map(({ d, monto }) => ({
        tournament_id: d.tournamentId,
        organizer_id: d.organizerId,
        period_month: periodMonth,
        amount_cop: monto,
        created_by: user?.id ?? null,
      }))
    );
    setSaving(false);

    if (error) {
      toast.error("No se pudieron guardar los abonos: " + error.message);
      return;
    }
    setDraft({});
    toast.success(
      filas.length === 1 ? "Abono guardado." : `${filas.length} abonos guardados.`
    );
    refetch();
  };

  /**
   * Pagó el torneo en efectivo: se abona el saldo entero y la deuda queda en
   * cero. NO se borra la fila — borrarla se llevaría por delante el historial
   * de lo que ya se le había descontado de su publicidad, que es justo lo que
   * hay que poder mostrarle si pregunta.
   */
  const saldarEnEfectivo = async (d: TournamentDebt) => {
    setSettling(d.tournamentId);
    const { error } = await supabase.from("tournament_debt_payments").insert({
      tournament_id: d.tournamentId,
      organizer_id: d.organizerId,
      period_month: null,
      amount_cop: d.balanceCop,
      note: "Saldado en efectivo.",
      created_by: user?.id ?? null,
    });
    setSettling(null);
    if (error) {
      toast.error("No se pudo saldar: " + error.message);
      return;
    }
    toast.success(`${d.tournamentName} quedó saldado.`);
    refetch();
  };

  const totalCargado = vivas.reduce((a, d) => a + montoDe(d.tournamentId), 0);

  return (
    <section className="space-y-3 rounded-lg border p-3">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <HandCoins className="h-4 w-4" />
          Abonos a torneos fiados
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Lo que ganó no cambia. Se le transfiere lo que ganó menos lo que
          abones, y el organizador ve a qué torneo fue cada abono.
        </p>
      </div>

      <div className="space-y-3">
        {porOrganizador.map(([organizerId, lista]) => {
          const ganó = earnedByOrganizer[organizerId] ?? 0;
          const disponible = disponibleDe(organizerId);
          const cargado = lista.reduce((a, d) => a + montoDe(d.tournamentId), 0);
          const excede = cargado > disponible;

          return (
            <div key={organizerId} className="space-y-2 rounded-md border p-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium">
                  {lista[0].organizerName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {ganó > 0 ? (
                    <>
                      ganó {formatCOP(ganó)}
                      {cargado > 0 && (
                        <> · se le transfiere {formatCOP(Math.max(0, ganó - (yaAbonado[organizerId] ?? 0) - cargado))}</>
                      )}
                    </>
                  ) : (
                    "no ganó nada este mes"
                  )}
                </span>
              </div>

              {lista.map((d) => (
                <div
                  key={d.tournamentId}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate" title={d.tournamentName}>
                    {d.tournamentName}
                  </span>
                  <span className="tabular-nums text-xs text-muted-foreground">
                    debe {formatCOP(d.balanceCop)}
                  </span>
                  <Input
                    inputMode="numeric"
                    placeholder="0"
                    className="h-8 w-28 text-right tabular-nums"
                    value={draft[d.tournamentId] ?? ""}
                    disabled={ganó === 0}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        [d.tournamentId]: e.target.value.replace(/\D/g, ""),
                      }))
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    disabled={settling === d.tournamentId}
                    onClick={() => saldarEnEfectivo(d)}
                  >
                    {settling === d.tournamentId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Pagó en efectivo"
                    )}
                  </Button>
                </div>
              ))}

              {excede && (
                <p className="text-xs text-destructive">
                  Los abonos suman {formatCOP(cargado)} y solo tiene{" "}
                  {formatCOP(disponible)} disponibles este mes.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {totalCargado > 0
            ? `Vas a abonar ${formatCOP(totalCargado)} en total.`
            : "Dejá en blanco los que no quieras abonar este mes."}
        </p>
        <Button size="sm" onClick={guardar} disabled={saving || totalCargado === 0}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar abonos
        </Button>
      </div>
    </section>
  );
}
