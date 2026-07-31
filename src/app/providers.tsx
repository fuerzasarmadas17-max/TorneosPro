"use client";

import { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/context/auth-context";
import { TournamentProvider } from "@/context/tournament-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    // `system` y sin switch manual: el modo oscuro sigue la configuración
    // del teléfono, que es lo que se decidió con el organizador. El
    // `attribute="class"` es lo que prende el bloque `.dark` de
    // globals.css, que hasta ahora estaba escrito pero muerto.
    // disableTransitionOnChange evita el barrido de colores cuando el
    // sistema cambia de tema con la app abierta.
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <TournamentProvider>{children}</TournamentProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
