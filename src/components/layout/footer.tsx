import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="border-t py-6 md:py-0">
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 md:h-16 md:flex-row">
        <div className="flex flex-col items-center gap-1 md:flex-row md:gap-3">
          <span className="flex items-center gap-1.5 text-sm font-extrabold tracking-tight italic uppercase">
            Torneos Pro
            <Image
              src="/logo/trofeo.png"
              alt=""
              width={233}
              height={228}
              className="h-4 w-auto dark:invert"
            />
          </span>
          <p className="text-center text-sm text-muted-foreground md:text-left">
            &copy; {new Date().getFullYear()} · Gestiona tus torneos deportivos.
          </p>
        </div>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link
            href="/pricing"
            className="transition-colors hover:text-foreground"
          >
            Precios
          </Link>
          <Link
            href="/privacidad"
            className="transition-colors hover:text-foreground"
          >
            Privacidad
          </Link>
          <Link
            href="/tratamiento-de-datos"
            className="transition-colors hover:text-foreground"
          >
            Tratamiento de datos
          </Link>
        </nav>
      </div>
    </footer>
  );
}
