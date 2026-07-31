"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { UserNav } from "@/components/layout/user-nav";
import { MobileNav } from "@/components/layout/mobile-nav";

// Decisión con el organizador: el menú NO incorpora Equipos / Calendario /
// Rankings / Recursos como dibuja el mockup. Queda con lo que existe.
// `mobile-nav.tsx` repite esta misma lista para el celular.
const NAV = [
  { href: "/tournaments", label: "Torneos" },
  { href: "/pricing", label: "Precios" },
];

export function Header() {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background">
      {/* El hueco entre el logo y el nav está medido sobre el mockup: ahí el
          logo termina en x=320 y "Torneos" arranca en x=383 sobre un ancho de
          1672, o sea ~3,8% del ancho ≈ 48px en nuestro contenedor.
          `min-w-0` para que el contenido nunca empuje el ancho del documento:
          en celular esto sumaba ~493px sobre 375 disponibles y aparecía
          scroll horizontal. */}
      <div className="container mx-auto flex h-14 min-w-0 items-center gap-3 px-4 md:gap-12">
        {/* Hamburguesa: solo en celular. Se lleva adentro los links del nav y
            los botones de sesión, que es lo que no entraba. */}
        <MobileNav />

        {/* El nombre va como texto (Geist extrabold itálica) y el trofeo es
            el de la marca, recortado del logo oficial a `public/logo/`.
            Trazo negro sobre transparente, así que `dark:invert` lo pasa a
            blanco en oscuro sin necesitar un segundo archivo. */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-base font-extrabold tracking-tight italic uppercase md:text-lg"
        >
          Torneos Pro
          <Image
            src="/logo/trofeo.png"
            alt=""
            width={233}
            height={228}
            priority
            className="h-5 w-auto md:h-6 dark:invert"
          />
        </Link>

        {/* Nav inline: solo escritorio. En celular vive dentro de MobileNav. */}
        <nav className="hidden items-center gap-5 md:flex">
          {NAV.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                // El subrayado dorado de la pestaña activa es del mockup.
                // `border-b-2` transparente en las inactivas para que el
                // texto no salte al activarse.
                className={`border-b-2 py-4 text-sm font-medium transition-colors ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Buscar torneos"
            className="hidden sm:inline-flex"
            asChild
          >
            <Link href="/tournaments">
              <Search className="size-4" />
            </Link>
          </Button>

          {isAuthenticated ? (
            <UserNav />
          ) : (
            <>
              <span className="hidden h-6 w-px bg-border md:block" aria-hidden />
              {/* En celular solo queda "Registrarse": "Iniciar Sesión" está
                  dentro de la hamburguesa, así que nadie se queda sin poder
                  entrar. */}
              <Button variant="ghost" size="sm" className="hidden md:flex" asChild>
                <Link href="/login">Iniciar Sesión</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Registrarse</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
