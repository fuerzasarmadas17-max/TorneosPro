import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const accents: Record<string, string> = {
  default: "bg-muted text-muted-foreground",
  green: "bg-green-500/10 text-green-600 dark:text-green-500",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-500",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-500",
};

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  /** Texto chico opcional bajo el valor, para dar contexto a la métrica. */
  hint?: string;
  accent?: keyof typeof accents;
  className?: string;
  /** "md" (default) = tarjeta grande. "sm" = versión compacta (dashboard). */
  size?: "md" | "sm";
}

/** Tarjeta de métrica: ícono en un cuadro de color + etiqueta + valor. */
export function StatCard({ icon: Icon, label, value, hint, accent = "default", className, size = "md" }: StatCardProps) {
  const sm = size === "sm";
  return (
    <Card className={className}>
      {/* En "sm" el layout es vertical en mobile: con el ícono al lado, una
          tarjeta de ~88px (grid de 3 en 320px) deja ~8px para el texto y el
          valor se recorta a un dígito. Desde sm: vuelve a ser horizontal. */}
      <CardContent
        className={cn(
          "flex",
          sm
            ? "flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4"
            : "items-center gap-4 p-5"
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center justify-center",
            sm ? "size-9 rounded-lg" : "size-11 rounded-xl",
            accents[accent]
          )}
        >
          <Icon className={sm ? "size-4" : "size-5"} />
        </div>
        <div className="min-w-0">
          <p className={cn("text-muted-foreground", sm ? "text-[11px] leading-tight sm:text-xs" : "text-sm")}>{label}</p>
          <p className={cn("truncate font-bold tracking-tight", sm ? "text-lg sm:text-xl" : "text-2xl")}>{value}</p>
          {hint && (
            <p className="truncate text-xs text-muted-foreground/70">{hint}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
