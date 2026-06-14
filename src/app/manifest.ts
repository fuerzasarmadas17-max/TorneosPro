import type { MetadataRoute } from "next";

/**
 * PWA manifest para Torneos Pro.
 *
 * Cuando el usuario "Agregar a inicio" desde Chrome/Safari mobile, esto
 * controla cómo se ve la app instalada: ícono en home screen, splash
 * screen, color de fondo, modo standalone (sin barra del browser), etc.
 *
 * Notas:
 * - `theme_color`: color de la status bar / address bar de Android.
 *   Mantengo blanco; un meta tag en layout cubre el dark mode con media
 *   query (Chrome moderno lo soporta) — los manifests todavía no aceptan
 *   variants por color scheme.
 * - Icons en 2 tamaños (192 + 512) + 1 maskable para Android adaptive.
 *   iOS usa el apple-icon configurado vía metadata.icons.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Torneos Pro",
    short_name: "TorneosPro",
    description: "Gestiona tus torneos deportivos",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
