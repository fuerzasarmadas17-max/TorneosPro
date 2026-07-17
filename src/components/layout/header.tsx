"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { UserNav } from "@/components/layout/user-nav";

export function Header() {
  const { isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background">
      <div className="container mx-auto flex h-14 items-center px-4">
        <Link href="/" className="mr-6 flex items-center space-x-2 font-bold text-xl">
          Torneos Pro
        </Link>
        <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Precios
        </Link>
        <div className="ml-auto flex items-center space-x-4">
          {isAuthenticated ? (
            <UserNav />
          ) : (
            <div className="hidden md:flex items-center space-x-2">
              <Button variant="ghost" asChild>
                <Link href="/login">Iniciar Sesión</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Registrarse</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
