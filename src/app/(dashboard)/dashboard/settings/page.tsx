"use client";

import { AuthGuard } from "@/components/auth-guard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OrganizationProfileForm } from "@/components/profile/organization-profile-form";

function SettingsContent() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuracion</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona el perfil publico de tu organizacion
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Perfil de Organizacion</CardTitle>
          <CardDescription>
            Configura tu perfil publico para que otros puedan encontrar tus
            torneos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationProfileForm />
        </CardContent>
      </Card>
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
