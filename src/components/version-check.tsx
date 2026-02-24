"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function VersionCheck() {
  const knownBuildId = useRef<string | null>(null);

  useEffect(() => {
    async function checkVersion() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { buildId } = await res.json();

        if (knownBuildId.current === null) {
          // First check — store the current version
          knownBuildId.current = buildId;
          return;
        }

        if (buildId !== knownBuildId.current) {
          toast("Nueva version disponible", {
            description: "La aplicacion se ha actualizado.",
            duration: Infinity,
            action: {
              label: "Recargar",
              onClick: () => window.location.reload(),
            },
          });
          // Update ref so we don't show the toast again
          knownBuildId.current = buildId;
        }
      } catch {
        // Network error — silently ignore
      }
    }

    // Initial check after a short delay
    const initialTimer = setTimeout(checkVersion, 5000);
    // Periodic poll
    const interval = setInterval(checkVersion, POLL_INTERVAL);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  return null;
}
