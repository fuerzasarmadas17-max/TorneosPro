import { getProfileOgData } from "@/lib/og/data";
import { profileOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/render";

// Tarjeta OG del perfil del organizador. Usa la foto (logo_url) que subió;
// si no tiene, cae a un avatar con iniciales sobre un gradiente.
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Organizador en TorneosPro";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getProfileOgData(slug);
  if (!data) {
    return profileOgImage({
      name: "TorneosPro",
      location: null,
      bio: "Gestiona tus torneos deportivos",
      logo: null,
    });
  }
  return profileOgImage(data);
}
