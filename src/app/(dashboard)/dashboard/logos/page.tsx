"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/context/auth-context";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LogoLibraryManager } from "@/components/logos/logo-library-manager";
import { ClubLogoLibraryManager } from "@/components/logos/club-logo-library-manager";

function LogosContent() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user?.role === "admin") {
      router.replace("/dashboard");
    }
  }, [user, router]);

  if (user?.role === "admin") return null;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Logos</h1>
        <p className="text-sm text-muted-foreground">
          Gestioná los logos de tus patrocinadores y de tus equipos.
        </p>
      </div>

      <Tabs defaultValue="sponsors">
        <TabsList>
          <TabsTrigger value="sponsors">Patrocinadores</TabsTrigger>
          <TabsTrigger value="teams">Equipos</TabsTrigger>
        </TabsList>
        <TabsContent value="sponsors" className="mt-6">
          <LogoLibraryManager />
        </TabsContent>
        <TabsContent value="teams" className="mt-6">
          <ClubLogoLibraryManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function LogosPage() {
  return (
    <AuthGuard>
      <LogosContent />
    </AuthGuard>
  );
}
