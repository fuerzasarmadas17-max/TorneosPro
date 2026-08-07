"use client";

import { useEffect, useState } from "react";
import { AdminGuard } from "@/components/auth-guard";
import { useTournaments } from "@/context/tournament-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCOP, TIER_LABELS } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";
import { authHeader } from "@/lib/auth-header";
import { getSportInfo } from "@/data/sports";
import { CouponType, TournamentTier, Tournament } from "@/types";
import {
  Wallet,
  TrendingUp,
  CheckCircle2,
  Receipt,
  Users,
  Ticket,
  Search,
  X,
  Megaphone,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const TIER_ORDER: TournamentTier[] = ["basico", "medio", "pro", "premium"];

interface CouponInfo {
  id: string;
  code: string;
  type: CouponType;
  value: number;
}

interface AdPaymentRow {
  id: string;
  amount_cop: number;
  status: string;
  created_at: string;
  advertiser: string;
}

/** Tarjeta de KPI del encabezado (mismo patrón que Publicidad). */
function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg " +
            (accent || "bg-muted text-muted-foreground")
          }
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FinancesContent() {
  const { tournaments, isLoading } = useTournaments();
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [couponMap, setCouponMap] = useState<Record<string, CouponInfo>>({});

  // Filtros
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [sportFilter, setSportFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");

  useEffect(() => {
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

  const [adPayments, setAdPayments] = useState<AdPaymentRow[]>([]);
  useEffect(() => {
    supabase
      .from("ad_payments")
      .select("id, amount_cop, status, created_at, ad_campaigns(advertiser_name)")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        setAdPayments(
          data.map((row) => {
            const camp = row.ad_campaigns as
              | { advertiser_name?: string }
              | { advertiser_name?: string }[]
              | null;
            const advertiser = Array.isArray(camp)
              ? camp[0]?.advertiser_name
              : camp?.advertiser_name;
            return {
              id: row.id as string,
              amount_cop: row.amount_cop as number,
              status: row.status as string,
              created_at: row.created_at as string,
              advertiser: advertiser || "Publicidad",
            };
          })
        );
      });
  }, []);
  // "La escoba": revisa contra Wompi los pagos que quedaron en pending y
  // resuelve los que en realidad ya estaban aprobados. Es la tercera red,
  // detrás del navegador del cliente y del webhook — la que atrapa lo que a
  // esas dos se les escapa (ver src/lib/payments/sweep.ts).
  const [barriendo, setBarriendo] = useState(false);
  const barrerPagos = async () => {
    setBarriendo(true);
    try {
      const res = await fetch("/api/admin/payments/sweep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader()),
        },
        body: JSON.stringify({ diasAtras: 30 }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.error || "No pudimos revisar los pagos");
        return;
      }

      const torneos = data.torneosCreados?.length ?? 0;
      const pub = data.publicidadAprobada?.length ?? 0;

      if (torneos === 0 && pub === 0) {
        toast.success(
          `Revisados ${data.revisados} pagos. No había ninguno cobrado sin resolver.`
        );
      } else {
        const partes = [];
        if (torneos > 0) partes.push(`${torneos} torneo(s) recuperado(s)`);
        if (pub > 0) partes.push(`${pub} pago(s) de publicidad aprobado(s)`);
        toast.success(`${partes.join(" y ")}. Recargá para verlos.`);
      }

      if (data.errores?.length > 0) {
        toast.warning(`${data.errores.length} pago(s) necesitan revisión manual`);
        console.warn("Escoba — pagos con problemas:", data.errores);
      }
    } catch {
      toast.error("No pudimos revisar los pagos");
    } finally {
      setBarriendo(false);
    }
  };

  const adRevenue = adPayments
    .filter((p) => p.status === "approved")
    .reduce((s, p) => s + p.amount_cop, 0);
  // Los cancelados son links viejos superados, no pagos reales → no se listan.
  const visibleAdPayments = adPayments.filter((p) => p.status !== "canceled");

  const allPaid = tournaments.filter((t) => t.plan === "paid" && t.price);

  // Opciones de filtro derivadas de los datos (solo lo que existe).
  const years = [...new Set(allPaid.map((t) => new Date(t.createdAt).getFullYear()))].sort(
    (a, b) => b - a
  );
  const sportsPresent = [...new Set(allPaid.map((t) => t.sport))];
  const tiersPresent = TIER_ORDER.filter((tr) => allPaid.some((t) => t.tier === tr));

  const matchesFilters = (t: Tournament) => {
    if (sportFilter !== "all" && t.sport !== sportFilter) return false;
    if (tierFilter !== "all" && t.tier !== tierFilter) return false;
    if (
      yearFilter !== "all" &&
      String(new Date(t.createdAt).getFullYear()) !== yearFilter
    )
      return false;
    const q = search.trim().toLowerCase();
    if (q) {
      const owner = (ownerNames[t.createdBy] || "").toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !owner.includes(q)) return false;
    }
    return true;
  };

  const filtersActive =
    !!search.trim() ||
    sportFilter !== "all" ||
    tierFilter !== "all" ||
    yearFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setSportFilter("all");
    setTierFilter("all");
    setYearFilter("all");
  };

  const paidTournaments = allPaid.filter(matchesFilters);
  const activePaid = paidTournaments.filter((t) => t.status !== "completed");
  const completedPaid = paidTournaments.filter((t) => t.status === "completed");

  // Sugerencias del buscador (autocompletar). Coincidencia por substring
  // (%palabra%) en el nombre del torneo o del organizador. Respeta también los
  // otros filtros (deporte/tier/año) para no sugerir algo que quedaría oculto.
  const searchSuggestions = (() => {
    const q = search.trim().toLowerCase();
    const seen = new Set<string>();
    const out: Tournament[] = [];
    for (const t of allPaid) {
      if (sportFilter !== "all" && t.sport !== sportFilter) continue;
      if (tierFilter !== "all" && t.tier !== tierFilter) continue;
      if (
        yearFilter !== "all" &&
        String(new Date(t.createdAt).getFullYear()) !== yearFilter
      )
        continue;
      const owner = (ownerNames[t.createdBy] || "").toLowerCase();
      if (q && !t.name.toLowerCase().includes(q) && !owner.includes(q)) continue;
      if (seen.has(t.name)) continue;
      seen.add(t.name);
      out.push(t);
      if (out.length >= 8) break;
    }
    return out;
  })();

  // OJO: `price` NO significa lo mismo según cómo se creó el torneo.
  //  - Pagado por Wompi (con o sin cupón %): el torneo lo crea el webhook con
  //    `price = payment.amount_cop`, o sea LO QUE REALMENTE ENTRÓ, con el
  //    descuento ya aplicado (ver lib/payments/fulfill.ts).
  //  - Cortesía (free_tournament): no hay pago; el torneo lo crea el cliente
  //    con el precio de LISTA (ver forms/create-tournament-form.tsx).
  // Por eso al ingreso solo hay que tocarlo en el caso cortesía: descontar el
  // porcentaje otra vez cobraba el descuento dos veces.
  const revenueOf = (t: Tournament) => {
    const c = t.couponId ? couponMap[t.couponId] : undefined;
    if (c?.type === "free_tournament") return 0; // se regaló
    return t.price || 0; // ya es el monto cobrado
  };

  // Precio de lista, para mostrar tachado el "antes" del descuento. En el caso
  // del cupón % hay que reconstruirlo desde lo pagado: 110.500 con 15% OFF
  // salió de 130.000.
  const listPriceOf = (t: Tournament) => {
    const paid = t.price || 0;
    const c = t.couponId ? couponMap[t.couponId] : undefined;
    if (c?.type === "percentage" && c.value > 0 && c.value < 100) {
      return Math.round((paid * 100) / (100 - c.value));
    }
    return paid; // sin cupón, o cortesía (ahí `price` ya es el de lista)
  };
  const hasDiscount = (t: Tournament) => revenueOf(t) < listPriceOf(t);

  const totalRevenue = paidTournaments.reduce((sum, t) => sum + revenueOf(t), 0);
  const activeRevenue = activePaid.reduce((sum, t) => sum + revenueOf(t), 0);
  const completedRevenue = completedPaid.reduce((sum, t) => sum + revenueOf(t), 0);

  // Total rebajado a organizadores (cortesías + descuentos %), que no es ingreso.
  const discountGiven = paidTournaments.reduce(
    (s, t) => s + (listPriceOf(t) - revenueOf(t)),
    0
  );

  const getOwnerName = (userId: string) => ownerNames[userId] || "Cargando...";

  const getCouponBadge = (couponId?: string) => {
    if (!couponId) return null;
    const coupon = couponMap[couponId];
    if (!coupon) return null;
    if (coupon.type === "free_tournament") {
      return (
        <Badge className="gap-1 bg-purple-500/10 text-purple-600 border-purple-500/20">
          <Ticket className="h-3 w-3" />
          Cortesia
        </Badge>
      );
    }
    if (coupon.type === "percentage") {
      return (
        <Badge className="gap-1 bg-amber-500/10 text-amber-600 border-amber-500/20">
          <Ticket className="h-3 w-3" />
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

  const statusBadge = (status: Tournament["status"]) => {
    if (status === "in-progress")
      return (
        <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/20">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
          </span>
          En curso
        </Badge>
      );
    if (status === "completed")
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Completado
        </Badge>
      );
    return (
      <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Próximo</Badge>
    );
  };

  const adStatusBadge = (status: string) => {
    if (status === "approved")
      return (
        <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle2 className="h-3 w-3" />
          Pagado
        </Badge>
      );
    if (status === "pending")
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
          Pendiente
        </Badge>
      );
    if (status === "canceled")
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Cancelado
        </Badge>
      );
    return (
      <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Rechazado</Badge>
    );
  };

  const TournamentRow = ({ t, muted }: { t: Tournament; muted?: boolean }) => {
    const emoji = getSportInfo(t.sport)?.emoji ?? "🏆";
    const income = revenueOf(t);
    return (
      <Card className={muted ? "opacity-80" : undefined}>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-xl">
            {emoji}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold truncate">{t.name}</span>
              {statusBadge(t.status)}
              {getTierBadge(t.tier)}
              {getCouponBadge(t.couponId)}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="truncate">{getOwnerName(t.createdBy)}</span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {t.teamIds.length} equipos
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <p
              className={
                "text-lg font-bold " +
                (income === 0
                  ? "text-muted-foreground"
                  : muted
                    ? "text-green-600"
                    : "")
              }
            >
              {formatCOP(income)}
            </p>
            {hasDiscount(t) && (
              <p className="text-[11px] text-muted-foreground line-through">
                {formatCOP(listPriceOf(t))}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wallet className="h-7 w-7" />
            Finanzas
          </h1>
          <p className="text-muted-foreground mt-1">
            Resumen financiero de la plataforma
          </p>
        </div>
        <Button
          variant="outline"
          onClick={barrerPagos}
          disabled={barriendo}
          className="shrink-0"
          title="Revisa contra Wompi los pagos que quedaron pendientes y crea los torneos que se hayan cobrado"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${barriendo ? "animate-spin" : ""}`}
          />
          {barriendo ? "Revisando..." : "Revisar pagos pendientes"}
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 120)}
              placeholder="Buscar torneo u organizador..."
              className="h-9 pl-9 pr-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {searchFocused && searchSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md">
                {searchSuggestions.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    // onMouseDown corre antes del blur del input → alcanza a fijar
                    // la selección antes de que se cierre el dropdown.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSearch(t.name);
                      setSearchFocused(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span className="text-base">
                      {getSportInfo(t.sport)?.emoji ?? "🏆"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{t.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {ownerNames[t.createdBy] || "—"}
                      </span>
                    </span>
                    <span className="flex-shrink-0 text-xs font-medium text-muted-foreground">
                      {formatCOP(revenueOf(t))}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={sportFilter} onValueChange={setSportFilter}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="Deporte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los deportes</SelectItem>
                {sportsPresent.map((s) => (
                  <SelectItem key={s} value={s}>
                    {getSportInfo(s)?.emoji} {getSportInfo(s)?.label ?? s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="h-9 w-[120px]">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tiers</SelectItem>
                {tiersPresent.map((tr) => (
                  <SelectItem key={tr} value={tr}>
                    {TIER_LABELS[tr] ?? tr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="h-9 w-[110px]">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo el tiempo</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 text-muted-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label={filtersActive ? "Ingresos (filtrado)" : "Ingresos totales"}
          value={formatCOP(totalRevenue)}
          icon={Wallet}
          accent="bg-primary/10 text-primary"
        />
        <StatCard
          label="En torneos activos"
          value={formatCOP(activeRevenue)}
          icon={TrendingUp}
          accent="bg-green-500/10 text-green-600"
        />
        <StatCard
          label="En completados"
          value={formatCOP(completedRevenue)}
          icon={CheckCircle2}
          accent="bg-blue-500/10 text-blue-600"
        />
        <StatCard
          label="Torneos pagos"
          value={paidTournaments.length}
          icon={Receipt}
          accent="bg-violet-500/10 text-violet-600"
        />
      </div>

      {discountGiven > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Ticket className="h-3.5 w-3.5 text-purple-500" />
          {formatCOP(discountGiven)} en descuentos otorgados a organizadores (no
          cuenta como ingreso)
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/50" />
          ))}
        </div>
      ) : (
        <>
          {/* Active tournaments */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-semibold">Torneos activos</h2>
              {activePaid.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {activePaid.length} · {formatCOP(activeRevenue)}
                </span>
              )}
            </div>
            {activePaid.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <TrendingUp className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {filtersActive
                      ? "Ningún torneo activo coincide con los filtros"
                      : "No hay torneos activos con plan pago"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {activePaid.map((t) => (
                  <TournamentRow key={t.id} t={t} />
                ))}
              </div>
            )}
          </div>

          {/* Completed tournaments */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-semibold">
                Torneos completados{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  (historial)
                </span>
              </h2>
              {completedPaid.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {completedPaid.length} · {formatCOP(completedRevenue)}
                </span>
              )}
            </div>
            {completedPaid.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {filtersActive
                      ? "Ningún torneo completado coincide con los filtros"
                      : "No hay torneos completados"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {completedPaid.map((t) => (
                  <TournamentRow key={t.id} t={t} muted />
                ))}
              </div>
            )}
          </div>

          {/* Publicidad */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Megaphone className="h-5 w-5" />
                Publicidad
              </h2>
              {adRevenue > 0 && (
                <span className="text-sm text-muted-foreground">
                  {formatCOP(adRevenue)} cobrado
                </span>
              )}
            </div>
            {visibleAdPayments.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Megaphone className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No hay pagos de publicidad todavía
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {visibleAdPayments.map((p) => (
                  <Card key={p.id}>
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Megaphone className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold truncate">{p.advertiser}</span>
                          {adStatusBadge(p.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString("es-CO")}
                        </p>
                      </div>
                      <p
                        className={
                          "flex-shrink-0 text-lg font-bold " +
                          (p.status === "approved" ? "text-green-600" : "text-muted-foreground")
                        }
                      >
                        {formatCOP(p.amount_cop)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
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
