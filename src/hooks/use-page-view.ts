"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  getSessionId,
  getVisitorId,
  getDeviceType,
  getBrowser,
  getCleanReferrer,
} from "@/lib/analytics";

type PageType =
  | "home"
  | "browse"
  | "tournament"
  | "profile"
  | "profile_tournament";
type EntityType = "tournament" | "organization" | null;

export function usePageView(
  pageType: PageType,
  entityId: string | null | undefined,
  entityType: EntityType
) {
  const viewIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const trackedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Don't track if entity is expected but not yet loaded
    if (entityType && !entityId) return;
    // Guard against React Strict Mode double-fire
    if (trackedRef.current) return;
    trackedRef.current = true;

    const sessionId = getSessionId();
    const visitorId = getVisitorId();
    startTimeRef.current = Date.now();

    // Generamos el id en el cliente para poder actualizar `duration_ms`
    // después con un PATCH. La RLS no deja LEER la fila de vuelta (solo el
    // dueño de la entidad puede), así que un insert con .select() fallaría;
    // conociendo el id de antemano evitamos esa lectura.
    const viewId = crypto.randomUUID();
    viewIdRef.current = viewId;

    const insertView = async () => {
      // ¿Había sesión iniciada? Sirve para excluir al propio organizador del
      // requisito de audiencia de "Monetizar": el que revisa su torneo todos
      // los días sumaría ~30 personas-día propias a su propio umbral.
      //
      // Se lee la sesión acá y no vía `useAuth()` para no acoplar el hook al
      // contexto y para tomar el estado en el momento del insert, no en el del
      // render. `getSession()` lee de localStorage, sin ida al servidor.
      //
      // Si falla queda NULL ("no se sabe"), nunca false: marcar como anónimo a
      // alguien que sí estaba logueado le infla el umbral a su favor.
      let isAuthenticated: boolean | null = null;
      try {
        const { data } = await supabase.auth.getSession();
        isAuthenticated = data.session !== null;
      } catch {
        /* queda null */
      }

      const { error } = await supabase.from("page_views").insert({
        id: viewId,
        page_path: window.location.pathname,
        page_type: pageType,
        entity_id: entityId || null,
        entity_type: entityType,
        session_id: sessionId,
        visitor_id: visitorId,
        is_authenticated: isAuthenticated,
        referrer: getCleanReferrer(),
        device_type: getDeviceType(),
        browser: getBrowser(),
      });

      if (error) {
        console.error("[page-view] insert failed:", error.message);
      }
    };

    // Defer la insert para que NO compita con la hidratación inicial ni
    // con queries críticas de la página (ej. el seed del torneo en el
    // detalle). Sale del critical render path y se ejecuta cuando el
    // browser termina lo importante.
    const insertTimer = setTimeout(insertView, 200);

    const updateDuration = () => {
      if (!viewIdRef.current) return;
      const duration = Date.now() - startTimeRef.current;

      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/page_views?id=eq.${viewIdRef.current}`;
      fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ duration_ms: duration }),
        keepalive: true,
      }).catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        updateDuration();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", updateDuration);

    return () => {
      clearTimeout(insertTimer);
      updateDuration();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", updateDuration);
      trackedRef.current = false;
    };
  }, [pageType, entityId, entityType]);
}
