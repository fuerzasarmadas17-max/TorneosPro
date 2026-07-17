"use client";

import { useEffect } from "react";

/**
 * Forces a full reload when the browser restores the page from bfcache
 * (back/forward cache) — without this, a stale RSC payload can show data
 * the server already replaced.
 *
 * The previous version also polled /api/version every 5 minutes and
 * raised a persistent toast ("Nueva versión disponible") whenever a new
 * build was deployed. With frequent deploys that toast was firing
 * constantly and the team found it noisy, so the polling + toast were
 * removed. The bfcache reload handler stays because it fixes a real
 * staleness bug.
 */
export function VersionCheck() {
  useEffect(() => {
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        window.location.reload();
      }
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  return null;
}
