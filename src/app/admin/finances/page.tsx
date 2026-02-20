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
import { formatCOP, TIER_LABELS } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";
import { CouponType, TournamentTier } from "@/types";

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

  const paidTournaments = tournaments.filter((t) => t.plan === "paid" && t.price);

  // Active = not completed (upcoming or in-progress)
  const activePaid = paidTournaments.filter((t) => t.status !== "completed");
  const completedPaid = paidTournaments.filter((t) => t.status === "completed");

  const totalRevenue = paidTournaments.reduce((sum, t) => sum + (t.price || 0), 0);
  const activeRevenue = activePaid.reduce((sum, t) => sum + (t.price || 0), 0);
  const completedRevenue = completedPaid.reduce((sum, t) => sum + (t.price || 0), 0);

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
    return null;
  };

  const getTierBadge = (tier?: TournamentTier) => {
    if (!tier) return null;
    return (
      <Badge variant="outline" className="text-xs">
        {TIER_LABELS[tier] || tier}
      </Badge>
    );
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
            <CardDescription>Ingresos totales</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCOP(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Torneos activos</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">{formatCOP(activeRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Torneos completados</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-muted-foreground">{formatCOP(completedRevenue)}</p>
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

      {/* Active tournaments */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Torneos activos</h2>
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
                    {getTierBadge(t.tier)}
                    {getCouponBadge(t.couponId)}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">{formatCOP(t.price || 0)}</p>
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
                    {getTierBadge(t.tier)}
                    {getCouponBadge(t.couponId)}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-green-500">{formatCOP(t.price || 0)}</p>
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
