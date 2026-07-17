"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { ChangePasswordDialog } from "@/components/forms/change-password-dialog";
import { useAuth } from "@/context/auth-context";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden mr-2">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[400px]">
        <SheetTitle className="text-lg font-bold mb-6">Torneos</SheetTitle>
        <nav className="flex flex-col space-y-4">
          <Link
            href="/tournaments"
            onClick={() => setOpen(false)}
            className="text-foreground/80 hover:text-foreground transition-colors"
          >
            Torneos
          </Link>
          {isAuthenticated ? (
            <>
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="text-foreground/80 hover:text-foreground transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/tournaments/create"
                onClick={() => setOpen(false)}
                className="text-foreground/80 hover:text-foreground transition-colors"
              >
                Crear Torneo
              </Link>
              <div className="pt-4 border-t space-y-2">
                <p className="text-sm text-muted-foreground mb-2">
                  {user?.name}
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    // Cerramos el sheet primero: el diálogo y el sheet son dos
                    // capas modales y se pelean el foco si se solapan.
                    setOpen(false);
                    setChangePasswordOpen(true);
                  }}
                >
                  Cambiar contraseña
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    logout();
                    setOpen(false);
                  }}
                >
                  Cerrar Sesión
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col space-y-2 pt-4 border-t">
              <Button asChild variant="outline">
                <Link href="/login" onClick={() => setOpen(false)}>
                  Iniciar Sesión
                </Link>
              </Button>
              <Button asChild>
                <Link href="/register" onClick={() => setOpen(false)}>
                  Registrarse
                </Link>
              </Button>
            </div>
          )}
        </nav>
      </SheetContent>
    </Sheet>

    <ChangePasswordDialog
      open={changePasswordOpen}
      onOpenChange={setChangePasswordOpen}
    />
    </>
  );
}
