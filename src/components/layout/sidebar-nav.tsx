"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Trophy,
  PlusCircle,
  Settings,
  ExternalLink,
  Shield,
  DollarSign,
  Ticket,
  BarChart3,
  TrendingUp,
  Megaphone,
  Images,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Torneos", href: "/tournaments", icon: Trophy },
  { label: "Crear Torneo", href: "/tournaments/create", icon: PlusCircle },
  { label: "Logos", href: "/dashboard/logos", icon: Images },
  { label: "Configuracion", href: "/dashboard/settings", icon: Settings },
];

interface SidebarNavProps {
  onNavigate?: () => void;
}

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const profileSlug = user?.organizationProfile?.isPublic
    ? user.organizationProfile.slug
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6">
        <Link
          href="/dashboard"
          className="font-bold text-xl"
          onClick={onNavigate}
        >
          Torneos Pro
        </Link>
      </div>

      <Separator />

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems
          .filter(
            (item) =>
              !(
                user?.role === "admin" &&
                (item.href === "/dashboard/settings" || item.href === "/dashboard/logos")
              )
          )
          .map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        {user?.role === "admin" && (
          <>
            <Separator className="my-3" />
            <Link
              href="/admin/users"
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/admin/users"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Shield className="h-4 w-4" />
              Usuarios
            </Link>
            <Link
              href="/admin/finances"
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/admin/finances"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <DollarSign className="h-4 w-4" />
              Finanzas
            </Link>
            <Link
              href="/admin/coupons"
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/admin/coupons"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Ticket className="h-4 w-4" />
              Cupones
            </Link>
            <Link
              href="/admin/ads"
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/admin/ads"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Megaphone className="h-4 w-4" />
              Publicidad
            </Link>
            <Link
              href="/admin/analytics"
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/admin/analytics"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <BarChart3 className="h-4 w-4" />
              Analiticas
            </Link>
            <Link
              href="/admin/business"
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/admin/business"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <TrendingUp className="h-4 w-4" />
              Negocio
            </Link>
          </>
        )}

        {profileSlug && user?.role !== "admin" && (
          <>
            <Separator className="my-3" />
            <Link
              href={`/${profileSlug}`}
              onClick={onNavigate}
              target="_blank"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Perfil Público
            </Link>
          </>
        )}
      </nav>

    </div>
  );
}
