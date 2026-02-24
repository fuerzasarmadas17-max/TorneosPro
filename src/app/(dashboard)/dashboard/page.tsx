"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AuthGuard } from "@/components/auth-guard";
import { TournamentList } from "@/components/tournaments/tournament-list";
import { useAuth } from "@/context/auth-context";
import { useTournaments } from "@/context/tournament-context";
import { supabase } from "@/lib/supabase";

function DashboardContent() {
  const { user, isLoading: authLoading } = useAuth();
  const { tournaments, isLoading: tourLoading } = useTournaments();
  const [dbTest, setDbTest] = useState("testing...");

  useEffect(() => {
    // Raw fetch test — completely bypasses Supabase client
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    setDbTest(`url: ${url ? url.substring(0, 30) + "..." : "MISSING"} | key: ${key ? key.substring(0, 10) + "..." : "MISSING"}`);

    if (url && key) {
      fetch(`${url}/rest/v1/tournaments?select=id,name&limit=3`, {
        headers: {
          "apikey": key,
          "Authorization": `Bearer ${key}`,
        },
      })
        .then(res => res.json().then(data => {
          setDbTest(prev => prev + ` | fetch: ${res.status} ${Array.isArray(data) ? data.length + " rows" : JSON.stringify(data).substring(0, 80)}`);
        }))
        .catch(err => {
          setDbTest(prev => prev + ` | fetch ERROR: ${err.message}`);
        });
    }
  }, []);

  const myTournaments = tournaments.filter(
    (t) => t.createdBy === user?.id
  );

  const stats = {
    total: myTournaments.length,
    inProgress: myTournaments.filter((t) => t.status === "in-progress").length,
    completed: myTournaments.filter((t) => t.status === "completed").length,
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* DEBUG — remover después */}
      <div className="rounded-lg bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 p-3 text-xs font-mono space-y-1">
        <p>authLoading: {String(authLoading)} | tourLoading: {String(tourLoading)}</p>
        <p>user.id: {user?.id ?? "NULL"} | orgProfile: {user?.organizationProfile ? "SI" : "NO"}</p>
        <p>tournaments total: {tournaments.length} | myTournaments: {myTournaments.length}</p>
        <p>createdBy sample: {tournaments[0]?.createdBy ?? "N/A"}</p>
        <p>DB test: {dbTest}</p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Hola, {user?.name}</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus torneos desde aqui
          </p>
        </div>
        <Button asChild>
          <Link href="/tournaments/create">Crear Torneo</Link>
        </Button>
      </div>

      {/* Public profile link */}
      {user?.organizationProfile?.isPublic && (
        <div className="rounded-lg border bg-card p-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Tu perfil publico: <span className="font-medium text-foreground">/{user.organizationProfile.slug}</span>
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${user.organizationProfile.slug}`} target="_blank">
              Ver perfil
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Torneos</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">En Curso</p>
            <p className="text-3xl font-bold text-green-500">
              {stats.inProgress}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Completados</p>
            <p className="text-3xl font-bold">{stats.completed}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tournaments */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Mis Torneos</h2>
        {myTournaments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <p className="text-muted-foreground text-lg">
                Aun no has creado torneos
              </p>
              <Button asChild>
                <Link href="/tournaments/create">Crear mi primer torneo</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <TournamentList tournaments={myTournaments} />
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
