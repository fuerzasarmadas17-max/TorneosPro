"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { useTournaments } from "@/context/tournament-context";
import { Header } from "./header";
import { Footer } from "./footer";
import { SidebarNav } from "./sidebar-nav";
import { TopBar } from "./top-bar";
import { Loader2 } from "lucide-react";

const AUTH_PAGES = ["/login", "/register"];
const SIDEBAR_PREFIXES = ["/dashboard", "/admin", "/tournaments"];

function usesSidebarLayout(pathname: string) {
  return SIDEBAR_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isLoading: dataLoading } = useTournaments();
  const pathname = usePathname();
  const router = useRouter();

  // Redirect: authenticated user on landing or auth pages → dashboard
  // Redirect: unauthenticated user on dashboard/admin → login
  useEffect(() => {
    if (authLoading) return;

    if (isAuthenticated && (pathname === "/" || AUTH_PAGES.includes(pathname))) {
      router.replace("/dashboard");
    }

    if (!isAuthenticated && (pathname.startsWith("/dashboard") || pathname.startsWith("/admin"))) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, pathname, router]);

  // While auth is loading, show loading screen for routes that need auth
  const isProtectedRoute = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");
  if (authLoading && (isProtectedRoute || AUTH_PAGES.includes(pathname))) {
    return <LoadingScreen />;
  }

  // Wait for tournament data ONLY on routes that display tournament data.
  // Settings, create, etc. don't need it and should render immediately.
  const needsTournamentData =
    pathname === "/dashboard" ||
    pathname.startsWith("/admin") ||
    (pathname.startsWith("/tournaments") && pathname !== "/tournaments/create");
  if (!authLoading && dataLoading && needsTournamentData && isAuthenticated) {
    return <LoadingScreen />;
  }

  // Transitional states: show loading while redirect is happening
  if (!authLoading && !isAuthenticated && isProtectedRoute) {
    return <LoadingScreen />;
  }
  if (!authLoading && isAuthenticated && AUTH_PAGES.includes(pathname)) {
    return <LoadingScreen />;
  }

  // Sidebar layout: only for dashboard/admin pages when authenticated
  if (isAuthenticated && usesSidebarLayout(pathname)) {
    return (
      <div className="relative flex min-h-screen overflow-x-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 border-r bg-background z-40">
          <SidebarNav />
        </aside>

        {/* Main area */}
        <div className="flex-1 min-w-0 md:pl-60">
          <TopBar />
          <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
        </div>
      </div>
    );
  }

  // Public layout: landing, tournaments, org pages, etc.
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
