"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MONETIZAR_TERMS_VERSION } from "@/lib/monetizar-terms";
import type { PayoutInfo } from "@/hooks/use-payout-info";

/**
 * La inscripción al programa: a dónde transferirte y aceptar las condiciones.
 *
 * POR QUÉ LOS DATOS VAN ANTES DE LAS CIFRAS
 * Si primero le mostráramos "ganaste $240.000" y después le pidiéramos la
 * cédula, el dato de pago se vuelve un trámite molesto que se puede dejar a
 * medias — y quedan cortes emitidos que no se pueden pagar. Pidiéndolo antes,
 * todo corte que se emite es cobrable.
 *
 * POR QUÉ EL TEXTO DE LAS CONDICIONES NO ESTÁ ACÁ ADENTRO
 * Va enlazado a `/terminos-monetizacion`, que se abre en otra pestaña, igual
 * que los términos del registro. Meter ocho secciones de texto en un diálogo lo
 * vuelve un muro que nadie lee y que hay que scrollear para llegar al botón. Lo
 * que sí queda acá es lo único que no se puede perder de vista al aceptar: que
 * el monto se calcula al cerrar el mes y que la aprobación es previa al pago.
 */

/** Bancos y billeteras que usa el público de la app. "Otro" abre un campo
 *  libre: la lista siempre se va a quedar corta, y perder un organizador por un
 *  desplegable incompleto sería absurdo. */
const BANKS = [
  "Bancolombia",
  "Nequi",
  "Daviplata",
  "Davivienda",
  "Banco de Bogotá",
  "BBVA",
  "Banco Agrario",
  "Banco Caja Social",
  "Banco Popular",
  "Banco de Occidente",
  "Colpatria / Scotiabank",
  "Itaú",
  "Bancoomeva",
  "Falabella",
  "Lulo Bank",
  "Otro",
];

export function MonetizarSignupDialog({
  open,
  onOpenChange,
  existing,
  reaccepting,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Datos que ya dio, si vuelve solo a re-aceptar términos nuevos. */
  existing: PayoutInfo | null;
  reaccepting: boolean;
  onDone: () => void;
}) {
  const { user } = useAuth();

  const [fullName, setFullName] = useState(existing?.full_name ?? "");
  const [docType, setDocType] = useState<PayoutInfo["document_type"]>(
    existing?.document_type ?? "CC"
  );
  const [docNumber, setDocNumber] = useState(existing?.document_number ?? "");
  const [bank, setBank] = useState(
    existing?.bank
      ? BANKS.includes(existing.bank)
        ? existing.bank
        : "Otro"
      : ""
  );
  const [otherBank, setOtherBank] = useState(
    existing?.bank && !BANKS.includes(existing.bank) ? existing.bank : ""
  );
  const [accountType, setAccountType] = useState<PayoutInfo["account_type"]>(
    existing?.account_type ?? "ahorros"
  );
  const [account, setAccount] = useState(existing?.account_number ?? "");
  const [accountAgain, setAccountAgain] = useState(
    existing?.account_number ?? ""
  );
  // Editar la cuenta bancaria no es volver a inscribirse: si ya aceptó ESTA
  // versión de las condiciones, no tiene sentido hacérselas aceptar de nuevo
  // para corregir un dígito. Cuando los términos cambiaron (`reaccepting`), la
  // casilla arranca vacía y hay que marcarla a mano.
  const editing =
    !reaccepting && existing?.terms_version === MONETIZAR_TERMS_VERSION;

  const [accepted, setAccepted] = useState(editing);
  const [saving, setSaving] = useState(false);

  const bankValue = bank === "Otro" ? otherBank.trim() : bank;

  // Mismos mínimos que el CHECK de la tabla. Se repiten acá para poder decir
  // cuál campo está mal: la base rechaza la fila entera con un mensaje que no le
  // sirve a nadie.
  const problems: string[] = [];
  if (fullName.trim().length <= 2) problems.push("Escribí tu nombre completo.");
  if (docNumber.trim().length <= 4)
    problems.push("El número de documento está incompleto.");
  if (bankValue.length <= 1) problems.push("Elegí el banco.");
  if (account.trim().length <= 4)
    problems.push("El número de cuenta está incompleto.");
  else if (account.trim() !== accountAgain.trim())
    problems.push("Los dos números de cuenta no coinciden.");
  if (!accepted) problems.push("Falta aceptar las condiciones.");

  const save = async () => {
    if (!user?.id || problems.length > 0) return;
    setSaving(true);

    // `terms_accepted_at` NO se manda: lo estampa el trigger con la hora del
    // servidor. Es la constancia de que aceptó y no puede depender del reloj del
    // navegador.
    const { error } = await supabase.from("organizer_payout_info").upsert(
      {
        user_id: user.id,
        full_name: fullName.trim(),
        document_type: docType,
        document_number: docNumber.trim(),
        bank: bankValue,
        account_type: accountType,
        account_number: account.trim(),
        terms_version: MONETIZAR_TERMS_VERSION,
      },
      { onConflict: "user_id" }
    );

    setSaving(false);
    if (error) {
      console.error("No se pudieron guardar los datos de pago", error);
      toast.error("No se pudieron guardar tus datos: " + error.message);
      return;
    }
    toast.success("Listo, ya estás en el programa.");
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {reaccepting
              ? "Aceptá las condiciones nuevas"
              : editing
                ? "Cambiar datos de pago"
                : "Entrar al programa"}
          </DialogTitle>
          <DialogDescription>
            {reaccepting
              ? "Cambiaron las condiciones. Revisá tus datos y aceptá para seguir cobrando."
              : editing
                ? "Lo que cambies acá se usa para tu próxima transferencia."
                : "Necesitamos a dónde transferirte cuando cierre el mes."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="full-name">Nombre completo</Label>
            <Input
              id="full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Como aparece en tu cuenta bancaria"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <div className="space-y-2">
              <Label>Documento</Label>
              <Select
                value={docType}
                onValueChange={(v) =>
                  setDocType(v as PayoutInfo["document_type"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CC">Cédula</SelectItem>
                  <SelectItem value="CE">Cédula extranjería</SelectItem>
                  <SelectItem value="NIT">NIT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-number">Número</Label>
              <Input
                id="doc-number"
                inputMode="numeric"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Banco</Label>
              <Select value={bank} onValueChange={setBank}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegí tu banco" />
                </SelectTrigger>
                <SelectContent>
                  {BANKS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bank === "Otro" && (
                <Input
                  className="mt-2"
                  value={otherBank}
                  onChange={(e) => setOtherBank(e.target.value)}
                  placeholder="¿Cuál?"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Tipo de cuenta</Label>
              <Select
                value={accountType}
                onValueChange={(v) =>
                  setAccountType(v as PayoutInfo["account_type"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ahorros">Ahorros</SelectItem>
                  <SelectItem value="corriente">Corriente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="account">Número de cuenta</Label>
              <Input
                id="account"
                inputMode="numeric"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              />
            </div>
            {/* Se pide dos veces a propósito, y sin poder pegar. Un dígito mal
                no da ningún error visible: la transferencia se devuelve semanas
                después, o peor, le llega a otra persona. */}
            <div className="space-y-2">
              <Label htmlFor="account-again">Repetilo</Label>
              <Input
                id="account-again"
                inputMode="numeric"
                value={accountAgain}
                onChange={(e) => setAccountAgain(e.target.value)}
                onPaste={(e) => e.preventDefault()}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            La cuenta tiene que estar a tu nombre. Estos datos no los ven los
            anunciantes ni los otros organizadores.
          </p>

          <label className="flex cursor-pointer items-start gap-3 border-t pt-4 text-sm">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span>
              Leí y acepto las{" "}
              <Link
                href="/terminos-monetizacion"
                target="_blank"
                className="text-primary underline underline-offset-2"
              >
                condiciones del programa
              </Link>
              . Entiendo que el monto se calcula al cerrar el mes y que hasta que
              no aprueben mis datos no me pueden consignar.
            </span>
          </label>

          {problems.length > 0 && (
            <p className="text-sm text-muted-foreground">{problems[0]}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={problems.length > 0 || saving}>
              {saving
                ? "Guardando…"
                : reaccepting
                  ? "Aceptar"
                  : editing
                    ? "Guardar"
                    : "Entrar al programa"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
