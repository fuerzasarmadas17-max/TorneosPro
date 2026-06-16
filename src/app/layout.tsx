import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { VersionCheck } from "@/components/version-check";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Torneos Pro",
  description: "Gestiona tus torneos deportivos",
  // Manifest PWA — generado por `app/manifest.ts`. Esto le dice al
  // browser/PWA dónde encontrarlo (Next sirve /manifest.webmanifest).
  manifest: "/manifest.webmanifest",
  icons: {
    // Browser tab — dos variants según prefers-color-scheme. Chrome,
    // Firefox y Safari modernos respetan el `media` attribute.
    icon: [
      {
        url: "/icons/icon-32.png",
        sizes: "32x32",
        type: "image/png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icons/icon-32-dark.png",
        sizes: "32x32",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    // Fallback para clientes que no soportan media queries en icons.
    shortcut: "/favicon.ico",
    // iOS home screen.
    apple: [
      { url: "/icons/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

// Color de la status bar / address bar en mobile. Soporta variants por
// color scheme — Chrome Android los respeta. iOS Safari usa el primero
// que matchea.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

// Host de Supabase para hint de conexión temprana al browser. Se
// inferéncia de la env var en build time; si por alguna razón no está
// disponible, omitimos el preconnect (degrada a comportamiento normal).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseHost = SUPABASE_URL ? new URL(SUPABASE_URL).origin : null;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Preconnect a Supabase: el browser establece el handshake
            TCP+TLS antes de que el primer fetch lo pida. Ahorra
            ~200-400ms en la primera query del cliente. */}
        {supabaseHost && (
          <>
            <link rel="preconnect" href={supabaseHost} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={supabaseHost} />
          </>
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <AppShell>{children}</AppShell>
          <Toaster />
          <VersionCheck />
        </Providers>
      </body>
    </html>
  );
}
