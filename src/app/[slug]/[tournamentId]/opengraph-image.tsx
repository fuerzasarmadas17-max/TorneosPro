import { getTournamentOgData } from "@/lib/og/data";
import {
  tournamentOgImage,
  profileOgImage,
  OG_SIZE,
  OG_CONTENT_TYPE,
} from "@/lib/og/render";

// Misma tarjeta de torneo, pero para la URL del perfil del organizador
// (/[slug]/[tournamentId]) — que es la que comparten por WhatsApp. La
// página es client-only, pero este archivo de imagen corre en el servidor
// y Next inyecta el <meta og:image> igual.
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Torneo en TorneosPro";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string; tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const data = await getTournamentOgData(tournamentId);
  if (!data) {
    return profileOgImage({
      name: "TorneosPro",
      location: null,
      bio: "Gestiona tus torneos deportivos",
      logo: null,
    });
  }
  return tournamentOgImage(data);
}
