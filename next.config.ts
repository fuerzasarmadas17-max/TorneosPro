import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers: async () => [
    {
      // Cache-Control para HTML/RSC payloads.
      //
      // ANTES era "no-cache, no-store, must-revalidate" para evitar que
      // un deploy mostrara contenido stale. PERO el `no-store` rompía el
      // bfcache de Safari mobile: cada vez que el usuario volvía al link
      // (ej. cerrar y reabrir WhatsApp, swipe back) era como una visita
      // fresca — petición a Vercel, espera de cientos de ms, render
      // desde cero. Ese era el principal motivo de la lentitud
      // percibida en iPhone vs Facebook/YouTube que usan bfcache (su
      // 2da visita es instantánea desde memoria del browser).
      //
      // AHORA permitimos bfcache (sin `no-store`) y revalidamos en cada
      // navegación normal con `must-revalidate + max-age=0`. Cuando hay
      // un deploy nuevo, el cliente pregunta a Vercel "¿esto cambió?" y
      // Vercel responde con la versión nueva (ETag mismatch). El swipe
      // back / reabrir desde el background siguen siendo instantáneos
      // como en cualquier app moderna.
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      headers: [
        {
          key: "Cache-Control",
          value: "private, max-age=0, must-revalidate",
        },
      ],
    },
  ],
};

export default nextConfig;
