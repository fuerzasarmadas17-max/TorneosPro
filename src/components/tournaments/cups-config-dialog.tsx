"use client";

import { useEffect, useMemo, useState } from "react";
import { Tournament } from "@/types";
import { useTournaments } from "@/context/tournament-context";
import { supabase } from "@/lib/supabase";
import { CUPS_SURCHARGE_RATE, formatCOP } from "@/lib/pricing";
import { redirectToWompiCheckout, paymentReturnUrl } from "@/lib/payments/wompi-redirect";
import {
  CupDraft,
  DEFAULT_CUP_NAMES,
  MAX_CUPS,
  defaultCups,
  previewCups,
  validateCups,
} from "@/lib/copas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AlertCircle, Trophy } from "lucide-react";
import { toast } from "sonner";

interface CupsConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament;
}

/**
 * Armar las copas de un torneo: cuántas, cómo se llaman y de qué puestos de
 * cada grupo se alimenta cada una. Debajo de cada copa se ve cómo quedaría con
 * los grupos de hoy (cuántos equipos, cuántos descansos, qué descalificado no
 * entra) — el aviso de 4.3 del doc, antes de generar y no después.
 *
 * Guardar borra las llaves que hubiera, así que solo se ofrece mientras
 * ninguna tenga equipos (`canEditCups`).
 */
export function CupsConfigDialog({ open, onOpenChange, tournament }: CupsConfigDialogProps) {
  const { configureCups, teams } = useTournaments();
  const hadCups = !!tournament.cups?.length;

  const [cups, setCups] = useState<CupDraft[]>(() =>
    hadCups
      ? tournament.cups!.map(({ name, sortOrder, positionFrom, positionTo }) => ({
          name,
          sortOrder,
          positionFrom,
          positionTo,
        }))
      : defaultCups(tournament, MAX_CUPS)
  );
  const [saving, setSaving] = useState(false);

  // El recargo: lo calcula el servidor, con el mismo descuento del bono con
  // que se creó el torneo. `undefined` = cargando, `null` = no se pudo saber.
  const [quote, setQuote] = useState<
    { alreadyPaid: boolean; listSurcharge: number; cobro: number } | null | undefined
  >(undefined);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/payments/cups-quote", {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify({ tournamentId: tournament.id }),
        });
        const data = await res.json();
        if (!cancelled) setQuote(res.ok ? data : null);
      } catch {
        if (!cancelled) setQuote(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournament.id]);

  const error = useMemo(() => validateCups(tournament, cups), [tournament, cups]);
  const preview = useMemo(() => previewCups(tournament, cups), [tournament, cups]);

  const nameOf = (id: string) => teams.find((t) => t.id === id)?.name ?? "Un equipo";

  const setCount = (n: number) => {
    setCups((prev) => {
      if (n <= prev.length) return prev.slice(0, n);
      const next = [...prev];
      for (let i = prev.length; i < n; i++) {
        const last = next[next.length - 1];
        const block = last ? last.positionTo - last.positionFrom + 1 : 2;
        const from = last ? last.positionTo + 1 : 1;
        next.push({
          name: DEFAULT_CUP_NAMES[i],
          sortOrder: i + 1,
          positionFrom: from,
          positionTo: from + block - 1,
        });
      }
      return next;
    });
  };

  const update = (i: number, patch: Partial<CupDraft>) =>
    setCups((prev) => prev.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  // Prender copas pasa primero por el cobro del recargo. Volver a una sola
  // llave no cobra ni devuelve nada: el recargo queda pagado para siempre.
  const payThenSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/payments/cups-reference", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ tournamentId: tournament.id, cups }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "No pudimos iniciar el pago");
        setSaving(false);
        return;
      }
      if (!data.needsPayment) {
        await save(cups);
        return;
      }
      const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;
      if (!publicKey) {
        toast.error("Error al cargar el sistema de pago. Intentá de nuevo.");
        setSaving(false);
        return;
      }
      // Las copas viajan con el pago: cuando Wompi lo aprueba, el servidor
      // las crea. Nos vamos de la página, así que `saving` queda prendido.
      redirectToWompiCheckout({
        publicKey,
        amountInCents: data.amountInCents,
        reference: data.reference,
        integrity: data.integrity,
        redirectUrl: paymentReturnUrl(data.reference),
      });
    } catch {
      toast.error("No pudimos iniciar el pago");
      setSaving(false);
    }
  };

  const save = async (next: CupDraft[]) => {
    setSaving(true);
    const ok = await configureCups(
      tournament.id,
      next.map((c, i) => ({ ...c, name: c.name.trim(), sortOrder: i + 1 }))
    );
    setSaving(false);
    if (!ok) {
      toast.error("No pudimos guardar las copas. Recargá la página y probá de nuevo.");
      return;
    }
    toast.success(next.length > 0 ? "Copas guardadas" : "Volvió a una sola llave");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <DialogTitle>Jugar con varias copas</DialogTitle>
          </div>
          <DialogDescription>
            Después de los grupos, cada copa es una llave aparte con su propio
            campeón. Cada una se arma con ciertos puestos de cada grupo. Los
            puestos que no van a ninguna copa quedan eliminados.
          </DialogDescription>
        </DialogHeader>

        <SurchargeNotice quote={quote} alreadyHasCups={hadCups} />

        <div className="space-y-2">
          <Label className="text-sm">¿Cuántas copas?</Label>
          <div className="flex gap-2">
            {Array.from({ length: MAX_CUPS - 1 }, (_, i) => i + 2).map((n) => (
              <Button
                key={n}
                type="button"
                size="sm"
                variant={cups.length === n ? "default" : "outline"}
                onClick={() => setCount(n)}
              >
                {n}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {cups.map((c, i) => {
            const p = preview[i];
            return (
              <div key={i} className="rounded-md border p-3 space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Nombre</Label>
                  <Input
                    value={c.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    className="h-9"
                    maxLength={40}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs text-muted-foreground">Desde el puesto</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={c.positionFrom}
                      onChange={(e) => update(i, { positionFrom: parseInt(e.target.value) || 0 })}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs text-muted-foreground">Hasta el puesto</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={c.positionTo}
                      onChange={(e) => update(i, { positionTo: parseInt(e.target.value) || 0 })}
                      className="h-9"
                    />
                  </div>
                </div>
                {p && (
                  <p
                    className={cn(
                      "text-xs",
                      p.teams < 2 ? "text-destructive" : "text-muted-foreground"
                    )}
                  >
                    {p.teams} {p.teams === 1 ? "equipo" : "equipos"}
                    {p.byes > 0 &&
                      ` · ${p.byes} ${p.byes === 1 ? "pasa" : "pasan"} directo a la segunda ronda`}
                    {p.disqualifiedTeamIds.length > 0 &&
                      ` · ${p.disqualifiedTeamIds.map(nameOf).join(", ")} no ${
                        p.disqualifiedTeamIds.length === 1 ? "entra: está descalificado" : "entran: están descalificados"
                      }`}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {hadCups ? (
            <Button
              variant="ghost"
              onClick={() => save([])}
              disabled={saving}
              className="text-muted-foreground"
            >
              Volver a una sola llave
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => (hadCups ? save(cups) : payThenSave())}
              disabled={saving || !!error || (!hadCups && !quote)}
            >
              {saving
                ? "Guardando..."
                : !hadCups && quote && !quote.alreadyPaid && quote.cobro > 0
                  ? `Pagar ${formatCOP(quote.cobro)} y guardar`
                  : "Guardar copas"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** El token de la sesión, para las rutas que verifican que sos el dueño. */
async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * El aviso del recargo, arriba de todo: que el organizador sepa antes de armar
 * nada que jugar con copas cuesta un 15% más, y cuánto le sale con su bono.
 */
function SurchargeNotice({
  quote,
  alreadyHasCups,
}: {
  quote: { alreadyPaid: boolean; listSurcharge: number; cobro: number } | null | undefined;
  alreadyHasCups: boolean;
}) {
  const pct = Math.round(CUPS_SURCHARGE_RATE * 100);
  let detail: string;
  if (quote === undefined) detail = "Calculando cuánto te sale…";
  else if (quote === null) detail = "No pudimos calcular el recargo. Cerrá y probá de nuevo.";
  else if (quote.alreadyPaid || alreadyHasCups) detail = "Este torneo ya lo tiene pagado.";
  else if (quote.cobro === 0) detail = "Con el bono de este torneo no tenés que pagar nada.";
  else if (quote.cobro < quote.listSurcharge)
    detail = `Son ${formatCOP(quote.listSurcharge)}; con el descuento de tu bono pagás ${formatCOP(quote.cobro)}. Se paga una sola vez.`;
  else detail = `Son ${formatCOP(quote.cobro)}, una sola vez, sin importar cuántas copas armes.`;

  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
      <p className="font-medium">
        Jugar con copas tiene un recargo del {pct}% sobre el precio del torneo.
      </p>
      <p className="text-muted-foreground">{detail}</p>
    </div>
  );
}
