"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Ban, Check, Copy, Eye, EyeOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { maskAccount } from "@/lib/ad-analytics";

/**
 * Aprobar o rechazar los datos de pago de cada organizador.
 *
 * Es la puerta del dinero: desde `20260808d` nadie cobra hasta que un admin lo
 * apruebe. Hasta ahora eso solo se podía hacer por SQL, que es justo el tipo de
 * paso manual que se termina saltando.
 *
 * Acá también vive el dato para transferir. Antes se podía marcar un corte como
 * "Pagada" sin que el número de cuenta apareciera en ninguna pantalla — había
 * que abrir Supabase para pagar.
 *
 * ⚠️ ESTA PANTALLA MUESTRA CÉDULAS Y CUENTAS BANCARIAS.
 * La cuenta va tapada por defecto y se destapa de a una. No es seguridad de
 * verdad —quien entra acá ya es admin— pero evita que queden a la vista en una
 * captura, una pantalla compartida o alguien mirando por encima del hombro.
 */

interface PayoutRow {
  user_id: string;
  full_name: string;
  document_type: string;
  document_number: string;
  bank: string;
  account_type: string;
  account_number: string;
  terms_version: string | null;
  terms_accepted_at: string | null;
  approval_status: "pending" | "approved" | "rejected";
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  users: {
    email: string | null;
    name: string | null;
    revenue_share_excluded: boolean | null;
  } | null;
}

const STATUS_LABEL: Record<PayoutRow["approval_status"], string> = {
  pending: "En revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
};

const STATUS_STYLE: Record<PayoutRow["approval_status"], string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  rejected: "bg-destructive/15 text-destructive",
};

export function OrganizerApprovals({
  onPendingChange,
}: {
  /** Para el contador de la pestaña. */
  onPendingChange?: (n: number) => void;
}) {
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  /** Se guarda aparte de `rows` porque "falló la consulta" y "no hay nadie
   *  inscrito" se ven idénticos —una lista vacía— y significan cosas opuestas.
   *  Mostrar "todavía nadie se inscribió" cuando en realidad la consulta se
   *  rompió es cómo este bug pasó desapercibido. */
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<PayoutRow | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // La carga vive DENTRO del efecto, con un contador para poder repetirla.
  // Llamar a una función que hace setState desde el cuerpo del efecto encadena
  // renders (regla react-hooks/set-state-in-effect); es el mismo patrón que usan
  // los hooks de esta sección.
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data, error } = await supabase
        .from("organizer_payout_info")
        // ⚠️ Hay que nombrar la llave foránea. Esta tabla apunta DOS veces a
        // `users` —`user_id` (de quién son los datos) y `approved_by` (qué admin
        // aprobó)— y con un `users(...)` a secas PostgREST no sabe por cuál unir
        // y falla entero. Sin el nombre, la pestaña se ve vacía como si nadie se
        // hubiera inscrito.
        .select("*, users!organizer_payout_info_user_id_fkey(email, name, revenue_share_excluded)")
        // Los pendientes primero: son los únicos que piden una acción.
        .order("approval_status", { ascending: true })
        .order("created_at", { ascending: true });

      if (!active) return;

      if (error) {
        console.error("No se pudieron leer los datos de pago", error);
        setLoadError(error.message);
        setRows([]);
      } else {
        const list = (data as PayoutRow[]) ?? [];
        setLoadError(null);
        setRows(list);
        onPendingChange?.(
          list.filter((r) => r.approval_status === "pending").length
        );
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [nonce, onPendingChange]);

  const setStatus = async (
    row: PayoutRow,
    status: PayoutRow["approval_status"],
    rejectionReason?: string
  ) => {
    setSaving(true);
    // `approved_at` y `approved_by` NO se mandan: los sella el trigger con la
    // hora del servidor y el admin de la sesión.
    const { error } = await supabase
      .from("organizer_payout_info")
      .update({
        approval_status: status,
        rejection_reason: status === "rejected" ? (rejectionReason ?? null) : null,
      })
      .eq("user_id", row.user_id);
    setSaving(false);

    if (error) {
      console.error("No se pudo cambiar la aprobación", error);
      toast.error("No se pudo guardar: " + error.message);
      return;
    }
    toast.success(
      status === "approved"
        ? `${row.full_name} ya puede cobrar`
        : `${row.full_name} quedó rechazado`
    );
    setRejecting(null);
    setReason("");
    reload();
  };

  /**
   * Sacar o devolver a alguien al reparto.
   *
   * Es distinto de rechazar: rechazar dice "tus datos están mal, corregilos" y
   * el organizador puede resolverlo solo. Excluir dice "esta cuenta no participa
   * del programa" —la de pruebas, un socio, una demo— y no hay nada que él pueda
   * hacer al respecto. Por eso son dos controles y no uno.
   *
   * Vive en `users` y no en los datos de pago porque aplica aunque la cuenta
   * nunca se haya inscrito.
   */
  const toggleExcluded = async (row: PayoutRow) => {
    const next = !(row.users?.revenue_share_excluded ?? false);
    setSaving(true);
    const { error } = await supabase
      .from("users")
      .update({ revenue_share_excluded: next })
      .eq("id", row.user_id);
    setSaving(false);

    if (error) {
      console.error("No se pudo cambiar la exclusión", error);
      toast.error("No se pudo guardar: " + error.message);
      return;
    }
    toast.success(
      next
        ? `${row.full_name} queda fuera del reparto`
        : `${row.full_name} vuelve al reparto`
    );
    reload();
  };

  const toggleReveal = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Cargando…
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className="space-y-2 py-10 text-center text-sm">
          <p className="font-medium">No se pudo cargar la lista</p>
          <p className="text-muted-foreground">{loadError}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Todavía ningún organizador se inscribió al programa.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const isRevealed = revealed.has(r.user_id);
        return (
          <Card key={r.user_id}>
            <CardContent className="space-y-3 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{r.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.users?.email ?? "sin correo"}
                    {r.users?.name ? ` · ${r.users.name}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {r.users?.revenue_share_excluded && (
                    <Badge variant="secondary" className="bg-muted text-muted-foreground">
                      Fuera del reparto
                    </Badge>
                  )}
                  <Badge
                    variant="secondary"
                    className={cn(STATUS_STYLE[r.approval_status])}
                  >
                    {STATUS_LABEL[r.approval_status]}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <Field label="Documento">
                  {r.document_type} {r.document_number}
                </Field>
                <Field label="Banco">
                  {r.bank} · {r.account_type}
                </Field>
                <Field label="Cuenta">
                  <span className="inline-flex items-center gap-2">
                    <span className="tabular-nums">
                      {isRevealed ? r.account_number : maskAccount(r.account_number)}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleReveal(r.user_id)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={isRevealed ? "Ocultar" : "Ver completa"}
                    >
                      {isRevealed ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => copy(r.account_number, "Número de cuenta")}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Copiar"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </Field>
                {/* La constancia de aceptación. Se guarda desde 20260808b y
                    hasta ahora no se veía en ninguna parte: el día que alguien
                    reclame, el dato estaba en la base y no a la mano. */}
                <Field label="Aceptó condiciones">
                  {r.terms_accepted_at ? (
                    <>
                      {new Date(r.terms_accepted_at).toLocaleDateString("es-CO")}
                      <span className="text-muted-foreground">
                        {" "}
                        · {r.terms_version}
                      </span>
                    </>
                  ) : (
                    <span className="text-destructive">No aceptó</span>
                  )}
                </Field>
              </div>

              {r.approval_status === "rejected" && r.rejection_reason && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {r.rejection_reason}
                </p>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {r.approval_status !== "approved" && (
                  <Button
                    size="sm"
                    disabled={saving}
                    onClick={() => setStatus(r, "approved")}
                  >
                    <Check className="h-4 w-4" />
                    Aprobar
                  </Button>
                )}
                {r.approval_status !== "rejected" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => {
                      setRejecting(r);
                      setReason(r.rejection_reason ?? "");
                    }}
                  >
                    <X className="h-4 w-4" />
                    Rechazar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => toggleExcluded(r)}
                  className="text-muted-foreground"
                >
                  <Ban className="h-4 w-4" />
                  {r.users?.revenue_share_excluded
                    ? "Devolver al reparto"
                    : "Sacar del reparto"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog
        open={!!rejecting}
        onOpenChange={(o) => {
          if (!o) setRejecting(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar los datos de pago</DialogTitle>
            <DialogDescription>
              El motivo se le muestra al organizador tal cual lo escribas.
            </DialogDescription>
          </DialogHeader>
          {/* El motivo es obligatorio: un rechazo sin explicación deja al
              organizador sin nada que hacer y termina en un WhatsApp. */}
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: el nombre no coincide con el titular de la cuenta"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 5 || saving}
              onClick={() =>
                rejecting && setStatus(rejecting, "rejected", reason.trim())
              }
            >
              Rechazar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <p className="flex flex-wrap gap-x-2">
      <span className="text-muted-foreground">{label}:</span>
      <span>{children}</span>
    </p>
  );
}
