"use client";

import { Card, CardContent } from "@/components/ui/card";
import { HandCoins } from "lucide-react";
import { formatCOP } from "@/lib/pricing";
import type { TournamentDebt, DebtPayment } from "@/hooks/use-tournament-debts";
import { monthLabel } from "@/lib/month-label";

/**
 * Lo que el organizador debe por los torneos que empezó sin pagar, y cómo su
 * publicidad se lo va abonando.
 *
 * POR QUÉ SE MUESTRA DESDE EL PRIMER DÍA, ANTES DE QUE HAYA NINGÚN CORTE
 * Porque al inscribirse aceptó unos términos que dicen que se le va a
 * descontar (sección "Si empezaste sin pagar tu torneo"). Si entra y no ve
 * ninguna mención de su saldo hasta el primer cierre, la pantalla le está
 * contradiciendo lo que firmó, y el día que le llegue menos plata de la que vio
 * va a sentir que se lo escondieron.
 *
 * QUÉ SE LE MUESTRA
 * El SALDO, no el porcentaje. Lo que lo mantiene enganchado es ver la deuda
 * bajar, no saber qué fracción se le tomó — y el porcentaje además cambia mes a
 * mes, así que invita a comparar y a preguntar por qué.
 *
 * El nombre del torneo se resuelve en vivo, nunca se guarda con el abono: los
 * organizadores les cambian el nombre a sus torneos, y un historial con el
 * nombre viejo le muestra algo que no reconoce.
 */
export function MyDebts({
  debts,
  payments,
  loading,
}: {
  debts: TournamentDebt[];
  payments: DebtPayment[];
  loading: boolean;
}) {
  if (loading || debts.length === 0) return null;

  const vivas = debts.filter((d) => d.balanceCop > 0);
  if (vivas.length === 0) return null;

  const totalDebe = vivas.reduce((a, d) => a + d.balanceCop, 0);

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <HandCoins className="h-4 w-4" />
            Tus torneos por pagar
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Empezaste {vivas.length === 1 ? "este torneo" : "estos torneos"} sin
            pagarlo{vivas.length === 1 ? "" : "s"}. Lo que ganás con la
            publicidad te lo va abonando, y te transferimos la diferencia.
            También podés pagarlo cuando quieras y dejás de tener abonos.
          </p>
        </div>

        <div className="space-y-3">
          {vivas.map((d) => {
            const abonos = payments
              .filter((p) => p.tournamentId === d.tournamentId)
              .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
            const pct = d.priceCop > 0
              ? Math.min(100, Math.round((d.paidCop / d.priceCop) * 100))
              : 0;

            return (
              <div key={d.tournamentId} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate font-medium" title={d.tournamentName}>
                    {d.tournamentName}
                  </span>
                  <span className="tabular-nums text-sm font-semibold">
                    {formatCOP(d.balanceCop)}
                  </span>
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {d.paidCop > 0 ? (
                    <>
                      Llevás {formatCOP(d.paidCop)} abonados de{" "}
                      {formatCOP(d.priceCop)}.
                    </>
                  ) : (
                    <>Vale {formatCOP(d.priceCop)}. Todavía no se abonó nada.</>
                  )}
                </p>

                {abonos.length > 0 && (
                  <ul className="space-y-0.5 border-t pt-2 text-xs text-muted-foreground">
                    {abonos.map((a) => (
                      <li key={a.id} className="flex justify-between gap-2">
                        <span>
                          {a.periodMonth
                            ? `Publicidad de ${monthLabel(a.periodMonth)}`
                            : (a.note ?? "Ajuste")}
                        </span>
                        <span className="tabular-nums">
                          − {formatCOP(a.amountCop)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {vivas.length > 1 && (
          <p className="text-right text-xs text-muted-foreground">
            Total por pagar:{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {formatCOP(totalDebe)}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
