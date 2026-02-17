"use client";

import { useEffect, useState } from "react";
import { AdminGuard } from "@/components/auth-guard";
import { useTournaments } from "@/context/tournament-context";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { formatCOP } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";
import { CouponType } from "@/types";

interface CouponInfo {
  id: string;
  code: string;
  type: CouponType;
  value: number;
}

function FinancesContent() {
  const { tournaments } = useTournaments();
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [couponMap, setCouponMap] = useState<Record<string, CouponInfo>>({});

  useEffect(() => {
    // Fetch owner names for all unique createdBy ids
    const userIds = [...new Set(tournaments.map((t) => t.createdBy))];
    if (userIds.length === 0) return;

    supabase
      .from("users")
      .select("id, name, organization_profiles(organization_name)")
      .in("id", userIds)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        for (const row of data) {
          const profiles = row.organization_profiles as Array<{ organization_name: string }> | null;
          const orgName = profiles && profiles.length > 0 ? profiles[0].organization_name : null;
          map[row.id] = orgName || row.name || "Desconocido";
        }
        setOwnerNames(map);
      });
  }, [tournaments]);

  useEffect(() => {
    // Fetch coupon info for tournaments with coupon_id
    const couponIds = tournaments
      .map((t) => t.couponId)
      .filter((id): id is string => !!id);
    if (couponIds.length === 0) return;

    supabase
      .from("coupons")
      .select("id, code, type, value")
      .in("id", couponIds)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, CouponInfo> = {};
        for (const row of data) {
          map[row.id] = {
            id: row.id,
            code: row.code,
            type: row.type as CouponType,
            value: row.value,
          };
        }
        setCouponMap(map);
      });
  }, [tournaments]);

  const paidTournaments = tournaments.filter((t) => t.plan === "paid" && t.monthlyCost);

  // Active = not completed (upcoming or in-progress)
  const activePaid = paidTournaments.filter((t) => t.status !== "completed");
  const completedPaid = paidTournaments.filter((t) => t.status === "completed");

  const expectedMonthly = activePaid.reduce((sum, t) => sum + (t.monthlyCost || 0), 0);

  // Simulated: assume completed tournaments have been paid, active ones are pending
  const received = completedPaid.reduce((sum, t) => sum + (t.monthlyCost || 0), 0);
  const pending = expectedMonthly;

  const getOwnerName = (userId: string) => {
    return ownerNames[userId] || "Cargando...";
  };

  const getCouponBadge = (couponId?: string) => {
    if (!couponId) return null;
    const coupon = couponMap[couponId];
    if (!coupon) return null;

    if (coupon.type === "free_tournament") {
      return (
        <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">
          Cortesia
        </Badge>
      );
    }
    if (coupon.type === "percentage") {
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
          {coupon.value}% OFF
        </Badge>
      );
    }
    if (coupon.type === "free_months") {
      return (
        <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
          {coupon.value} mes{coupon.value > 1 ? "es" : ""} gratis
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Finanzas</h1>
        <p className="text-muted-foreground mt-1">
          Resumen financiero de la plataforma
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Esperado este mes</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCOP(expectedMonthly)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recibido (completados)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">{formatCOP(received)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pendiente por cobrar</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-500">{formatCOP(pending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Torneos pagos</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{paidTournaments.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Active tournaments - expected revenue */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Torneos activos (ingreso mensual)</h2>
        {activePaid.length === 0 ? (
          <p className="text-muted-foreground text-sm">No hay torneos activos con plan pago</p>
        ) : (
          <div className="space-y-2">
            {activePaid.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between border rounded-lg p-4"
              >
                <div className="space-y-1">
                  <p className="font-medium">{t.name}</p>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span>{getOwnerName(t.createdBy)}</span>
                    <span>· {t.teamIds.length} equipos</span>
                    <Badge
                      className={
                        t.status === "in-progress"
                          ? "bg-green-500/10 text-green-500"
                          : "bg-blue-500/10 text-blue-500"
                      }
                    >
                      {t.status === "in-progress" ? "En Curso" : "Proximo"}
                    </Badge>
                    {getCouponBadge(t.couponId)}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">{formatCOP(t.monthlyCost || 0)}</p>
                  <p className="text-xs text-muted-foreground">/mes</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed tournaments - historical revenue */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Torneos completados (historial)</h2>
        {completedPaid.length === 0 ? (
          <p className="text-muted-foreground text-sm">No hay torneos completados</p>
        ) : (
          <div className="space-y-2">
            {completedPaid.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between border rounded-lg p-4 opacity-70"
              >
                <div className="space-y-1">
                  <p className="font-medium">{t.name}</p>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span>{getOwnerName(t.createdBy)}</span>
                    <span>· {t.teamIds.length} equipos</span>
                    <Badge className="bg-zinc-500/10 text-zinc-500">Completado</Badge>
                    {getCouponBadge(t.couponId)}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-green-500">{formatCOP(t.monthlyCost || 0)}</p>
                  <p className="text-xs text-green-600">Pagado</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminFinancesPage() {
  return (
    <AdminGuard>
      <FinancesContent />
    </AdminGuard>
  );
}
