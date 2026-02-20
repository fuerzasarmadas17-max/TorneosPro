"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useTournaments } from "@/context/tournament-context";
import { Header } from "./header";
import { Footer } from "./footer";
import { SidebarNav } from "./sidebar-nav";
import { TopBar } from "./top-bar";
import { Loader2 } from "lucide-react";

const AUTH_PAGES = ["/login", "/register"];
const SIDEBAR_PREFIXES = ["/dashboard", "/admin"];

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

  // Wait for both auth and data to load — single loading screen, no cascading flashes
  if (authLoading || dataLoading) {
    return <LoadingScreen />;
  }

  // Logged out but still on a sidebar page (e.g. just logged out) — show loading
  if (!isAuthenticated && usesSidebarLayout(pathname)) {
    return <LoadingScreen />;
  }

  // Authenticated but still on auth page (navigating to dashboard) — show loading
  if (isAuthenticated && AUTH_PAGES.includes(pathname)) {
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
