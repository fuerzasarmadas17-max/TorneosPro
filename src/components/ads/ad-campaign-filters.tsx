"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, CalendarClock } from "lucide-react";
import { CAMPAIGN_STATE_LABELS } from "@/lib/ads/targeting";
import {
  EMPTY_CAMPAIGN_FILTER,
  EXPIRING_DAYS,
  isCampaignFilterActive,
  type CampaignFilterValue,
  type campaignFilterCounts,
} from "@/lib/ads/campaign-filter";

/**
 * Barra de filtros de la lista de campañas. Controlada — el estado vive en el
 * padre para que la misma barra sirva a la pestaña Campañas y a la vista "Por
 * campaña" del inventario sin que compartan selección.
 */

interface Props {
  value: CampaignFilterValue;
  onChange: (v: CampaignFilterValue) => void;
  counts: ReturnType<typeof campaignFilterCounts>;
  /** Cuántas quedaron después de filtrar, para el contador de la derecha. */
  shown: number;
}

const STATE_ORDER = ["live", "scheduled", "paused", "expired"] as const;

export function AdCampaignFilters({ value, onChange, counts, shown }: Props) {
  const set = (patch: Partial<CampaignFilterValue>) =>
    onChange({ ...value, ...patch });

  const active = isCampaignFilterActive(value);

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2 py-3">
        <div className="relative min-w-[170px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={value.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder="Buscar anunciante…"
            className="pl-8"
          />
        </div>

        <Select value={value.state} onValueChange={(v) => set({ state: v })}>
          <SelectTrigger className="w-[165px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              Cualquier estado ({counts.total})
            </SelectItem>
            {STATE_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {CAMPAIGN_STATE_LABELS[s]} ({counts.state[s] ?? 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={value.pay} onValueChange={(v) => set({ pay: v })}>
          <SelectTrigger className="w-[165px]">
            <SelectValue placeholder="Cobro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              Cualquier cobro ({counts.total})
            </SelectItem>
            <SelectItem value="paid">Pagadas ({counts.pay.paid})</SelectItem>
            <SelectItem value="pending">
              Pendientes ({counts.pay.pending})
            </SelectItem>
            <SelectItem value="none">
              Sin link ({counts.pay.none})
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Atajo a la cola de renovación: es la acción comercial más frecuente
            sobre esta lista, no merece dos clics en un desplegable. */}
        <Button
          size="sm"
          variant={value.expiringSoon ? "default" : "outline"}
          onClick={() => set({ expiringSoon: !value.expiringSoon })}
          disabled={counts.expiringSoon === 0 && !value.expiringSoon}
        >
          <CalendarClock className="h-4 w-4" />
          Vencen en {EXPIRING_DAYS} d ({counts.expiringSoon})
        </Button>

        {active && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange(EMPTY_CAMPAIGN_FILTER)}
          >
            <X className="h-4 w-4" />
            Limpiar
          </Button>
        )}

        {active && (
          <span className="ml-auto text-xs text-muted-foreground">
            {shown} de {counts.total}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
