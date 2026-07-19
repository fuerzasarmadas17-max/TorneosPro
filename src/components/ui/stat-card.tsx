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
  accent?: keyof typeof accents;
  className?: string;
}

/** Tarjeta de métrica: ícono en un cuadro de color + etiqueta + valor. */
export function StatCard({ icon: Icon, label, value, accent = "default", className }: StatCardProps) {
  return (
    <Card className={className}>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            accents[accent]
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="truncate text-2xl font-bold tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
