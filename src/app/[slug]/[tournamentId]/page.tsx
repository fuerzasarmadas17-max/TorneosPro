"use client";

import { useParams, notFound } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrganizationProfile } from "@/types";
import { TournamentDetail } from "@/components/tournaments/tournament-detail";
import { AdModal } from "@/components/ads/ad-modal";
import { getUserBySlug } from "@/data/users";
import { useTournaments } from "@/context/tournament-context";
import { usePageView } from "@/hooks/use-page-view";
import { fetchTeamsByIds } from "@/lib/db/teams";
import {
  fetchMatchEventsByMatchIds,
  fetchTournamentById,
} from "@/lib/db/tournaments";
import { supabase } from "@/lib/supabase";
import { mapMatchEvent } from "@/lib/db/mappers";
import type { Tournament } from "@/types";

interface ProfileUser {
  id: string;
  name: string;
  isActive: boolean;
  organizationProfile: OrganizationProfile;
}

export default function ProfileTournamentPage() {
  const params = useParams<{ slug: string; tournamentId: string }>();
  const { getTournamentById, seedTournamentData } = useTournaments();
  const [user, setUser] = useState<ProfileUser | undefined>(undefined);
  const [checked, setChecked] = useState(false);
  usePageView("profile_tournament", params.tournamentId, "tournament");

  useEffect(() => {
    getUserBySlug(params.slug).then((found) => {
      setUser(found);
      setChecked(true);
    });
  }, [params.slug]);

  // El visitante ANÓNIMO no tiene la lista global en memoria: `loadTournaments`
  // corre solo para autenticados (bajar todos los torneos del sistema para
  // mostrar uno no se paga). Así que si el torneo no está en contexto, se trae
  // por id y se siembra. Para el organizador logueado esto no hace nada: su
  // lista ya lo tiene y el `if` corta.
  const [fetched, setFetched] = useState<Tournament | null>(null);
  const fetchedRef = useRef<string | null>(null);
  const inContext = getTournamentById(params.tournamentId);
  useEffect(() => {
    if (inContext) return;
    if (fetchedRef.current === params.tournamentId) return;
    fetchedRef.current = params.tournamentId;
    fetchTournamentById(params.tournamentId, supabase, false).then((t) => {
      if (t) setFetched(t);
    });
  }, [inContext, params.tournamentId]);

  // El torneo sale del contexto o de esa consulta. PERO en la vista pública
  // anónima faltan dos cosas que el SSR de /tournaments/[id] sí siembra:
  //   1. Los EQUIPOS: loadTeams() solo corre para autenticados, así que
  //      el `teams[]` global está vacío y las tablas muestran el UUID.
  //   2. Los match_events: el SELECT de la lista los omite (evita el 504),
  //      así que las stats salen "sin registrar".
  // Replicamos el patrón probado de tournament-detail-client: traemos los
  // equipos por IDs (consulta liviana, NO fetchAllTeams) + los eventos, y
  // sembramos al contexto. Una vez por torneo.
  const tournamentForSeed = inContext ?? fetched ?? undefined;
  const seededRef = useRef<string | null>(null);
  useEffect(() => {
    if (!tournamentForSeed) return;
    // Ya sembrado para este torneo: corta el loop (cada seed cambia la
    // referencia de tournamentForSeed y re-dispara el effect).
    if (seededRef.current === tournamentForSeed.id) return;

    // CRÍTICO (React Strict Mode + navegación cliente): NO marcamos
    // seededRef antes del fetch. En Strict Mode el effect corre dos
    // veces (mount → cleanup → mount). Si marcáramos el ref en el primer
    // pase, el segundo saldría temprano y el `active=false` del cleanup
    // del primero descartaría su seed → nunca se siembra. Al marcar el
    // ref recién en el `.then`, el segundo pase vuelve a hacer fetch y
    // sí siembra. En carga directa no se notaba porque tournamentForSeed
    // arranca undefined; en click desde el perfil ya está en contexto.
    let active = true;
    Promise.all([
      fetchTeamsByIds(tournamentForSeed.teamIds),
      fetchMatchEventsByMatchIds(tournamentForSeed.matches.map((m) => m.id)),
    ])
      .then(([seedTeams, eventsMap]) => {
        if (!active) return;
        const enriched: Tournament = {
          ...tournamentForSeed,
          matches: tournamentForSeed.matches.map((m) => {
            const rawEvents = eventsMap.get(m.id);
            return rawEvents
              ? { ...m, events: rawEvents.map(mapMatchEvent) }
              : m;
          }),
        };
        seedTournamentData(enriched, seedTeams);
        seededRef.current = tournamentForSeed.id; // marcar solo al éxito
      })
      .catch((err) => {
        console.error("[public tournament] seed failed", err);
      });

    return () => {
      active = false;
    };
  }, [tournamentForSeed, seedTournamentData]);

  if (!checked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!user || !user.organizationProfile || !user.organizationProfile.isPublic || user.isActive === false) {
    notFound();
  }

  const tournament = getTournamentById(params.tournamentId) ?? fetched;

  if (!tournament || tournament.createdBy !== user.id) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Torneo no encontrado</h1>
        <p className="text-muted-foreground mt-2">
          Este torneo no existe o no pertenece a esta organización
        </p>
        <Button asChild className="mt-4">
          <Link href={`/${params.slug}`}>
            Volver al perfil de {user.organizationProfile.organizationName}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/${params.slug}`}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {user.organizationProfile.organizationName}
        </Link>
      </Button>
      {/* `organizer` da el escudo del encabezado. Sin él, la caja del logo cae
          al emoji del deporte (🏐, ⚽), que es lo que se veía en esta ruta:
          la otra vista del torneo sí lo pasaba —lo resuelve el SSR— y esta no,
          aunque acá el perfil de la organización ya está cargado y a mano. */}
      <TournamentDetail
        tournament={tournament}
        canEdit={false}
        orgSponsors={user.organizationProfile.sponsors}
        organizer={{
          name: user.organizationProfile.organizationName,
          slug: user.organizationProfile.slug,
          logoUrl: user.organizationProfile.logoUrl,
        }}
      />
      <AdModal tournamentId={params.tournamentId} />
    </div>
  );
}
