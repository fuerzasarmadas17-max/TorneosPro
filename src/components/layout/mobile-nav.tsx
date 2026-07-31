"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

// Los mismos destinos que el nav de escritorio en `header.tsx`. Si se agrega
// uno allá, va acá también.
const NAV = [
  { href: "/tournaments", label: "Torneos" },
  { href: "/pricing", label: "Precios" },
];

/**
 * Menú de celular.
 *
 * Existe porque en 375px no entran a la vez el logotipo, los dos links del
 * nav, "Iniciar Sesión" y "Registrarse": sumaban ~493px y empujaban el ancho
 * del documento, con el scroll horizontal que eso trae. Acá el header se
 * queda con hamburguesa + logo + "Registrarse", y todo lo demás vive adentro.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="-ml-2 md:hidden">
            <Menu className="size-5" />
            <span className="sr-only">Menú</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] px-4">
          <SheetTitle className="mb-6 text-lg font-extrabold tracking-tight italic uppercase">
            Torneos Pro
          </SheetTitle>
          <nav className="flex flex-col gap-1">
            {NAV.map(({ href, label }) => {
              const active =
                pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-accent text-primary"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {label}
                </Link>
              );
            })}

            {isAuthenticated ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                >
                  Dashboard
                </Link>
                <Link
                  href="/tournaments/create"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                >
                  Crear Torneo
                </Link>
                <div className="mt-4 space-y-2 border-t pt-4">
                  <p className="mb-2 px-3 text-sm text-muted-foreground">
                    {user?.name}
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      // Cerramos el sheet primero: el diálogo y el sheet son
                      // dos capas modales y se pelean el foco si se solapan.
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
              <div className="mt-4 flex flex-col gap-2 border-t pt-4">
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
