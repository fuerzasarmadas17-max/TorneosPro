"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Header } from "./header";
import { Footer } from "./footer";
import { SidebarNav } from "./sidebar-nav";
import { TopBar } from "./top-bar";
import { Loader2 } from "lucide-react";

const AUTH_PAGES = ["/login", "/register"];
const PROTECTED_PREFIXES = ["/dashboard", "/admin"];

function isProtectedPage(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
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
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();

  // While checking auth, show a minimal layout to avoid flash
  if (isLoading) {
    return (
      <div className="relative flex min-h-screen flex-col">
        <div className="flex-1">{children}</div>
      </div>
    );
  }

  // Logged out but still on a protected page (navigating to landing) — show loading
  if (!isAuthenticated && isProtectedPage(pathname)) {
    return <LoadingScreen />;
  }

  // Logged out: original layout
  if (!isAuthenticated) {
    return (
      <div className="relative flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    );
  }

  // Authenticated but still on auth page (navigating to dashboard) — show loading
  if (AUTH_PAGES.includes(pathname)) {
    return <LoadingScreen />;
  }

  // Logged in: sidebar layout
  return (
    <div className="relative flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 border-r bg-background z-40">
        <SidebarNav />
      </aside>

      {/* Main area */}
      <div className="flex-1 md:pl-60">
        <TopBar />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
