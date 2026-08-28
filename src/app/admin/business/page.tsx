"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/auth-guard";
import { useTournaments } from "@/context/tournament-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatCard } from "@/components/ui/stat-card";
import { formatCOP, TIER_LABELS } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";
import { getSportInfo } from "@/data/sports";
import { TournamentTier, Tournament } from "@/types";
import {
  AnalyticsInsights,
  growthInsight,
  type Insight,
} from "@/components/analytics/analytics-insights";
import {
  Wallet,
  Receipt,
  Ticket,
  AlertTriangle,
  Repeat,
  Users,
  Megaphone,
  TrendingUp,
  Timer,
  CheckCircle2,
  Trophy,
  ArrowUp,
  ArrowDown,
  Calendar,
  type LucideIcon,
} from "lucide-react";

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

interface Sale {
  tournamentId: string | null;
  amount: number;
  ts: number;
  userId: string;
  isPack: boolean;
}

/** Chip de variación ▲/▼ vs período anterior. */
function DeltaChip({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    if (current === 0) return null;
    return (
      <span className="inline-flex items-center rounded-full bg-green-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-green-600">
        nuevo
      </span>
    );
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0)
    return <span className="text-[11px] text-muted-foreground">sin cambio</span>;
  const up = pct > 0;
  return (
    <span
      className={
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold " +
        (up ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600")
      }
    >
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(pct)}%
    </span>
  );
}

/** Tarjeta de KPI con variación vs período anterior. */
function DeltaStat({
  icon: Icon,
  label,
  value,
  current,
  previous,
  accent = "bg-muted text-muted-foreground",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  current: number;
  previous: number;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-5">
        <div className="flex items-center gap-3">
          <div className={"flex size-9 shrink-0 items-center justify-center rounded-lg " + accent}>
            <Icon className="size-4" />
          </div>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <DeltaChip current={current} previous={previous} />
      </CardContent>
    </Card>
  );
}

const TIER_ORDER: TournamentTier[] = ["basico", "medio", "pro", "premium"];
const DAY_MS = 1000 * 60 * 60 * 24;

interface BRow {
  key: string;
  label: string;
  emoji?: string;
  main: string;
  sub?: string;
  ratio: number;
}

function BreakdownRow({ r }: { r: BRow }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate">
          {r.emoji && <span className="mr-1">{r.emoji}</span>}
          {r.label}
        </span>
        <span className="flex items-baseline gap-2 whitespace-nowrap tabular-nums">
          <span className="font-semibold">{r.main}</span>
          {r.sub && (
            <span className="text-xs font-normal text-muted-foreground">· {r.sub}</span>
          )}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary/70"
          style={{ width: `${Math.max(r.ratio * 100, 2)}%` }}
        />
      </div>
    </div>
  );
}

const PREVIEW = 5; // cuántos se ven en la tarjeta
const PAGE = 20; // cuántos carga el modal por tanda

/** Desglose con barras: muestra 5 y, si hay más, un modal que carga de 20 en 20. */
function Breakdown({ title, rows }: { title: string; rows: BRow[] }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(PAGE);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin datos</p>;
  }

  return (
    <>
      <div className="space-y-3">
        {rows.slice(0, PREVIEW).map((r) => (
          <BreakdownRow key={r.key} r={r} />
        ))}
      </div>
      {rows.length > PREVIEW && (
        <button
          type="button"
          onClick={() => {
            setShown(PAGE);
            setOpen(true);
          }}
          className="mt-3 text-sm font-medium text-primary hover:underline"
        >
          Ver más ({rows.length})
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[80vh] flex-col">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="-mr-2 space-y-3 overflow-y-auto pr-2">
            {rows.slice(0, shown).map((r) => (
              <BreakdownRow key={r.key} r={r} />
            ))}
          </div>
          {shown < rows.length && (
            <button
              type="button"
              onClick={() => setShown((s) => s + PAGE)}
              className="mt-1 shrink-0 self-start text-sm font-medium text-primary hover:underline"
            >
              Cargar más ({rows.length - shown} restantes)
            </button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function BusinessContent() {
  const { tournaments, isLoading } = useTournaments();
  const [sales, setSales] = useState<Sale[]>([]);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [adRevenue, setAdRevenue] = useState(0);
  /** Créditos de paquete vendidos y todavía sin usar: la deuda en servicio. */
  const [openCredits, setOpenCredits] = useState({ count: 0, valueCop: 0 });
  // La hora "ahora" se fija en el callback async del fetch (no en render, que
  // debe ser puro; ni en un effect síncrono).
  const [now, setNow] = useState(0);

  // Ventas = pagos aprobados (Wompi). `amount_cop` ya viene neto de cupón, así
  // que es lo efectivamente cobrado. Guardamos fecha y usuario para tendencias.
  useEffect(() => {
    supabase
      .from("payments")
      .select("tournament_id, amount_cop, created_at, user_id, reference")
      .eq("status", "approved")
      .then(({ data }) => {
        setNow(Date.now());
        if (!data) return;
        setSales(
          data.map((row) => ({
            tournamentId: (row.tournament_id as string | null) ?? null,
            amount: row.amount_cop as number,
            ts: new Date(row.created_at as string).getTime(),
            userId: row.user_id as string,
            // Los paquetes se distinguen por el prefijo de la referencia. Es
            // más barato que traer `tournament_data` entero solo para leerle
            // el tipo.
            isPack: String(row.reference ?? "").startsWith("PAQUETE-"),
          }))
        );
      });
  }, []);

  // Nombres de organizadores (para el ranking de LTV).
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
          const profiles = row.organization_profiles as
            | Array<{ organization_name: string }>
            | null;
          const orgName =
            profiles && profiles.length > 0 ? profiles[0].organization_name : null;
          map[row.id] = orgName || row.name || "Desconocido";
        }
        setOwnerNames(map);
      });
  }, [tournaments]);

  // Ingreso por publicidad (pagos aprobados).
  useEffect(() => {
    supabase
      .from("ad_payments")
      .select("amount_cop, status")
      .eq("status", "approved")
      .then(({ data }) => {
        if (!data) return;
        setAdRevenue(data.reduce((s, r) => s + (r.amount_cop as number), 0));
      });
  }, []);

  // Créditos de paquete sin consumir.
  //
  // Es el único indicador de esta pantalla que NO es ingreso: es lo contrario.
  // Un paquete se cobra completo el día que entra, pero deja torneos debidos.
  // Sin este número, esa caja se ve como ganancia y es fácil gastarla.
  useEffect(() => {
    supabase
      .from("tournament_credits")
      .select("value_cop, consumed_at, expires_at")
      .is("consumed_at", null)
      .then(({ data }) => {
        if (!data) return;
        const vivos = data.filter(
          (r) => new Date(r.expires_at as string) > new Date()
        );
        setOpenCredits({
          count: vivos.length,
          valueCop: vivos.reduce((s, r) => s + ((r.value_cop as number) ?? 0), 0),
        });
      });
  }, []);

  const m = useMemo(() => {
    // Ingreso atribuible a un torneo concreto: lo que Wompi aprobó por él.
    const paymentMap = new Map<string, number>();
    for (const s of sales) {
      if (!s.tournamentId) continue;
      paymentMap.set(s.tournamentId, (paymentMap.get(s.tournamentId) || 0) + s.amount);
    }
    const revenueOf = (t: Tournament) => paymentMap.get(t.id) || 0;

    // "Pagos" = torneos con al menos un pago aprobado (revenue real > 0).
    const paid = tournaments.filter((t) => revenueOf(t) > 0);
    const perTournamentRevenue = paid.reduce((s, t) => s + revenueOf(t), 0);

    // Pagos SIN torneo asociado: hoy son los paquetes de créditos, que se cobran
    // una vez y después se convierten en varios torneos.
    //
    // Antes se descartaban en silencio: la gráfica mensual los sumaba (usa
    // `sales` completo) pero esta tarjeta no, así que la misma pantalla mostraba
    // dos cifras distintas del mismo dinero sin dar ningún error.
    //
    // Se cuentan al COBRAR y no se reparten entre los torneos que después salgan
    // del paquete (decisión 2026-08-07). Repartirlos además de contarlos acá
    // sería contar la misma plata dos veces.
    const packRevenue = sales
      .filter((s) => !s.tournamentId && s.isPack)
      .reduce((sum, s) => sum + s.amount, 0);

    // Pagos de TORNEO que quedaron sin su torneo. No son paquetes: son plata
    // cobrada cuyo torneo nunca se creó — la falla que la escoba viene a
    // rescatar. Suman al ingreso (entraron de verdad) pero se muestran aparte,
    // porque cada peso acá es un cliente que pagó y no recibió nada.
    const orphanSales = sales.filter((s) => !s.tournamentId && !s.isPack);
    const orphanRevenue = orphanSales.reduce((sum, s) => sum + s.amount, 0);

    const totalRevenue = perTournamentRevenue + packRevenue + orphanRevenue;

    // El ticket promedio se calcula sobre los torneos pagados uno a uno: meter
    // un paquete de $320.000 como si fuera una venta más inflaría el promedio
    // y dejaría de servir para saber cuánto vale un torneo.
    const ticketAvg = paid.length
      ? Math.round(perTournamentRevenue / paid.length)
      : 0;

    // Ingresos por deporte
    const bySport = new Map<string, { count: number; rev: number }>();
    for (const t of paid) {
      const cur = bySport.get(t.sport) || { count: 0, rev: 0 };
      cur.count += 1;
      cur.rev += revenueOf(t);
      bySport.set(t.sport, cur);
    }
    const sportRows = [...bySport.entries()]
      .map(([sport, v]) => ({ sport, ...v }))
      .sort((a, b) => b.rev - a.rev);
    const maxSportRev = Math.max(1, ...sportRows.map((r) => r.rev));

    // Ingresos por tier
    const tierRows = TIER_ORDER.map((tier) => {
      const items = paid.filter((t) => t.tier === tier);
      return { tier, count: items.length, rev: items.reduce((s, t) => s + revenueOf(t), 0) };
    }).filter((r) => r.count > 0);
    const maxTierRev = Math.max(1, ...tierRows.map((r) => r.rev));

    // Mix de torneos por deporte (todos, no solo pagos)
    const mixMap = new Map<string, number>();
    for (const t of tournaments) mixMap.set(t.sport, (mixMap.get(t.sport) || 0) + 1);
    const mixRows = [...mixMap.entries()]
      .map(([sport, count]) => ({ sport, count }))
      .sort((a, b) => b.count - a.count);
    const maxMix = Math.max(1, ...mixRows.map((r) => r.count));

    // Duración promedio por deporte (según fechas planeadas start→end)
    const durMap = new Map<string, { sum: number; n: number }>();
    for (const t of tournaments) {
      if (!t.endDate || !t.startDate) continue;
      const days = (new Date(t.endDate).getTime() - new Date(t.startDate).getTime()) / DAY_MS;
      if (days < 0) continue;
      const cur = durMap.get(t.sport) || { sum: 0, n: 0 };
      cur.sum += days;
      cur.n += 1;
      durMap.set(t.sport, cur);
    }
    const durRows = [...durMap.entries()]
      .map(([sport, v]) => ({ sport, avg: v.sum / v.n, n: v.n }))
      .sort((a, b) => b.avg - a.avg);
    const maxDur = Math.max(1, ...durRows.map((r) => r.avg));

    // Recurrencia de organizadores (sobre compras = torneos pagos)
    const paidByOrg = new Map<string, Tournament[]>();
    for (const t of paid) {
      const arr = paidByOrg.get(t.createdBy) || [];
      arr.push(t);
      paidByOrg.set(t.createdBy, arr);
    }
    const payingOrgs = [...paidByOrg.keys()];
    const avgPerOrg = payingOrgs.length ? paid.length / payingOrgs.length : 0;
    const arpo = payingOrgs.length ? Math.round(totalRevenue / payingOrgs.length) : 0;

    // RECOMPRA = volvió a COMPRAR, no volvió a crear torneos.
    //
    // Antes se contaba sobre torneos pagos, lo que con paquetes miente en las
    // dos direcciones: quien compra un paquete y quema 5 créditos parecería
    // fidelísimo habiendo comprado UNA vez, y quien compró 4 torneos sueltos en
    // una sola sentada aparecía como recompra sin haber vuelto nunca.
    //
    // La pregunta que importa es "¿volvió después de terminar lo que compró?",
    // y eso solo se ve contando eventos de compra separados en el tiempo.
    const purchasesByOrg = new Map<string, number[]>();
    for (const sale of sales) {
      const arr = purchasesByOrg.get(sale.userId) || [];
      arr.push(sale.ts);
      purchasesByOrg.set(sale.userId, arr);
    }
    const buyerOrgs = [...purchasesByOrg.keys()];
    // Dos compras el mismo día son una sola decisión de compra, no una
    // recompra: es el caso del organizador que arma varios torneos de una
    // sentada. Se agrupan por día.
    const purchaseDaysOf = (userId: string) =>
      new Set(
        (purchasesByOrg.get(userId) || []).map((ts) =>
          new Date(ts).toISOString().slice(0, 10)
        )
      );
    const repeatBuyers = buyerOrgs.filter((o) => purchaseDaysOf(o).size >= 2);
    const repeatRate = buyerOrgs.length
      ? repeatBuyers.length / buyerOrgs.length
      : 0;

    // Tiempo promedio entre COMPRAS (organizadores que compraron en 2+ días).
    // Antes medía entre creaciones de torneo, y por eso daba 2 días: el
    // organizador que armó 4 torneos en una tarde. Eso no es cadencia de
    // recompra, es una sola compra partida en cuatro.
    const orgGaps: number[] = [];
    for (const o of repeatBuyers) {
      const dates = [...purchaseDaysOf(o)]
        .map((d) => new Date(d).getTime())
        .sort((a, b) => a - b);
      let sum = 0;
      for (let i = 1; i < dates.length; i++) sum += (dates[i] - dates[i - 1]) / DAY_MS;
      orgGaps.push(sum / (dates.length - 1));
    }
    const avgGapDays = orgGaps.length
      ? Math.round(orgGaps.reduce((s, g) => s + g, 0) / orgGaps.length)
      : null;

    // Top organizadores por ingreso (LTV líderes)
    const topOrgs = payingOrgs
      .map((o) => ({
        id: o,
        rev: (paidByOrg.get(o) || []).reduce((s, t) => s + revenueOf(t), 0),
        n: paidByOrg.get(o)?.length || 0,
      }))
      .sort((a, b) => b.rev - a.rev);
    const maxOrgRev = Math.max(1, ...topOrgs.map((r) => r.rev));

    // Tasa de finalización
    const completed = tournaments.filter((t) => t.status === "completed").length;
    const completionRate = tournaments.length ? completed / tournaments.length : 0;

    // --- Tendencia temporal (según fecha de pago). `now` viene de estado. ---
    const D30 = 30 * DAY_MS;
    const sum = (arr: Sale[]) => arr.reduce((a, s) => a + s.amount, 0);
    const salesCur = now ? sales.filter((s) => s.ts >= now - D30) : [];
    const salesPrev = now
      ? sales.filter((s) => s.ts >= now - 2 * D30 && s.ts < now - D30)
      : [];
    const revCur = sum(salesCur);
    const revPrev = sum(salesPrev);
    const ticketCur = salesCur.length ? Math.round(revCur / salesCur.length) : 0;
    const ticketPrev = salesPrev.length ? Math.round(revPrev / salesPrev.length) : 0;

    // Organizadores nuevos (primera venta) en los últimos 30 días
    const firstSaleByUser = new Map<string, number>();
    for (const s of sales) {
      const prevTs = firstSaleByUser.get(s.userId);
      if (prevTs === undefined || s.ts < prevTs) firstSaleByUser.set(s.userId, s.ts);
    }
    const newOrgs30d = now
      ? [...firstSaleByUser.values()].filter((ts) => ts >= now - D30).length
      : 0;

    // Serie mensual de ingresos (últimos 12 meses)
    const monthKeys: { key: string; label: string }[] = [];
    if (now) {
      const anchor = new Date(now);
      for (let i = 11; i >= 0; i--) {
        const md = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
        monthKeys.push({
          key: `${md.getFullYear()}-${md.getMonth()}`,
          label: MONTHS_ES[md.getMonth()],
        });
      }
    }
    const monthAmount = new Map<string, number>();
    for (const s of sales) {
      const sd = new Date(s.ts);
      const k = `${sd.getFullYear()}-${sd.getMonth()}`;
      monthAmount.set(k, (monthAmount.get(k) || 0) + s.amount);
    }
    const monthly = monthKeys.map((mk) => ({ label: mk.label, amount: monthAmount.get(mk.key) || 0 }));
    const maxMonth = Math.max(1, ...monthly.map((mm) => mm.amount));
    const topSport = sportRows[0] ?? null;

    return {
      revCur,
      revPrev,
      countCur: salesCur.length,
      countPrev: salesPrev.length,
      ticketCur,
      ticketPrev,
      newOrgs30d,
      monthly,
      maxMonth,
      topSport,
      totalRevenue,
      packRevenue,
      orphanRevenue,
      orphanCount: orphanSales.length,
      ticketAvg,
      paidCount: paid.length,
      sportRows,
      maxSportRev,
      tierRows,
      maxTierRev,
      mixRows,
      maxMix,
      durRows,
      maxDur,
      payingOrgsCount: payingOrgs.length,
      avgPerOrg,
      repeatRate,
      arpo,
      avgGapDays,
      topOrgs,
      maxOrgRev,
      completionRate,
      totalTournaments: tournaments.length,
    };
  }, [tournaments, sales, now]);

  const sportLabel = (s: string) => getSportInfo(s)?.label ?? s;
  const sportEmoji = (s: string) => getSportInfo(s)?.emoji ?? "🏆";
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <TrendingUp className="h-7 w-7" />
          Métricas de negocio
        </h1>
        <p className="text-muted-foreground mt-1">
          Inteligencia sobre ingresos, recurrencia y comportamiento. Histórico completo.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/50" />
          ))}
        </div>
      ) : (
        <>
          {/* Insights de negocio */}
          {(() => {
            const insights = [
              growthInsight(m.revCur, m.revPrev, "ingresos"),
              m.topSport && m.totalRevenue > 0
                ? {
                    emoji: "🏅",
                    text: `${sportLabel(m.topSport.sport)} genera el ${Math.round(
                      (m.topSport.rev / m.totalRevenue) * 100
                    )}% de tus ingresos`,
                  }
                : null,
              m.newOrgs30d > 0
                ? {
                    emoji: "🆕",
                    text: `${m.newOrgs30d} organizador${m.newOrgs30d === 1 ? "" : "es"} nuevo${
                      m.newOrgs30d === 1 ? "" : "s"
                    } en los últimos 30 días`,
                  }
                : null,
            ].filter(Boolean) as Insight[];
            return <AnalyticsInsights insights={insights} />;
          })()}

          {/* Últimos 30 días (con variación) */}
          <div>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              Últimos 30 días{" "}
              <span className="text-muted-foreground/60">vs 30 previos</span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <DeltaStat
                icon={Wallet}
                label="Ingreso por torneos"
                value={formatCOP(m.revCur)}
                current={m.revCur}
                previous={m.revPrev}
                accent="bg-primary/10 text-primary"
              />
              <DeltaStat
                icon={Receipt}
                label="Ventas"
                value={String(m.countCur)}
                current={m.countCur}
                previous={m.countPrev}
              />
              <DeltaStat
                icon={TrendingUp}
                label="Ticket promedio"
                value={formatCOP(m.ticketCur)}
                current={m.ticketCur}
                previous={m.ticketPrev}
                accent="bg-blue-500/10 text-blue-600"
              />
            </div>
          </div>

          {/* Ingresos por mes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="size-4" /> Ingresos por mes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* El monto va escrito sobre la barra y no solo en el `title`.
                  Con la mayoría de los meses en cero, un gráfico sin números se
                  lee como si no tuviera datos: las barras vacías son una línea
                  de 2px y las que sí tienen no dicen cuánto. */}
              {/* SIN `items-end`: con esa clase cada columna se dimensiona por
                  su contenido, y entonces el `height: X%` de la barra no tiene
                  contra qué calcularse y colapsa a cero — el gráfico se veía
                  solo con las etiquetas de los meses. Estirando las columnas a
                  los 144px del contenedor, el porcentaje vuelve a tener
                  referencia; `justify-end` en cada columna es lo que apoya la
                  barra en la base. */}
              <div className="flex h-36 gap-1.5">
                {m.monthly.map((mm, i) => (
                  <div
                    key={i}
                    className="group flex flex-1 flex-col items-center justify-end gap-1"
                    title={`${mm.label}: ${formatCOP(mm.amount)}`}
                  >
                    {mm.amount > 0 && (
                      <span className="text-[9px] font-medium tabular-nums text-muted-foreground">
                        {Math.round(mm.amount / 1000)}k
                      </span>
                    )}
                    <div
                      className={
                        mm.amount > 0
                          ? "w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
                          : "w-full rounded-t bg-muted"
                      }
                      style={{
                        height: `${Math.max((mm.amount / m.maxMonth) * 100, 2)}%`,
                      }}
                    />
                    <span className="text-[10px] text-muted-foreground">{mm.label}</span>
                  </div>
                ))}
              </div>
              {m.monthly.every((mm) => mm.amount === 0) && (
                <p className="pt-3 text-center text-xs text-muted-foreground">
                  Sin ingresos en los últimos 12 meses.
                </p>
              )}
            </CardContent>
          </Card>

          <h2 className="pt-2 text-sm font-medium text-muted-foreground">
            Histórico completo
          </h2>

          {m.orphanCount > 0 && (
            <Card className="border-red-500/30 bg-red-500/5">
              <CardContent className="flex flex-wrap items-center gap-3 py-4">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600" />
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-red-700 dark:text-red-400">
                    {m.orphanCount} pago{m.orphanCount === 1 ? "" : "s"} sin
                    torneo · {formatCOP(m.orphanRevenue)}
                  </p>
                  <p className="text-muted-foreground">
                    Alguien pagó y su torneo nunca se creó. En Finanzas, el
                    botón de rescatar pagos los reconstruye a partir de lo que
                    quedó guardado del checkout.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              icon={Receipt}
              label="Ticket promedio"
              value={formatCOP(m.ticketAvg)}
              hint={`${m.paidCount} torneos pagos`}
              accent="blue"
            />
            <StatCard
              icon={Wallet}
              label="Ingreso por torneos"
              value={formatCOP(m.totalRevenue)}
              hint={
                m.packRevenue > 0
                  ? `incluye ${formatCOP(m.packRevenue)} en paquetes`
                  : "neto de descuentos"
              }
            />
            <StatCard
              icon={Megaphone}
              label="Ingreso por publicidad"
              value={formatCOP(adRevenue)}
              hint="pagos aprobados"
              accent="amber"
            />
            {openCredits.count > 0 && (
              <StatCard
                icon={Ticket}
                label="Crédito sin usar"
                value={`${openCredits.count} torneo${openCredits.count === 1 ? "" : "s"}`}
                hint={`${formatCOP(openCredits.valueCop)} ya cobrados y debidos`}
                accent="amber"
              />
            )}
            <StatCard
              icon={Users}
              label="Ingreso por organizador"
              value={formatCOP(m.arpo)}
              hint={`${m.payingOrgsCount} organizadores pagos`}
              accent="blue"
            />
            <StatCard
              icon={Repeat}
              label="Tasa de recompra"
              value={pct(m.repeatRate)}
              hint={`volvieron a comprar · ${m.avgPerOrg.toFixed(1)} torneos/organizador`}
              accent="green"
            />
            <StatCard
              icon={Timer}
              label="Entre compras"
              value={m.avgGapDays != null ? `${m.avgGapDays} días` : "—"}
              hint="cuánto tardan en volver"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Ingresos por deporte */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Ingresos por deporte
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    (torneos pagados uno a uno)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Breakdown
                  title="Ingresos por deporte"
                  rows={m.sportRows.map((r) => ({
                    key: r.sport,
                    label: sportLabel(r.sport),
                    emoji: sportEmoji(r.sport),
                    main: formatCOP(r.rev),
                    sub: `${r.count}`,
                    ratio: r.rev / m.maxSportRev,
                  }))}
                />
              </CardContent>
            </Card>

            {/* Ingresos por tier */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Ingresos por plan (tier)
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    (torneos pagados uno a uno)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Breakdown
                  title="Ingresos por plan (tier)"
                  rows={m.tierRows.map((r) => ({
                    key: r.tier,
                    label: TIER_LABELS[r.tier] ?? r.tier,
                    main: formatCOP(r.rev),
                    sub: `${r.count}`,
                    ratio: r.rev / m.maxTierRev,
                  }))}
                />
              </CardContent>
            </Card>

            {/* Top organizadores por ingreso */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top organizadores (ingreso)</CardTitle>
              </CardHeader>
              <CardContent>
                <Breakdown
                  title="Top organizadores (ingreso)"
                  rows={m.topOrgs.map((r) => ({
                    key: r.id,
                    label: ownerNames[r.id] || "Cargando…",
                    main: formatCOP(r.rev),
                    sub: `${r.n} torneos`,
                    ratio: r.rev / m.maxOrgRev,
                  }))}
                />
              </CardContent>
            </Card>

            {/* Duración de torneos por deporte */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Duración por deporte</CardTitle>
              </CardHeader>
              <CardContent>
                <Breakdown
                  title="Duración por deporte"
                  rows={m.durRows.map((r) => ({
                    key: r.sport,
                    label: sportLabel(r.sport),
                    emoji: sportEmoji(r.sport),
                    main: `${Math.round(r.avg)} días`,
                    sub: `${r.n}`,
                    ratio: r.avg / m.maxDur,
                  }))}
                />
              </CardContent>
            </Card>

            {/* Mix de torneos por deporte */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mix de torneos por deporte</CardTitle>
              </CardHeader>
              <CardContent>
                <Breakdown
                  title="Mix de torneos por deporte"
                  rows={m.mixRows.map((r) => ({
                    key: r.sport,
                    label: sportLabel(r.sport),
                    emoji: sportEmoji(r.sport),
                    main: `${r.count}`,
                    ratio: r.count / m.maxMix,
                  }))}
                />
              </CardContent>
            </Card>

            {/* Salud operativa */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Salud operativa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-green-500/10 text-green-600">
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tasa de finalización</p>
                    <p className="text-xl font-bold">{pct(m.completionRate)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Trophy className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Torneos totales</p>
                    <p className="text-xl font-bold">{m.totalTournaments}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground">
            Ingresos = solo pagos aprobados (Wompi), lo efectivamente cobrado. Puede
            diferir de Finanzas, que estima sobre el precio ajustado por cupón. La
            duración usa las fechas planeadas (inicio → fin) de cada torneo.
          </p>
        </>
      )}
    </div>
  );
}

export default function AdminBusinessPage() {
  return (
    <AdminGuard>
      <BusinessContent />
    </AdminGuard>
  );
}
