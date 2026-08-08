"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { AdminGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { authHeader } from "@/lib/auth-header";
import {
  resizeImageForUpload,
  IMAGE_SIZES,
  MAX_UPLOAD_BYTES,
  isImageFile,
} from "@/lib/images";
import { toast } from "sonner";
import {
  Trash2,
  Plus,
  Megaphone,
  Eye,
  MousePointerClick,
  Upload,
  Power,
  X,
  Radio,
  Target,
  ListChecks,
  ImageIcon,
  Pencil,
  CreditCard,
  CheckCircle2,
  Clock,
  CircleDashed,
  CalendarRange,
  Users,
  BarChart3,
  HandCoins,
  UserCheck,
} from "lucide-react";
import { formatCOP } from "@/lib/pricing";
import { SPORTS } from "@/data/sports";
import { SCOPES, DEPARTMENTS } from "@/data/colombia";
import {
  DATE_RANGE_LABELS,
  periodMonthOf,
  rangeBounds,
  type AdAnalytics,
  type DateRange,
} from "@/lib/ad-analytics";
import { AdRevenueShare } from "@/components/ads/ad-revenue-share";
import { AdCampaignDetail } from "@/components/ads/ad-campaign-detail";
import { AdInventory } from "@/components/ads/ad-inventory";
import { useOrganizers } from "@/hooks/use-organizers";
import { AdCampaignFilters } from "@/components/ads/ad-campaign-filters";
import { OrganizerApprovals } from "@/components/ads/organizer-approvals";
import {
  campaignFilterCounts,
  filterCampaigns,
  EMPTY_CAMPAIGN_FILTER,
  type CampaignFilterValue,
} from "@/lib/ads/campaign-filter";

/**
 * Panel admin de Publicidad (Pieza 2 de Por hacer/modal-publicidad-y-tienda.md).
 *
 * Inventario 100% nuestro: campañas de anunciantes externos que el super admin
 * gestiona a mano. NO es `sponsors` (esos son los 6 espacios del organizador).
 * El espectador ve el modal (`AdModal`), que resuelve la campaña vía
 * `/api/ads/resolve`. Aquí se crean/prenden/apagan/borran campañas y se ve el
 * pulso de impresiones/clics (contador = bloqueante para poder cobrar/renovar).
 *
 * Lee/escribe `ad_campaigns` y `ad_campaign_tournaments` directo con el cliente
 * autenticado (RLS: admin FOR ALL). Los conteos salen de `analytics_events`
 * (event_type 'ad_impression' / 'ad_click', target_id = campaign.id).
 */

const STATUS_OPTIONS: { key: string; label: string }[] = [
  { key: "upcoming", label: "Próximo" },
  { key: "in-progress", label: "En curso" },
  { key: "completed", label: "Finalizado" },
];

interface CampaignRow {
  id: string;
  advertiser_name: string;
  contact: string | null;
  image_url: string;
  link_url: string | null;
  whatsapp: string | null;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
  monthly_price: number;
  /** Campaña social: no se cobra y no reparte. Explícito y no deducido de
   *  `monthly_price = 0`, que también significa "comercial sin precio todavía". */
  is_nonprofit: boolean;
  target_mode: "rule" | "list";
  target_sports: string[];
  target_statuses: string[];
  target_scopes: string[];
  target_departments: string[];
  target_municipalities: string[];
  created_at: string;
}

/** Los torneos se traen con sus atributos de targeting (no solo id y nombre)
 *  porque el inventario resuelve las reglas de las campañas contra ellos. Son
 *  los mismos cinco campos que lee `/api/ads/resolve`. */
interface TournamentLite {
  id: string;
  name: string;
  sport: string | null;
  status: string | null;
  scope: string | null;
  department: string | null;
  municipality: string | null;
  /** Para filtrar la línea de tiempo por organizador. No entra al targeting. */
  createdBy: string | null;
}

interface Counts {
  impressions: number;
  clicks: number;
  /** Personas-día: visitantes distintos por día. Métrica de reparto con
   *  organizadores — inmune al refresh pero crece con la actividad real. */
  personDays: number;
  /** Impresiones que ya traen `visitor_id`. Mientras sea menor que
   *  `impressions`, `personDays` subestima (los eventos previos a la migración
   *  del 2026-07-29 no tienen persona). */
  withPerson: number;
}

/** Chip toggle multi-select reutilizable. */
function ChipMulti({
  options,
  selected,
  onToggle,
}: {
  options: { key: string; label: string }[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = selected.includes(o.key);
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onToggle(o.key)}
            className={
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
              (active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground hover:bg-accent")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Tarjeta de KPI del encabezado. */
function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
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
          {hint && (
            <p className="text-[11px] text-muted-foreground">{hint}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function todayInput(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** ISO (UTC) → yyyy-mm-dd en hora local, para precargar <input type="date">. */
function isoToDateInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function AdsContent() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [listMap, setListMap] = useState<Record<string, string[]>>({});
  const [counts, setCounts] = useState<Record<string, Counts>>({});
  const [totals, setTotals] = useState<AdAnalytics["totals"]>(null);
  const [byCampaignOrganizer, setByCampaignOrganizer] = useState<
    AdAnalytics["by_campaign_organizer"]
  >([]);
  const [detail, setDetail] = useState<AdAnalytics["detail"]>([]);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("current");
  /** Campaña cuyo desglose por torneo se está mirando. */
  const [detailFor, setDetailFor] = useState<CampaignRow | null>(null);
  /** Lo que hay que transferir en el período. Lo reporta el reparto, que es
   *  donde viven los cobros por campaña. */
  const [payableCop, setPayableCop] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [tournaments, setTournaments] = useState<TournamentLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // ---- Form ----
  const [advertiser, setAdvertiser] = useState("");
  const [contact, setContact] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [price, setPrice] = useState("");
  const [nonprofit, setNonprofit] = useState(false);
  const [startsAt, setStartsAt] = useState(todayInput());
  const [endsAt, setEndsAt] = useState(todayInput(30));
  const [mode, setMode] = useState<"rule" | "list">("rule");
  const [sports, setSports] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [scopes, setScopes] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [listTournaments, setListTournaments] = useState<string[]>([]);
  const [tournamentSearch, setTournamentSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);

  /** Nombres de organizador para el filtro de la línea de tiempo. Una sola
   *  consulta por lote, no una por torneo. */
  const organizers = useOrganizers(
    useMemo(() => tournaments.map((t) => t.createdBy ?? undefined), [tournaments])
  );

  const [campaignFilter, setCampaignFilter] = useState<CampaignFilterValue>(
    EMPTY_CAMPAIGN_FILTER
  );

  const [payStatus, setPayStatus] = useState<Record<string, "paid" | "pending">>({});
  /** COP cobrados (pagos aprobados) por campaña. */
  const [paidByCampaign, setPaidByCampaign] = useState<Record<string, number>>({});

  const loadAll = useCallback(async () => {
    const [campRes, mapRes, evRes, tournRes, payRes] = await Promise.all([
      supabase
        .from("ad_campaigns")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("ad_campaign_tournaments").select("campaign_id, tournament_id"),
      // Agregación en Postgres, NO en el navegador. Antes esto era un
      // `.select()` sobre analytics_events sin paginar: PostgREST corta en
      // 1000 filas, así que el conteo se congelaba en silencio pasado ese
      // punto. La RPC devuelve el grano campaña × torneo (decenas de filas) y
      // acá abajo se agrupa como haga falta.
      supabase.rpc("get_ad_analytics", {
        p_from: rangeBounds(dateRange).from,
        p_to: rangeBounds(dateRange).to,
      }),
      supabase
        .from("tournaments")
        .select(
          "id, name, sport, status, scope, department, municipality, created_by"
        )
        .order("created_at", { ascending: false }),
      supabase.from("ad_payments").select("campaign_id, status, amount_cop"),
    ]);

    // Estado de pago por campaña: aprobado > pendiente. Los cancelados y
    // rechazados no cuentan; si no queda ninguno vivo, la campaña no tiene link.
    const pay: Record<string, "paid" | "pending"> = {};
    // Lo efectivamente COBRADO por campaña: solo pagos aprobados, sumados (una
    // renovación son dos pagos). Es la base del reparto — el precio de lista no
    // sirve, porque repartiría plata que quizá nunca entró.
    const paid: Record<string, number> = {};
    for (const row of payRes.data || []) {
      const r = row as {
        campaign_id: string | null;
        status: string;
        amount_cop: number | null;
      };
      if (!r.campaign_id) continue;
      if (r.status === "approved") {
        pay[r.campaign_id] = "paid";
        paid[r.campaign_id] = (paid[r.campaign_id] ?? 0) + (r.amount_cop ?? 0);
      } else if (r.status === "pending" && pay[r.campaign_id] !== "paid") {
        pay[r.campaign_id] = "pending";
      }
    }
    setPayStatus(pay);
    setPaidByCampaign(paid);

    if (campRes.error) {
      console.error("Error loading campaigns:", campRes.error);
      toast.error("Error al cargar campañas");
    }
    setCampaigns((campRes.data as CampaignRow[]) || []);

    const map: Record<string, string[]> = {};
    for (const row of mapRes.data || []) {
      const r = row as { campaign_id: string; tournament_id: string };
      (map[r.campaign_id] ??= []).push(r.tournament_id);
    }
    setListMap(map);

    // Un fallo de la RPC NO puede pasar por "no hay datos": se vería como
    // todo en cero y es indistinguible de un período sin actividad. Los dos
    // casos reales son la función sin crear (PGRST202, migración sin correr) y
    // el chequeo de admin devolviendo NULL.
    if (evRes.error) {
      console.error("get_ad_analytics falló", evRes.error);
      setMetricsError(
        evRes.error.code === "PGRST202"
          ? "Falta correr la migración 20260729b_get_ad_analytics.sql en Supabase."
          : `No se pudieron cargar las métricas: ${evRes.error.message}`
      );
    } else if (evRes.data === null) {
      setMetricsError(
        "La base no devolvió métricas. Suele ser que tu usuario no tiene rol de admin."
      );
    } else if (!(evRes.data as AdAnalytics).by_campaign_organizer) {
      // La RPC responde pero le falta el cruce campaña × organizador: está
      // corriendo una versión vieja. Si no se dijera, el reparto se vería
      // vacío y se leería como "ningún organizador aportó audiencia" en vez de
      // "falta una migración".
      setMetricsError(
        "La base está corriendo una versión vieja de get_ad_analytics (sin el cruce campaña × organizador). Falta correr la migración 20260729e_ad_analytics_by_campaign_organizer.sql."
      );
    } else {
      setMetricsError(null);
    }

    const analytics = evRes.data as AdAnalytics | null;
    const tally: Record<string, Counts> = {};
    for (const r of analytics?.by_campaign ?? []) {
      tally[r.campaign_id] = {
        impressions: r.impressions,
        clicks: r.clicks,
        personDays: r.person_days,
        withPerson: r.impressions_with_person,
      };
    }
    setCounts(tally);
    setTotals(analytics?.totals ?? null);
    setByCampaignOrganizer(analytics?.by_campaign_organizer ?? []);
    setDetail(analytics?.detail ?? []);

    // `created_by` → `createdBy` acá y no en el componente: el resto del panel
    // ya trabaja con las filas crudas de Supabase, así que la conversión vive
    // en el único punto donde entran.
    setTournaments(
      (tournRes.data || []).map((r) => {
        const row = r as Record<string, unknown>;
        return {
          id: row.id as string,
          name: row.name as string,
          sport: (row.sport as string | null) ?? null,
          status: (row.status as string | null) ?? null,
          scope: (row.scope as string | null) ?? null,
          department: (row.department as string | null) ?? null,
          municipality: (row.municipality as string | null) ?? null,
          createdBy: (row.created_by as string | null) ?? null,
        };
      })
    );
    setLoading(false);
    // Cambiar el rango re-consulta: el filtro de fechas lo aplica la RPC, no
    // el cliente (que ya no tiene los eventos crudos).
  }, [dateRange]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Municipios disponibles según los departamentos elegidos.
  const municipalityOptions = useMemo(() => {
    const opts: { key: string; label: string }[] = [];
    for (const depKey of departments) {
      const dep = DEPARTMENTS.find((d) => d.key === depKey);
      if (dep) {
        for (const m of dep.municipalities) {
          opts.push({ key: m.key, label: `${m.label} (${dep.label})` });
        }
      }
    }
    return opts;
  }, [departments]);

  const filteredTournaments = useMemo(() => {
    const q = tournamentSearch.trim().toLowerCase();
    if (!q) return tournaments.slice(0, 8);
    return tournaments
      .filter((t) => t.name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [tournaments, tournamentSearch]);

  const tournamentName = useCallback(
    (id: string) => tournaments.find((t) => t.id === id)?.name || "Torneo",
    [tournaments]
  );

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    key: string
  ) => {
    setter((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isImageFile(file)) {
      toast.error("El archivo debe ser una imagen (PNG, JPG, etc.)");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("La imagen no debe superar los 12MB");
      return;
    }
    setUploading(true);
    const { blob, ext } = await resizeImageForUpload(file, {
      maxDim: IMAGE_SIZES.photo,
    });
    const path = `ads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from("images")
      .upload(path, blob, { contentType: blob.type });
    if (error) {
      console.error("Storage upload error:", error);
      toast.error("Error al subir la imagen: " + error.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("images").getPublicUrl(path);
    setImageUrl(data.publicUrl);
    setUploading(false);
    toast.success("Imagen subida");
  };

  const resetForm = () => {
    setAdvertiser("");
    setContact("");
    setLinkUrl("");
    setWhatsapp("");
    setImageUrl("");
    setPrice("");
    setNonprofit(false);
    setStartsAt(todayInput());
    setEndsAt(todayInput(30));
    setMode("rule");
    setSports([]);
    setStatuses([]);
    setScopes([]);
    setDepartments([]);
    setMunicipalities([]);
    setListTournaments([]);
    setTournamentSearch("");
  };

  const openCreate = () => {
    resetForm();
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = (c: CampaignRow) => {
    setEditingId(c.id);
    setAdvertiser(c.advertiser_name);
    setContact(c.contact || "");
    setLinkUrl(c.link_url || "");
    setWhatsapp(c.whatsapp || "");
    setImageUrl(c.image_url);
    setPrice(c.monthly_price ? String(c.monthly_price) : "");
    setNonprofit(c.is_nonprofit ?? false);
    setStartsAt(isoToDateInput(c.starts_at));
    setEndsAt(isoToDateInput(c.ends_at));
    setMode(c.target_mode);
    setSports(c.target_sports || []);
    setStatuses(c.target_statuses || []);
    setScopes(c.target_scopes || []);
    setDepartments(c.target_departments || []);
    setMunicipalities(c.target_municipalities || []);
    setListTournaments(listMap[c.id] || []);
    setTournamentSearch("");
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!advertiser.trim()) return toast.error("El nombre del anunciante es obligatorio");
    if (!imageUrl.trim()) return toast.error("Sube la imagen del anuncio");
    if (!linkUrl.trim() && !whatsapp.trim())
      return toast.error("Agrega al menos un botón: WhatsApp o link de destino");
    if (!endsAt) return toast.error("Define la fecha de fin de vigencia");
    if (endsAt <= startsAt) return toast.error("La vigencia debe terminar después de que empieza");
    if (mode === "list" && listTournaments.length === 0)
      return toast.error("Elige al menos un torneo para el modo lista");

    const numPrice = parseInt(price) || 0;
    const payload = {
      advertiser_name: advertiser.trim(),
      contact: contact.trim() || null,
      image_url: imageUrl.trim(),
      link_url: linkUrl.trim() || null,
      whatsapp: whatsapp.trim() || null,
      // Una campaña social no tiene precio: si quedó uno escrito de antes, se
      // descarta acá. Guardarlo sería dejar un número que el sorteo de avisos sí
      // usa como peso, y que el panel mostraría como si fuera cobrable.
      monthly_price: nonprofit ? 0 : numPrice,
      is_nonprofit: nonprofit,
      starts_at: new Date(startsAt + "T00:00:00").toISOString(),
      ends_at: new Date(endsAt + "T23:59:59").toISOString(),
      target_mode: mode,
      target_sports: mode === "rule" ? sports : [],
      target_statuses: mode === "rule" ? statuses : [],
      target_scopes: mode === "rule" ? scopes : [],
      target_departments: mode === "rule" ? departments : [],
      target_municipalities: mode === "rule" ? municipalities : [],
    };

    setCreating(true);

    let campaignId = editingId;
    if (editingId) {
      const { error } = await supabase
        .from("ad_campaigns")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editingId);
      if (error) {
        console.error("Error updating campaign:", error);
        toast.error("Error al guardar los cambios");
        setCreating(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("ad_campaigns")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) {
        console.error("Error creating campaign:", error);
        toast.error("Error al crear la campaña");
        setCreating(false);
        return;
      }
      campaignId = data.id;
    }

    // Reconciliar los torneos del modo lista: borrar todos y reinsertar la
    // selección actual (simple y correcto tanto al crear como al editar).
    if (editingId) {
      await supabase
        .from("ad_campaign_tournaments")
        .delete()
        .eq("campaign_id", editingId);
    }
    if (mode === "list" && listTournaments.length > 0 && campaignId) {
      const { error: mapErr } = await supabase
        .from("ad_campaign_tournaments")
        .insert(
          listTournaments.map((tid) => ({
            campaign_id: campaignId,
            tournament_id: tid,
          }))
        );
      if (mapErr) {
        console.error("Error linking tournaments:", mapErr);
        toast.error("Guardado, pero fallo el vinculo de torneos");
      }
    }

    toast.success(
      editingId
        ? `Campaña "${advertiser.trim()}" actualizada`
        : `Campaña "${advertiser.trim()}" creada`
    );
    resetForm();
    setEditingId(null);
    setFormOpen(false);
    loadAll();
    setCreating(false);
  };

  const toggleActive = async (c: CampaignRow) => {
    const { error } = await supabase
      .from("ad_campaigns")
      .update({ is_active: !c.is_active, updated_at: new Date().toISOString() })
      .eq("id", c.id);
    if (error) {
      toast.error("Error al cambiar el estado");
    } else {
      setCampaigns((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, is_active: !x.is_active } : x))
      );
    }
  };

  const [linkLoadingId, setLinkLoadingId] = useState<string | null>(null);
  const generatePaymentLink = async (c: CampaignRow) => {
    if (c.is_nonprofit) {
      toast.error("Es una campaña social: no se cobra, así que no lleva link de pago");
      return;
    }
    if (c.monthly_price <= 0) {
      toast.error("Define el precio de la campaña antes de generar el link de pago");
      return;
    }
    setLinkLoadingId(c.id);
    try {
      const headers = await authHeader();
      if (!headers.Authorization) {
        toast.error("Sesión expirada, vuelve a iniciar sesión");
        return;
      }
      const res = await fetch("/api/ads/payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ campaignId: c.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "No se pudo generar el link");
        return;
      }
      try {
        await navigator.clipboard.writeText(data.url);
        toast.success("Link de pago copiado", { description: data.url });
      } catch {
        toast.success("Link de pago generado", { description: data.url });
      }
    } catch {
      toast.error("No se pudo generar el link");
    } finally {
      setLinkLoadingId(null);
    }
  };

  const handleDelete = async (c: CampaignRow) => {
    if (!confirm(`¿Eliminar la campaña "${c.advertiser_name}"? Esto no borra sus métricas.`))
      return;
    const { error } = await supabase.from("ad_campaigns").delete().eq("id", c.id);
    if (error) {
      toast.error("Error al eliminar la campaña");
    } else {
      toast.success("Campaña eliminada");
      loadAll();
    }
  };

  const now = new Date();
  const isLive = (c: CampaignRow) =>
    c.is_active && new Date(c.starts_at) <= now && new Date(c.ends_at) > now;

  const liveCount = campaigns.filter(isLive).length;
  // Los totales vienen de la RPC, no de sumar `counts`: personas-día no es
  // aditivo entre campañas (la misma persona el mismo día puede ver dos).
  const totalImpr = totals?.impressions ?? 0;
  const totalClicks = totals?.clicks ?? 0;
  const totalPersonDays = totals?.person_days ?? 0;
  // Qué proporción de las impresiones del período ya trae persona. Mientras
  // sea baja, personas-día subestima: los eventos previos a la migración del
  // 2026-07-29 no tienen visitor_id y no se pueden reconstruir.
  const personCoverage =
    totals && totals.impressions > 0
      ? totals.impressions_with_person / totals.impressions
      : 0;

  // Ordenar: al aire primero, luego programadas/pausadas, vencidas al final.
  const sortRank = (c: CampaignRow) => {
    if (isLive(c)) return 0;
    if (new Date(c.ends_at) <= now) return 2;
    return 1;
  };
  const sortedCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => sortRank(a) - sortRank(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [campaigns]
  );

  // Filtros de la lista. Con pocas campañas sobra la lista sola, pero el panel
  // está pensado para cuando sean decenas: ahí lo que importa es llegar rápido
  // a las que hay que atender (vencen, no pagaron).
  const campaignCounts = useMemo(
    () => campaignFilterCounts(campaigns, payStatus),
    [campaigns, payStatus]
  );
  const visibleCampaigns = useMemo(
    () => filterCampaigns(sortedCampaigns, campaignFilter, payStatus),
    [sortedCampaigns, campaignFilter, payStatus]
  );

  /** Chips que resumen el targeting de una campaña. */
  const targetChips = (c: CampaignRow): string[] => {
    if (c.target_mode === "list") {
      const n = listMap[c.id]?.length ?? 0;
      return [`${n} torneo${n === 1 ? "" : "s"} a mano`];
    }
    const chips: string[] = [];
    for (const s of c.target_sports)
      chips.push(SPORTS.find((x) => x.key === s)?.label || s);
    for (const s of c.target_scopes) chips.push(s);
    for (const d of c.target_departments)
      chips.push(DEPARTMENTS.find((x) => x.key === d)?.label || d);
    for (const s of c.target_statuses)
      chips.push(STATUS_OPTIONS.find((x) => x.key === s)?.label || s);
    return chips.length ? chips : ["Todos los torneos"];
  };

  const statusBadge = (c: CampaignRow) => {
    if (isLive(c))
      return (
        <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/20">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
          </span>
          Al aire
        </Badge>
      );
    if (new Date(c.ends_at) <= now)
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Vencida
        </Badge>
      );
    if (!c.is_active)
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-500/20">
          Pausada
        </Badge>
      );
    return (
      <Badge variant="outline" className="text-blue-600 border-blue-500/20">
        Programada
      </Badge>
    );
  };

  // Estado de pago de la campaña: pagado / pendiente / sin link generado.
  const paymentBadge = (status?: "paid" | "pending") => {
    if (status === "paid")
      return (
        <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle2 className="h-3 w-3" />
          Pagado
        </Badge>
      );
    if (status === "pending")
      return (
        <Badge className="gap-1 bg-amber-500/10 text-amber-600 border-amber-500/20">
          <Clock className="h-3 w-3" />
          Pendiente
        </Badge>
      );
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <CircleDashed className="h-3 w-3" />
        Sin link
      </Badge>
    );
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Megaphone className="h-7 w-7" />
            Publicidad
          </h1>
          <p className="text-muted-foreground mt-1 max-w-xl">
            Campañas del modal que ve el espectador. Inventario nuestro, cobro
            mensual, administrado a mano.
          </p>
        </div>
        <Button onClick={openCreate} className="flex-shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Nueva campaña
        </Button>
      </div>

      {/* Rango del período. Aplica a impresiones, clics, personas-día y CTR —
          no a la lista de campañas, que siempre se muestra completa. */}
      <div className="flex flex-wrap items-center gap-2">
        <CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" />
        {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map((r) => (
          <Button
            key={r}
            variant={dateRange === r ? "default" : "outline"}
            size="sm"
            onClick={() => setDateRange(r)}
          >
            {DATE_RANGE_LABELS[r]}
          </Button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Al aire ahora"
          value={liveCount}
          icon={Radio}
          accent="bg-green-500/10 text-green-600"
        />
        <StatCard
          label="Impresiones"
          value={totalImpr.toLocaleString()}
          hint={
            totalImpr > 0
              ? `${totalClicks.toLocaleString()} clics · CTR ${((totalClicks / totalImpr) * 100).toFixed(1)}%`
              : undefined
          }
          icon={Eye}
          accent="bg-blue-500/10 text-blue-600"
        />
        {/* "con aviso" es deliberado: la analítica muestra personas-día de TODA
            la audiencia, y esta es el subconjunto que vio publicidad. Sin el
            calificativo son dos tarjetas con el mismo nombre y números
            distintos, que es peor que no tener ninguna. */}
        <StatCard
          label="Personas-día con aviso"
          value={totalPersonDays.toLocaleString()}
          icon={Users}
          accent="bg-amber-500/10 text-amber-600"
        />
        <StatCard
          label="A transferir"
          value={formatCOP(payableCop)}
          icon={HandCoins}
          accent="bg-emerald-500/10 text-emerald-600"
        />
      </div>

      {/* Las métricas fallaron: hay que decirlo. Un cero real y un cero por
          error se ven idénticos, y este panel alimenta decisiones de plata. */}
      {metricsError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-medium text-destructive">
            Las métricas no se pudieron cargar
          </p>
          <p className="mt-0.5 text-muted-foreground">
            {metricsError} Los ceros de abajo no son datos reales.
          </p>
        </div>
      )}

      {/* Aviso mientras el histórico no tenga persona. Sin esto, personas-día
          se lee como "hubo poca gente" cuando en realidad es "todavía no
          medíamos personas". Los eventos previos al 2026-07-29 no tienen
          visitor_id y no se pueden reconstruir. */}
      {!metricsError && totalImpr > 0 && personCoverage < 0.99 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <p className="font-medium text-amber-700">
            Personas-día parcial: {Math.round(personCoverage * 100)}% de las
            impresiones de este período tienen persona identificada.
          </p>
          <p className="mt-0.5 text-muted-foreground">
            Empezamos a medir personas el 29/07/2026. Lo anterior solo tiene
            impresiones y no se puede reconstruir, así que personas-día
            subestima hasta que el período esté completo. No liquidar con este
            número mientras la cobertura no esté cerca del 100%.
          </p>
        </div>
      )}

      {/* Dos pestañas y no una lista debajo de la otra: son dos trabajos
          distintos —gestionar campañas y liquidarle a los organizadores— y
          apilados obligaban a bajar mucho para llegar al reparto.

          El filtro de período y las tarjetas quedan ARRIBA de las pestañas a
          propósito: aplican a las dos, y moverlos adentro obligaría a
          duplicarlos o a perder el contexto al cambiar de pestaña. */}
      <Tabs defaultValue="campanas" className="gap-4">
        <TabsList className="w-full">
          <TabsTrigger value="campanas" className="flex-1">
            <Megaphone className="h-4 w-4" />
            Campañas
            {!loading && ` (${campaigns.length})`}
          </TabsTrigger>
          <TabsTrigger value="inventario" className="flex-1">
            <ListChecks className="h-4 w-4" />
            Inventario
          </TabsTrigger>
          <TabsTrigger value="reparto" className="flex-1">
            <HandCoins className="h-4 w-4" />
            Reparto
            {payableCop > 0 && ` · ${formatCOP(payableCop)}`}
          </TabsTrigger>
          {/* El contador de pendientes va en la pestaña porque una solicitud sin
              revisar no avisa sola: el organizador queda esperando y nadie se
              entera hasta que pregunta. */}
          <TabsTrigger value="organizadores" className="flex-1">
            <UserCheck className="h-4 w-4" />
            Organizadores
            {pendingApprovals > 0 && ` · ${pendingApprovals}`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campanas" className="space-y-3">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-xl bg-muted/50"
                />
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Megaphone className="h-7 w-7 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold">Aún no hay campañas</p>
                  <p className="text-sm text-muted-foreground">
                    Crea la primera para que aparezca en el modal del espectador.
                  </p>
                </div>
                <Button onClick={openCreate} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva campaña
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <AdCampaignFilters
                value={campaignFilter}
                onChange={setCampaignFilter}
                counts={campaignCounts}
                shown={visibleCampaigns.length}
              />
              {visibleCampaigns.length === 0 && (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Ninguna campaña coincide con el filtro.
                  </CardContent>
                </Card>
              )}
              {visibleCampaigns.map((c) => {
                const cnt = counts[c.id] || {
                  impressions: 0,
                  clicks: 0,
                  personDays: 0,
                  withPerson: 0,
                };
                const ctr =
                  cnt.impressions > 0
                    ? ((cnt.clicks / cnt.impressions) * 100).toFixed(1) + "%"
                    : "—";
                return (
                  <Card key={c.id} className="overflow-hidden">
                    <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
                      {/* Imagen */}
                      <div className="relative h-20 w-32 flex-shrink-0 overflow-hidden rounded-lg border bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={c.image_url}
                          alt={c.advertiser_name}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-contain"
                        />
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold truncate">
                            {c.advertiser_name}
                          </span>
                          {statusBadge(c)}
                          {paymentBadge(payStatus[c.id])}
                          <Badge variant="secondary" className="gap-1 text-[11px]">
                            {c.target_mode === "list" ? (
                              <ListChecks className="h-3 w-3" />
                            ) : (
                              <Target className="h-3 w-3" />
                            )}
                            {c.target_mode === "list" ? "Lista" : "Regla"}
                          </Badge>
                        </div>

                        {/* Targeting chips */}
                        <div className="flex flex-wrap gap-1">
                          {targetChips(c).map((chip, i) => (
                            <span
                              key={i}
                              className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                            >
                              {chip}
                            </span>
                          ))}
                        </div>

                        {/* Meta */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            {new Date(c.starts_at).toLocaleDateString()} –{" "}
                            {new Date(c.ends_at).toLocaleDateString()}
                          </span>
                          {c.is_nonprofit ? (
                            // Sin esto, una campaña social y una comercial a la
                            // que le falta el precio se ven exactamente igual en
                            // la lista: las dos sin monto.
                            <span className="font-medium text-foreground">
                              Social · no se cobra
                            </span>
                          ) : (
                            c.monthly_price > 0 && (
                              <span className="font-medium text-foreground">
                                ${c.monthly_price.toLocaleString()}/mes
                              </span>
                            )
                          )}
                          {c.contact && <span className="truncate">{c.contact}</span>}
                        </div>
                      </div>

                      {/* Métricas + acciones */}
                      <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:justify-between">
                        <div className="flex gap-4">
                          <div className="text-center">
                            <p className="flex items-center gap-1 text-sm font-semibold">
                              <Eye className="h-3.5 w-3.5 text-blue-600" />
                              {cnt.impressions.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-muted-foreground">impr.</p>
                          </div>
                          <div className="text-center">
                            <p className="flex items-center gap-1 text-sm font-semibold">
                              <Users className="h-3.5 w-3.5 text-amber-600" />
                              {cnt.personDays.toLocaleString()}
                            </p>
                            <p
                              className="text-[10px] text-muted-foreground"
                              title="Personas distintas que la vieron cada día, sumadas en el período. No se suma entre campañas."
                            >
                              pers-día
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="flex items-center gap-1 text-sm font-semibold">
                              <MousePointerClick className="h-3.5 w-3.5 text-violet-600" />
                              {cnt.clicks.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-muted-foreground">clics</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-semibold">{ctr}</p>
                            <p className="text-[10px] text-muted-foreground">CTR</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Ver desglose por torneo y organizador"
                            onClick={() => setDetailFor(c)}
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={c.is_active ? "Pausar" : "Activar"}
                            onClick={() => toggleActive(c)}
                          >
                            <Power
                              className={
                                "h-4 w-4 " +
                                (c.is_active ? "text-green-600" : "text-muted-foreground")
                              }
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Generar link de pago"
                            disabled={linkLoadingId === c.id}
                            onClick={() => generatePaymentLink(c)}
                          >
                            <CreditCard className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Editar"
                            onClick={() => openEdit(c)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Eliminar"
                            onClick={() => handleDelete(c)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* El inventario NO lleva forceMount: no alimenta ninguna tarjeta de
            arriba, así que calcularlo con la pestaña cerrada sería trabajo
            tirado. Se monta al abrirla. */}
        <TabsContent value="inventario">
          <AdInventory
            campaigns={campaigns}
            tournaments={tournaments}
            listMap={listMap}
            organizers={organizers}
            payStatus={payStatus}
            loading={loading}
          />
        </TabsContent>

        {/* forceMount para que el reparto se calcule aunque la pestaña esté
            cerrada: si no, la tarjeta "A transferir" de arriba mostraría $0
            hasta abrirla, y un cero falso en una cifra de pago es justo lo que
            este panel trata de evitar.

            Y `data-[state=inactive]:hidden` porque forceMount NO oculta: Radix
            deja la visibilidad al CSS, así que sin esta clase el reparto se
            renderiza debajo de la lista de campañas y las pestañas no sirven
            de nada. */}
        <TabsContent
          value="reparto"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          {metricsError ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                El reparto no se puede calcular sin las métricas. Mirá el aviso
                de arriba.
              </CardContent>
            </Card>
          ) : (
            <AdRevenueShare
              rows={byCampaignOrganizer}
              campaigns={Object.fromEntries(
                campaigns.map((c) => [
                  c.id,
                  {
                    name: c.advertiser_name,
                    paidCop: paidByCampaign[c.id] ?? 0,
                    starts: c.starts_at,
                    ends: c.ends_at,
                  },
                ])
              )}
              activeCount={liveCount}
              periodLabel={DATE_RANGE_LABELS[dateRange]}
              periodMonth={periodMonthOf(dateRange)}
              coverage={personCoverage}
              onPayableChange={setPayableCop}
            />
          )}
        </TabsContent>

        <TabsContent value="organizadores">
          <OrganizerApprovals onPendingChange={setPendingApprovals} />
        </TabsContent>
      </Tabs>

      {/* ===== Diálogo: desglose de una campaña ===== */}
      {detailFor && (
        <AdCampaignDetail
          open
          onOpenChange={(o) => !o && setDetailFor(null)}
          advertiserName={detailFor.advertiser_name}
          periodLabel={DATE_RANGE_LABELS[dateRange]}
          rows={detail.filter((d) => d.campaign_id === detailFor.id)}
          campaignPersonDays={counts[detailFor.id]?.personDays ?? 0}
        />
      )}

      {/* ===== Diálogo: crear campaña ===== */}
      <Dialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditingId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar campaña" : "Nueva campaña"}</DialogTitle>
            <DialogDescription>
              Se muestra en el modal del espectador según su targeting.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Imagen */}
            <div className="space-y-2">
              <Label className="text-xs">Imagen del anuncio *</Label>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer">
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
                    <Upload className="h-4 w-4" />
                    {uploading ? "Subiendo..." : imageUrl ? "Cambiar" : "Subir imagen"}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={handleUpload}
                  />
                </label>
                <div className="flex h-16 w-28 items-center justify-center overflow-hidden rounded-md border bg-white">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt="preview"
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs">Anunciante *</Label>
                <Input
                  value={advertiser}
                  onChange={(e) => setAdvertiser(e.target.value)}
                  placeholder="Ferreteria El Tornillo"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Contacto interno (para renovar)</Label>
                <Input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Uso interno — no es un botón"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Link de destino</Label>
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">WhatsApp</Label>
                <Input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="3001234567"
                  className="h-9"
                />
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">
                Botones del anuncio: WhatsApp y/o link. Al menos uno; se muestra solo
                el que cargues.
              </p>
              <div className="space-y-2">
                <Label className="text-xs">Precio mensual (COP)</Label>
                <Input
                  type="number"
                  min="0"
                  value={nonprofit ? "" : price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={nonprofit ? "No aplica" : "0"}
                  disabled={nonprofit}
                  className="h-9"
                />
                {/* La marca de campaña social va pegada al precio porque es lo
                    que decide: sin ella, precio 0 es ambiguo — puede ser una
                    campaña social o una comercial a la que todavía no le
                    pusieron precio, y el organizador ve "Sin pagar" en las dos.
                    Ver Por hacer/monetizacion-analitica-publicidad.md. */}
                <label className="flex cursor-pointer items-start gap-2 pt-1 text-xs">
                  <input
                    type="checkbox"
                    checked={nonprofit}
                    onChange={(e) => setNonprofit(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-primary"
                  />
                  <span>
                    Campaña social (no se cobra)
                    <span className="block text-[11px] text-muted-foreground">
                      El organizador la ve marcada como &quot;no genera pago&quot;
                      en vez de &quot;Sin pagar&quot;.
                    </span>
                  </span>
                </label>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Vigencia desde</Label>
                <Input
                  type="date"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Vigencia hasta *</Label>
                <Input
                  type="date"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <p className="-mt-2 text-[11px] text-muted-foreground">
              El precio también es el peso de rotación (share of voice ∝ monto).
            </p>

            {/* Targeting */}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-sm font-medium">Segmentación</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as "rule" | "list")}>
                  <SelectTrigger className="h-8 w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rule">Por regla (dinámico)</SelectItem>
                    <SelectItem value="list">Torneos específicos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {mode === "rule" ? (
                <div className="space-y-4">
                  <p className="text-[11px] text-muted-foreground">
                    Vacío = comodín (no filtra por ese criterio). Torneos futuros
                    que cumplan entran solos.
                  </p>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Deportes</Label>
                    <ChipMulti
                      options={SPORTS.map((s) => ({ key: s.key, label: s.label }))}
                      selected={sports}
                      onToggle={(k) => toggle(setSports, k)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Estado del torneo
                    </Label>
                    <ChipMulti
                      options={STATUS_OPTIONS}
                      selected={statuses}
                      onToggle={(k) => toggle(setStatuses, k)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Alcance</Label>
                    <ChipMulti
                      options={SCOPES.map((s) => ({ key: s.key, label: s.label }))}
                      selected={scopes}
                      onToggle={(k) => toggle(setScopes, k)}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Departamento
                      </Label>
                      <Select
                        value=""
                        onValueChange={(k) => {
                          if (!departments.includes(k)) toggle(setDepartments, k);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Agregar departamento" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEPARTMENTS.map((d) => (
                            <SelectItem key={d.key} value={d.key}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex flex-wrap gap-1.5">
                        {departments.map((k) => (
                          <Badge key={k} variant="secondary" className="gap-1">
                            {DEPARTMENTS.find((d) => d.key === k)?.label || k}
                            <button
                              type="button"
                              onClick={() => {
                                toggle(setDepartments, k);
                                const dep = DEPARTMENTS.find((d) => d.key === k);
                                if (dep) {
                                  const keys = dep.municipalities.map((m) => m.key);
                                  setMunicipalities((prev) =>
                                    prev.filter((m) => !keys.includes(m))
                                  );
                                }
                              }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Municipio</Label>
                      <Select
                        value=""
                        disabled={municipalityOptions.length === 0}
                        onValueChange={(k) => {
                          if (!municipalities.includes(k)) toggle(setMunicipalities, k);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue
                            placeholder={
                              municipalityOptions.length === 0
                                ? "Elige un departamento primero"
                                : "Agregar municipio"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {municipalityOptions.map((m) => (
                            <SelectItem key={m.key} value={m.key}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex flex-wrap gap-1.5">
                        {municipalities.map((k) => (
                          <Badge key={k} variant="secondary" className="gap-1">
                            {municipalityOptions.find((m) => m.key === k)?.label || k}
                            <button
                              type="button"
                              onClick={() => toggle(setMunicipalities, k)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Elige torneos puntuales sin importar su deporte o geografía.
                  </p>
                  <Input
                    value={tournamentSearch}
                    onChange={(e) => setTournamentSearch(e.target.value)}
                    placeholder="Buscar torneo por nombre..."
                    className="h-9"
                  />
                  <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                    {filteredTournaments.length === 0 ? (
                      <p className="p-3 text-xs text-muted-foreground">Sin resultados</p>
                    ) : (
                      filteredTournaments.map((t) => {
                        const on = listTournaments.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => toggle(setListTournaments, t.id)}
                            className={
                              "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent " +
                              (on ? "bg-accent/60" : "")
                            }
                          >
                            <span className="truncate">{t.name}</span>
                            {on && <Badge className="ml-2">✓</Badge>}
                          </button>
                        );
                      })
                    )}
                  </div>
                  {listTournaments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {listTournaments.map((id) => (
                        <Badge key={id} variant="secondary" className="gap-1">
                          {tournamentName(id)}
                          <button
                            type="button"
                            onClick={() => toggle(setListTournaments, id)}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => {
                  setFormOpen(false);
                  setEditingId(null);
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={creating || uploading}>
                {editingId ? (
                  <Pencil className="h-4 w-4 mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                {editingId ? "Guardar cambios" : "Crear campaña"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdsPage() {
  return (
    <AdminGuard>
      <AdsContent />
    </AdminGuard>
  );
}
