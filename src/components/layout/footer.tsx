import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t py-6 md:py-0">
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row px-4">
        <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
          Torneos &copy; {new Date().getFullYear()}. Gestiona tus torneos deportivos.
        </p>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/privacidad" className="hover:text-foreground transition-colors">
            Privacidad
          </Link>
          <Link href="/tratamiento-de-datos" className="hover:text-foreground transition-colors">
            Tratamiento de datos
          </Link>
        </nav>
      </div>
    </footer>
  );
}
