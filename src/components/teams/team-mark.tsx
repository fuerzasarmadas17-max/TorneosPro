import { Team } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Marca visual de un equipo para calendario / listados:
 *   - Si el equipo tiene logo → muestra el logo.
 *   - Si no, pero tiene colores → muestra el swatch de dos colores.
 *   - Si no tiene ninguno → no renderiza nada.
 */
export function TeamMark({
  team,
  size = 20,
  className,
}: {
  team?: Pick<Team, "name" | "logoUrl" | "primaryColor" | "secondaryColor"> | null;
  size?: number;
  className?: string;
}) {
  if (!team) return null;
  const hasLogo = !!team.logoUrl;
  const hasColors = !!(team.primaryColor || team.secondaryColor);
  if (!hasLogo && !hasColors) return null;

  const style = { width: size, height: size };

  if (hasLogo) {
    return (
      <div
        style={style}
        className={cn(
          "shrink-0 overflow-hidden rounded border border-border bg-muted/20",
          className
        )}
      >
        <img
          src={team.logoUrl}
          alt={team.name}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      style={style}
      className={cn("flex shrink-0 overflow-hidden rounded border border-border", className)}
    >
      <div className="h-full w-1/2" style={{ backgroundColor: team.primaryColor || "#fff" }} />
      <div className="h-full w-1/2" style={{ backgroundColor: team.secondaryColor || "#000" }} />
    </div>
  );
}
