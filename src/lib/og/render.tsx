import { ImageResponse } from "next/og";
import { getSportInfo } from "@/data/sports";

// Tamaño estándar de tarjeta Open Graph (WhatsApp, Facebook, Twitter).
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

const FORMAT_LABELS: Record<string, string> = {
  elimination: "Eliminación directa",
  "round-robin": "Liga · Todos contra todos",
  "group-playoff": "Grupos + Playoffs",
};
const STATUS_LABELS: Record<string, string> = {
  upcoming: "Próximamente",
  "in-progress": "En curso",
  completed: "Finalizado",
};
const STATUS_COLOR: Record<string, string> = {
  upcoming: "#64748b",
  "in-progress": "#22c55e",
  completed: "#a855f7",
};

const BG =
  "radial-gradient(1100px 420px at 0% 0%, #14304a 0%, transparent 60%), linear-gradient(135deg, #0b1220 0%, #0f1b2e 100%)";

/**
 * Descarga una imagen remota y la inlinea como data URI. Devuelve null
 * ante cualquier fallo (404, no-imagen, timeout, demasiado grande) para
 * que un logo roto NUNCA rompa la tarjeta OG completa.
 */
export async function toDataUri(url?: string | null): Promise<string | null> {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/png";
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 3_000_000) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export interface TournamentOgData {
  name: string;
  sport: string;
  format: string;
  status: string;
  teamsCount: number;
  organizerName: string | null;
  organizerLogo: string | null; // data URI
  sponsors: string[]; // data URIs
}

export function tournamentOgImage(d: TournamentOgData) {
  const sport = getSportInfo(d.sport);
  const sportLabel = sport?.label ?? "Torneo";
  const emoji = sport?.emoji ?? "🏆";
  const nameSize = d.name.length > 42 ? 54 : d.name.length > 26 ? 70 : 86;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: 64,
          backgroundColor: "#0b1220",
          backgroundImage: BG,
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", fontSize: 32, fontWeight: 700 }}>
            <span style={{ marginRight: 12, fontSize: 38 }}>🏆</span>
            <span>TorneosPro</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: STATUS_COLOR[d.status] ?? "#64748b",
              color: "#ffffff",
              fontSize: 26,
              fontWeight: 600,
              padding: "10px 24px",
              borderRadius: 999,
            }}
          >
            {STATUS_LABELS[d.status] ?? d.status}
          </div>
        </div>

        {/* Centro */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "auto",
            marginBottom: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              alignSelf: "flex-start",
              backgroundColor: "rgba(34,197,94,0.15)",
              border: "2px solid rgba(34,197,94,0.5)",
              borderRadius: 999,
              padding: "8px 22px",
              fontSize: 30,
              color: "#86efac",
              marginBottom: 26,
            }}
          >
            <span style={{ marginRight: 12, fontSize: 34 }}>{emoji}</span>
            <span>{sportLabel}</span>
          </div>
          <div style={{ display: "flex", fontSize: nameSize, fontWeight: 800, lineHeight: 1.05 }}>
            {d.name}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: 26,
              fontSize: 30,
              color: "#cbd5e1",
            }}
          >
            <span>{FORMAT_LABELS[d.format] ?? d.format}</span>
            <span style={{ margin: "0 14px", color: "#475569" }}>•</span>
            <span>{d.teamsCount} equipos</span>
          </div>
        </div>

        {/* Footer: si hay patrocinadores, les damos TODO el ancho con logos
            grandes (y omitimos "Organiza"). Si no hay, mostramos el
            organizador para que el pie no quede vacío. */}
        {d.sponsors.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                display: "flex",
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: 2,
                color: "#94a3b8",
                marginBottom: 16,
              }}
            >
              PATROCINADORES
            </span>
            <div style={{ display: "flex", alignItems: "center" }}>
              {d.sponsors.slice(0, 5).map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 184,
                    height: 108,
                    backgroundColor: "#ffffff",
                    borderRadius: 16,
                    marginRight: 18,
                    padding: 16,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s} alt="" width={152} height={76} style={{ objectFit: "contain" }} />
                </div>
              ))}
            </div>
          </div>
        ) : d.organizerName ? (
          <div style={{ display: "flex", alignItems: "center" }}>
            {d.organizerLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={d.organizerLogo}
                alt=""
                width={64}
                height={64}
                style={{
                  borderRadius: 16,
                  objectFit: "cover",
                  marginRight: 16,
                  border: "2px solid rgba(255,255,255,0.2)",
                }}
              />
            ) : null}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 22, color: "#94a3b8" }}>Organiza</span>
              <span style={{ fontSize: 30, fontWeight: 700 }}>{d.organizerName}</span>
            </div>
          </div>
        ) : null}
      </div>
    ),
    { ...OG_SIZE }
  );
}

export interface ProfileOgData {
  name: string;
  location: string | null;
  bio: string | null;
  logo: string | null; // data URI
}

export function profileOgImage(d: ProfileOgData) {
  const initials =
    d.name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "T";
  const nameSize = d.name.length > 22 ? 56 : 72;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          backgroundColor: "#0b1220",
          backgroundImage: BG,
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* Izquierda: foto o avatar con iniciales */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 480,
            height: "100%",
            backgroundColor: "rgba(255,255,255,0.03)",
          }}
        >
          {d.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={d.logo}
              alt=""
              width={336}
              height={336}
              style={{
                borderRadius: 32,
                objectFit: "cover",
                border: "4px solid rgba(255,255,255,0.15)",
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 320,
                height: 320,
                borderRadius: 9999,
                fontSize: 140,
                fontWeight: 800,
                backgroundImage: "linear-gradient(135deg,#22c55e,#0ea5e9)",
                color: "#ffffff",
              }}
            >
              {initials}
            </div>
          )}
        </div>

        {/* Derecha: info */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            padding: "0 64px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: 26,
              fontWeight: 700,
              color: "#86efac",
              marginBottom: 22,
            }}
          >
            <span style={{ marginRight: 10, fontSize: 32 }}>🏆</span>
            <span>TorneosPro</span>
          </div>
          <div style={{ display: "flex", fontSize: nameSize, fontWeight: 800, lineHeight: 1.05 }}>
            {d.name}
          </div>
          {d.location ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginTop: 22,
                fontSize: 28,
                color: "#cbd5e1",
              }}
            >
              <span style={{ marginRight: 10 }}>📍</span>
              <span>{d.location}</span>
            </div>
          ) : null}
          {d.bio ? (
            <div style={{ display: "flex", marginTop: 24, fontSize: 26, color: "#94a3b8", lineHeight: 1.3 }}>
              {d.bio.length > 120 ? d.bio.slice(0, 120) + "…" : d.bio}
            </div>
          ) : (
            <div style={{ display: "flex", marginTop: 24, fontSize: 26, color: "#94a3b8" }}>
              Organizador deportivo
            </div>
          )}
        </div>
      </div>
    ),
    { ...OG_SIZE }
  );
}
