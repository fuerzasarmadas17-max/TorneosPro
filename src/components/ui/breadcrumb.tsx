import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export interface Crumb {
  label: string;
  /** Sin href, la miga es el elemento actual y no se puede clickear. */
  href?: string;
}

/**
 * Migas de pan. Componente nuevo y chico — `components/ui/` no tenía uno.
 *
 * La última miga lleva `aria-current="page"` y no es un link: repetir la
 * página en la que ya estás como enlace es ruido para quien navega con
 * lector de pantalla.
 */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Migas de pan">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <Link
            href="/"
            className="flex items-center transition-colors hover:text-foreground"
            aria-label="Inicio"
          >
            <Home className="size-4" aria-hidden />
          </Link>
        </li>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              <ChevronRight className="size-4 shrink-0 opacity-50" aria-hidden />
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={last ? "min-w-0 truncate text-foreground" : ""}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
