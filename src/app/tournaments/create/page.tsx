"use client";

import { AuthGuard } from "@/components/auth-guard";
import { CreateTournamentForm } from "@/components/forms/create-tournament-form";

export default function CreateTournamentPage() {
  return (
    <AuthGuard>
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <CreateTournamentForm />
      </div>
    </AuthGuard>
  );
}
