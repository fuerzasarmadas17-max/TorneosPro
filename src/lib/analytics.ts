import { supabase } from "@/lib/supabase";

const SESSION_KEY = "tp_session_id";
const SESSION_ACTIVITY_KEY = "tp_session_activity";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function getSessionId(): string {
  if (typeof window === "undefined") return "";

  const now = Date.now();
  const lastActivity = parseInt(
    localStorage.getItem(SESSION_ACTIVITY_KEY) || "0",
    10
  );
  let sessionId = localStorage.getItem(SESSION_KEY);

  if (!sessionId || now - lastActivity > SESSION_TIMEOUT_MS) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  localStorage.setItem(SESSION_ACTIVITY_KEY, now.toString());
  return sessionId;
}

export function getDeviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk/.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android.*mobile|windows phone/.test(ua))
    return "mobile";
  return "desktop";
}

export function getBrowser(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera/")) return "Opera";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Safari/")) return "Safari";
  return "other";
}

export function getCleanReferrer(): string | null {
  if (typeof document === "undefined" || !document.referrer) return null;
  try {
    const ref = new URL(document.referrer);
    if (ref.hostname === window.location.hostname) return null;
    return ref.hostname;
  } catch {
    return null;
  }
}

export interface TrackEventInput {
  /** 'sponsor_click' | 'sponsor_impression' | 'cta_click' | ... */
  eventType: string;
  /** Torneo donde ocurrió (null para landing / nivel organización). */
  tournamentId?: string | null;
  /** id del objetivo: sponsor.id, team.id, etc. */
  targetId?: string | null;
  entityType?: "tournament" | "organization" | null;
  /** user_id del organizador, para eventos a nivel organización. */
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Registra un evento de interacción en `analytics_events`. Fire-and-forget:
 * no bloquea ni lanza. Los clics en patrocinadores abren en pestaña nueva
 * (target="_blank"), así que la página actual NO navega — el insert alcanza
 * a completarse sin necesidad de keepalive.
 */
export function trackEvent(input: TrackEventInput): void {
  if (typeof window === "undefined") return;
  void supabase
    .from("analytics_events")
    .insert({
      event_type: input.eventType,
      tournament_id: input.tournamentId ?? null,
      target_id: input.targetId ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      session_id: getSessionId(),
      device_type: getDeviceType(),
      metadata: input.metadata ?? null,
    })
    .then(({ error }) => {
      if (error) console.error("[trackEvent]", error.message);
    });
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
}
