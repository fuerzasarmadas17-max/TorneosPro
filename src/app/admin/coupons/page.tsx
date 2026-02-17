"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Trash2, Plus, Ticket, Copy } from "lucide-react";
import { CouponType } from "@/types";

interface CouponRow {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  used_by: string | null;
  used_at: string | null;
  tournament_id: string | null;
  created_at: string;
  users?: { name: string } | null;
  tournaments?: { name: string } | null;
}

const TYPE_LABELS: Record<CouponType, string> = {
  percentage: "Descuento %",
  free_months: "Meses Gratis",
  free_tournament: "Torneo Gratis",
};

function CouponsContent() {
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [code, setCode] = useState("");
  const [type, setType] = useState<CouponType>("free_tournament");
  const [value, setValue] = useState("");
  const [creating, setCreating] = useState(false);

  const loadCoupons = useCallback(async () => {
    const { data, error } = await supabase
      .from("coupons")
      .select("*, users:used_by(name), tournaments:tournament_id(name)")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error loading coupons:", error);
    }
    setCoupons((data as CouponRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCode(result);
  };

  const handleCreate = async () => {
    if (!code.trim()) {
      toast.error("El codigo es obligatorio");
      return;
    }

    const numValue = type === "free_tournament" ? 0 : parseInt(value);
    if (type !== "free_tournament" && (isNaN(numValue) || numValue < 1)) {
      toast.error(
        type === "percentage"
          ? "Ingresa un porcentaje valido (1-100)"
          : "Ingresa la cantidad de meses"
      );
      return;
    }

    if (type === "percentage" && numValue > 100) {
      toast.error("El porcentaje no puede ser mayor a 100");
      return;
    }

    setCreating(true);
    const { error } = await supabase.from("coupons").insert({
      code: code.trim().toUpperCase(),
      type,
      value: numValue,
    });

    if (error) {
      if (error.code === "23505") {
        toast.error("Ya existe un cupon con ese codigo");
      } else {
        toast.error("Error al crear el cupon");
      }
    } else {
      toast.success(`Cupon ${code.trim().toUpperCase()} creado`);
      setCode("");
      setValue("");
      loadCoupons();
    }
    setCreating(false);
  };

  const handleDelete = async (id: string, couponCode: string) => {
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) {
      toast.error("Error al eliminar el cupon");
    } else {
      toast.success(`Cupon ${couponCode} eliminado`);
      loadCoupons();
    }
  };

  const copyCode = (couponCode: string) => {
    navigator.clipboard.writeText(couponCode);
    toast.success("Codigo copiado");
  };

  const availableCount = coupons.filter((c) => !c.used_by).length;
  const usedCount = coupons.filter((c) => c.used_by).length;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cupones</h1>
        <p className="text-muted-foreground mt-1">
          Crea y gestiona codigos de descuento
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{coupons.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Disponibles</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">
              {availableCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Usados</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-muted-foreground">
              {usedCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Create coupon */}
      <Card>
        <CardHeader>
          <CardDescription>Crear nuevo cupon</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-xs">Codigo</Label>
              <div className="flex gap-1">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="TORNEO2024"
                  className="h-9"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 flex-shrink-0"
                  onClick={generateCode}
                  title="Generar codigo"
                >
                  <Ticket className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as CouponType)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free_tournament">
                    Torneo Gratis
                  </SelectItem>
                  <SelectItem value="free_months">Meses Gratis</SelectItem>
                  <SelectItem value="percentage">Descuento %</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {type !== "free_tournament" && (
              <div className="space-y-2">
                <Label className="text-xs">
                  {type === "percentage" ? "Porcentaje (%)" : "Meses"}
                </Label>
                <Input
                  type="number"
                  min="1"
                  max={type === "percentage" ? 100 : 12}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={type === "percentage" ? "50" : "2"}
                  className="h-9"
                />
              </div>
            )}
            <div className="flex items-end">
              <Button
                onClick={handleCreate}
                disabled={creating || !code.trim()}
                className="w-full h-9"
              >
                <Plus className="h-4 w-4 mr-2" />
                Crear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coupon list */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Cupones creados</h2>
        {loading ? (
          <p className="text-muted-foreground text-sm">Cargando...</p>
        ) : coupons.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No hay cupones creados
          </p>
        ) : (
          <div className="space-y-2">
            {coupons.map((coupon) => (
              <div
                key={coupon.id}
                className="flex items-center justify-between border rounded-lg p-4"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => copyCode(coupon.code)}
                    className="font-mono font-bold text-sm bg-muted px-2 py-1 rounded hover:bg-muted/80 transition-colors flex items-center gap-1 flex-shrink-0"
                    title="Copiar codigo"
                  >
                    {coupon.code}
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <Badge
                    variant="outline"
                    className={
                      coupon.type === "free_tournament"
                        ? "bg-green-500/10 text-green-600 border-green-500/20"
                        : coupon.type === "free_months"
                          ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                          : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    }
                  >
                    {coupon.type === "free_tournament"
                      ? "Torneo Gratis"
                      : coupon.type === "free_months"
                        ? `${coupon.value} mes${coupon.value > 1 ? "es" : ""} gratis`
                        : `${coupon.value}% OFF`}
                  </Badge>
                  {coupon.used_by ? (
                    <span className="text-xs text-muted-foreground truncate">
                      Usado por{" "}
                      <span className="font-medium">
                        {coupon.users?.name || "..."}
                      </span>
                      {coupon.tournaments?.name && (
                        <> en {coupon.tournaments.name}</>
                      )}
                    </span>
                  ) : (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                      Disponible
                    </Badge>
                  )}
                </div>
                {!coupon.used_by && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => handleDelete(coupon.id, coupon.code)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
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
