"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2, Search, type LucideIcon } from "lucide-react";

/**
 * Piezas compartidas de las pantallas de admin, tomadas del lenguaje visual
 * que ya usan Analíticas y Negocios: tarjeta con caja de icono a la
 * izquierda, número grande, y una línea chica de contexto debajo.
 *
 * Viven acá y no dentro de cada página para que Cupones y Usuarios no se
 * separen visualmente con el tiempo.
 */

export const ACCENT = {
  default: "bg-muted text-muted-foreground",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-500",
  green: "bg-green-500/10 text-green-600 dark:text-green-500",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-500",
  red: "bg-red-500/10 text-red-600 dark:text-red-500",
} as const;

export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  accent = "default",
  onClick,
  active,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
  accent?: keyof typeof ACCENT;
  /** Si se pasa, la tarjeta es un botón que aplica su filtro. */
  onClick?: () => void;
  active?: boolean;
}) {
  const body = (
    <CardContent className="flex flex-col gap-1.5 p-4 sm:gap-2 sm:p-5">
      <div className="flex items-center gap-2 sm:gap-3">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg sm:size-9",
            ACCENT[accent]
          )}
        >
          <Icon className="size-4" />
        </div>
        <p className="min-w-0 text-xs leading-tight text-muted-foreground sm:text-sm">
          {label}
        </p>
      </div>
      <p className="text-xl font-bold tracking-tight sm:text-2xl">{value}</p>
      {hint && (
        <p className="text-[11px] leading-tight text-muted-foreground">{hint}</p>
      )}
    </CardContent>
  );

  if (!onClick) return <Card>{body}</Card>;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "cursor-pointer transition-colors hover:border-primary/60",
        active && "border-primary ring-1 ring-primary/30"
      )}
    >
      {body}
    </Card>
  );
}

/** Fila de chips de filtro. */
export function FilterChips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string; count?: number }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <Button
          key={o.key}
          size="sm"
          variant={value === o.key ? "default" : "outline"}
          onClick={() => onChange(o.key)}
          className="h-8"
        >
          {o.label}
          {o.count !== undefined && (
            <span
              className={cn(
                "ml-1.5 text-[11px]",
                value === o.key ? "opacity-80" : "text-muted-foreground"
              )}
            >
              {o.count}
            </span>
          )}
        </Button>
      ))}
    </div>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 pl-8"
      />
    </div>
  );
}

/**
 * Pie de la lista: cuántas se ven de cuántas, y el botón para traer más.
 * Decir "42 de 380" es lo que evita que el admin crea que la lista está
 * completa cuando en realidad se cortó en la primera página.
 */
export function ListFooter({
  shown,
  total,
  loading,
  onMore,
  noun,
}: {
  shown: number;
  total: number;
  loading: boolean;
  onMore: () => void;
  noun: string;
}) {
  if (total === 0) return null;
  const hasMore = shown < total;
  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      <p className="text-xs text-muted-foreground">
        {shown} de {total} {noun}
      </p>
      {hasMore && (
        <Button
          variant="outline"
          size="sm"
          onClick={onMore}
          disabled={loading}
          className="w-full sm:w-auto"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Cargando…
            </>
          ) : (
            <>Ver más · quedan {total - shown}</>
          )}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed py-12 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg border bg-muted/40" />
      ))}
    </div>
  );
}
