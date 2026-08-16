"use client";

import { useState } from "react";
import { AdminGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  StatTile,
  FilterChips,
  SearchBox,
  ListFooter,
  EmptyState,
  ListSkeleton,
} from "@/components/admin/admin-ui";
import {
  useAdminCoupons,
  generateCode,
  type CouponFilter,
} from "@/hooks/use-admin-coupons";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { CouponType } from "@/types";
import {
  Ticket,
  CheckCircle2,
  CircleSlash,
  AlertTriangle,
  Plus,
  Copy,
  Trash2,
  Loader2,
  Wand2,
} from "lucide-react";

/** Cuántos códigos se pueden crear de una. */
const MAX_LOTE = 20;

function CouponsContent() {
  const c = useAdminCoupons();

  const [type, setType] = useState<CouponType>("free_tournament");
  const [value, setValue] = useState("");
  const [qty, setQty] = useState("1");
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [recien, setRecien] = useState<string[]>([]);

  const cantidad = Math.min(Math.max(parseInt(qty) || 1, 1), MAX_LOTE);
  const enLote = cantidad > 1;

  const handleCreate = async () => {
    const numValue = type === "free_tournament" ? 0 : parseInt(value);
    if (type === "percentage" && (isNaN(numValue) || numValue < 1 || numValue > 100)) {
      toast.error("El porcentaje tiene que estar entre 1 y 100");
      return;
    }
    if (!enLote && !code.trim()) {
      toast.error("Escribí un código o generá uno");
      return;
    }

    setCreating(true);
    // En lote los códigos se generan solos; de a uno se respeta el que se
    // escribió, que es el caso de "quiero un código que se pueda dictar".
    const codes = enLote
      ? Array.from({ length: cantidad }, () => generateCode())
      : [code.trim().toUpperCase()];

    const { error } = await supabase
      .from("coupons")
      .insert(codes.map((code) => ({ code, type, value: numValue })));

    if (error) {
      toast.error(
        error.code === "23505"
          ? "Ya existe un cupón con ese código"
          : "No se pudieron crear los cupones"
      );
    } else {
      toast.success(
        codes.length === 1 ? `Cupón ${codes[0]} creado` : `${codes.length} cupones creados`
      );
      setRecien(codes);
      setCode("");
      setValue("");
      await c.refresh();
    }
    setCreating(false);
  };

  const handleDelete = async (id: string, codigo: string) => {
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) {
      toast.error("No se pudo eliminar");
      return;
    }
    c.removeLocal(id);
    toast.success(`Cupón ${codigo} eliminado`);
  };

  const copy = (txt: string, msg = "Código copiado") => {
    navigator.clipboard.writeText(txt);
    toast.success(msg);
  };

  const filtros: { key: CouponFilter; label: string; count?: number }[] = [
    { key: "todos", label: "Todos", count: c.counts.total },
    { key: "disponibles", label: "Disponibles", count: c.counts.disponibles },
    { key: "usados", label: "Usados", count: c.counts.usados },
    { key: "quemados", label: "Quemados", count: c.counts.quemados },
  ];

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">Cupones</h1>
        <p className="mt-1 text-muted-foreground">
          Códigos de cortesía y descuento para organizadores
        </p>
      </div>

      {/* Las tarjetas son botones: tocar una aplica su filtro. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={Ticket}
          label="Total"
          value={c.counts.total}
          accent="blue"
          onClick={() => c.setFilter("todos")}
          active={c.filter === "todos"}
        />
        <StatTile
          icon={CheckCircle2}
          label="Disponibles"
          value={c.counts.disponibles}
          hint={c.counts.disponibles === 0 ? "No queda ninguno para dar" : "Listos para entregar"}
          accent="green"
          onClick={() => c.setFilter("disponibles")}
          active={c.filter === "disponibles"}
        />
        <StatTile
          icon={CircleSlash}
          label="Usados"
          value={c.counts.usados}
          accent="default"
          onClick={() => c.setFilter("usados")}
          active={c.filter === "usados"}
        />
        <StatTile
          icon={AlertTriangle}
          label="Quemados"
          value={c.counts.quemados}
          hint="Usados, pero su torneo ya no existe"
          accent={c.counts.quemados > 0 ? "amber" : "default"}
          onClick={() => c.setFilter("quemados")}
          active={c.filter === "quemados"}
        />
      </div>

      {/* Crear */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Crear cupones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-xs">Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as CouponType)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free_tournament">Torneo gratis</SelectItem>
                  <SelectItem value="percentage">Descuento %</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {type === "percentage" && (
              <div className="space-y-2">
                <Label className="text-xs">Porcentaje</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="50"
                  className="h-9"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs">Cuántos</Label>
              <Input
                type="number"
                min={1}
                max={MAX_LOTE}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">
                {enLote ? "Códigos" : "Código"}
              </Label>
              {enLote ? (
                <div className="flex h-9 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">
                  <Wand2 className="mr-1.5 size-3.5" />
                  Se generan solos
                </div>
              ) : (
                <div className="flex gap-1">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="COPA2026"
                    className="h-9 font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0"
                    onClick={() => setCode(generateCode())}
                    title="Generar código"
                  >
                    <Wand2 className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-end">
              <Button onClick={handleCreate} disabled={creating} className="h-9 w-full">
                {creating ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 size-4" />
                )}
                Crear {enLote ? cantidad : ""}
              </Button>
            </div>
          </div>

          {/* Los recién creados se muestran juntos y se pueden copiar de una
              sola vez: es justo lo que uno necesita para pegarlos en WhatsApp. */}
          {recien.length > 0 && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-green-700 dark:text-green-500">
                  {recien.length === 1 ? "Cupón creado" : `${recien.length} cupones creados`}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => copy(recien.join("\n"), "Todos copiados")}
                >
                  <Copy className="mr-1 size-3" />
                  Copiar todos
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recien.map((r) => (
                  <button
                    key={r}
                    onClick={() => copy(r)}
                    className="rounded bg-background px-2 py-1 font-mono text-xs font-bold hover:bg-muted"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <FilterChips value={c.filter} onChange={c.setFilter} options={filtros} />
          <SearchBox
            value={c.search}
            onChange={c.setSearch}
            placeholder="Buscar código…"
          />
        </div>

        {c.filter === "quemados" && c.counts.quemados > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
            Estos códigos figuran usados pero su torneo no existe: o se borró, o
            la creación falló después de quemar el cupón. No le sirven a nadie y
            tampoco se pueden volver a dar.
          </div>
        )}

        {c.loading ? (
          <ListSkeleton />
        ) : c.rows.length === 0 ? (
          <EmptyState
            text={
              c.search
                ? `Ningún cupón coincide con "${c.search}"`
                : "No hay cupones en este filtro"
            }
          />
        ) : (
          <div className="space-y-2">
            {c.rows.map((cup) => {
              const quemado = cup.used_by && !cup.tournament_id;
              return (
                <div
                  key={cup.id}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <button
                      onClick={() => copy(cup.code)}
                      className="flex shrink-0 items-center gap-1 rounded bg-muted px-2 py-1 font-mono text-sm font-bold transition-colors hover:bg-muted/70"
                      title="Copiar código"
                    >
                      {cup.code}
                      <Copy className="size-3 text-muted-foreground" />
                    </button>

                    <Badge
                      variant="outline"
                      className={
                        cup.type === "free_tournament"
                          ? "border-green-500/20 bg-green-500/10 text-green-600"
                          : "border-amber-500/20 bg-amber-500/10 text-amber-600"
                      }
                    >
                      {cup.type === "free_tournament" ? "Torneo gratis" : `${cup.value}% OFF`}
                    </Badge>

                    {!cup.used_by ? (
                      <Badge className="border-green-500/20 bg-green-500/10 text-green-600">
                        Disponible
                      </Badge>
                    ) : quemado ? (
                      <span className="flex min-w-0 max-w-full items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle className="size-3 shrink-0" />
                        <span className="truncate">
                          Quemado sin torneo · {cup.users?.name ?? "—"}
                        </span>
                      </span>
                    ) : (
                      <span className="min-w-0 max-w-full truncate text-xs text-muted-foreground">
                        {cup.users?.name ?? "—"} · {cup.tournaments?.name}
                      </span>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                    <span className="text-[11px] text-muted-foreground">
                      {(cup.used_at ?? cup.created_at).slice(0, 10)}
                    </span>
                    {!cup.used_by && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleDelete(cup.id, cup.code)}
                        title="Eliminar"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <ListFooter
          shown={c.rows.length}
          total={c.total}
          loading={c.loadingMore}
          onMore={c.loadMore}
          noun="cupones"
        />
      </div>
    </div>
  );
}

export default function CouponsPage() {
  return (
    <AdminGuard>
      <CouponsContent />
    </AdminGuard>
  );
}
