"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/context/auth-context";
import { OrganizationProfileForm } from "@/components/profile/organization-profile-form";

function SettingsContent() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user?.role === "admin") {
      router.replace("/dashboard");
    }
  }, [user, router]);

  if (user?.role === "admin") return null;

  // Mismo layout que "Crear Torneo": el form es dueño de su propio Card.
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <OrganizationProfileForm />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}
