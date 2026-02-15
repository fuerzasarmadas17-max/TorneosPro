"use client";

import { ReactNode } from "react";
import { AuthProvider } from "@/context/auth-context";
import { TournamentProvider } from "@/context/tournament-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <TournamentProvider>{children}</TournamentProvider>
    </AuthProvider>
  );
}
