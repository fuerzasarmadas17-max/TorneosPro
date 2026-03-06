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

export function formatDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
}
