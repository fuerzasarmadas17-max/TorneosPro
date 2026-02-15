"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function MainNav({ className }: { className?: string }) {
  const pathname = usePathname();

  const links = [
    { href: "/tournaments", label: "Torneos" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  return (
    <nav className={cn("flex items-center space-x-6 text-sm font-medium", className)}>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "transition-colors hover:text-foreground/80",
            pathname === link.href
              ? "text-foreground"
              : "text-foreground/60"
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
