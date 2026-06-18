import { getTournamentOgData } from "@/lib/og/data";
import {
  tournamentOgImage,
  profileOgImage,
  OG_SIZE,
  OG_CONTENT_TYPE,
} from "@/lib/og/render";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Torneo en TorneosPro";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getTournamentOgData(id);
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
