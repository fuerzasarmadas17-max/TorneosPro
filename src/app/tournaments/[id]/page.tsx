import Link from "next/link";
import { Button } from "@/components/ui/button";
import { fetchTournamentForPage } from "@/lib/db/tournaments-server";
import { TournamentDetailClient } from "./tournament-detail-client";

/**
 * Cache de Edge para 60 segundos. Los visitantes que entran al mismo
 * torneo dentro de esa ventana reciben el HTML pre-renderizado de la
 * caché de Vercel — cero queries a Supabase, cero tiempo de fetch. Para
 * un link de WhatsApp que reciben 20 personas en 5 minutos, solo 1
 * paga el costo real; las otras 19 ven el torneo instantáneo.
 *
 * 60s es un buen balance: corto suficiente para que cambios de
 * resultados se vean rápido, largo suficiente para amortizar la query.
 * Cuando un anotador o el organizador guarda un cambio, la próxima
 * petición después de los 60s revalida automáticamente.
 */
export const revalidate = 60;

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fetch en el servidor — los users en mobile no descargan ni esperan
  // nada para ver el torneo. El HTML ya viene con la data.
  const initialData = await fetchTournamentForPage(id);

  if (!initialData) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Torneo no encontrado</h1>
        <p className="text-muted-foreground mt-2">
          El torneo que buscas no existe
        </p>
        <Button asChild className="mt-4">
          <Link href="/tournaments">Ver todos los torneos</Link>
        </Button>
      </div>
    );
  }

  return <TournamentDetailClient initialData={initialData} />;
}
