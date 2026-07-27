"use client";

import { toast } from "sonner";
import { Copy, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ScorerLinkRow,
  isScorerLinkActive,
} from "@/hooks/use-scorer-links";

/**
 * Piezas de UI compartidas entre la sección de anotadores de un torneo y el
 * diálogo multi-torneo del dashboard: la URL del link, el modal de compartir
 * y la fila de un link existente.
 */

export function scorerLinkUrl(token: string): string {
  return typeof window !== "undefined"
    ? `${window.location.origin}/score/${token}`
    : `/score/${token}`;
}

export function shareScorerLinkOnWhatsApp(token: string) {
  const text = `Hola! Por favor anotá estos partidos: ${scorerLinkUrl(token)}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}

export async function copyScorerLink(token: string) {
  try {
    await navigator.clipboard.writeText(scorerLinkUrl(token));
    toast.success("Link copiado");
  } catch {
    toast.error("No pudimos copiar. Probá manualmente.");
  }
}

// ============================================================
// Modal del link recién creado
// ============================================================

export function ShareScorerLinkDialog({
  token,
  onClose,
}: {
  token: string | null;
  onClose: () => void;
}) {
  const url = token ? scorerLinkUrl(token) : "";

  return (
    <Dialog open={!!token} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>✓ Link creado</DialogTitle>
          <DialogDescription>
            Compartilo con el anotador. Va a poder cargar los resultados sin
            tener que iniciar sesión.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted p-3 text-xs font-mono break-all">
          {url}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => token && copyScorerLink(token)}>
            <Copy className="h-4 w-4 mr-2" /> Copiar link
          </Button>
          <Button onClick={() => token && shareScorerLinkOnWhatsApp(token)}>
            <MessageSquare className="h-4 w-4 mr-2" /> WhatsApp
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Fila de un link existente
// ============================================================

export function ScorerLinkRowItem({
  link,
  subtitle,
  onRevoke,
}: {
  link: ScorerLinkRow;
  /** Línea opcional que describe qué cubre el link (torneos / partidos). */
  subtitle?: string;
  onRevoke: () => void;
}) {
  const isRevoked = !!link.revoked_at;
  const isActive = isScorerLinkActive(link);
  const isExpired = !isRevoked && !isActive;

  const expiresLabel = new Date(link.expires_at).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-md border bg-muted/30 p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {isActive && <Badge variant="default" className="text-[10px]">Activo</Badge>}
          {isExpired && <Badge variant="secondary" className="text-[10px]">Expirado</Badge>}
          {isRevoked && <Badge variant="destructive" className="text-[10px]">Revocado</Badge>}
          <span className="text-xs text-muted-foreground">
            {link.match_ids.length}{" "}
            {link.match_ids.length === 1 ? "partido" : "partidos"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isActive && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => copyScorerLink(link.token)}
              >
                <Copy className="h-3 w-3 mr-1" /> Copiar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => shareScorerLinkOnWhatsApp(link.token)}
              >
                <MessageSquare className="h-3 w-3 mr-1" /> WhatsApp
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-destructive"
                onClick={onRevoke}
              >
                <X className="h-3 w-3 mr-1" /> Revocar
              </Button>
            </>
          )}
        </div>
      </div>
      {subtitle && (
        <div className="text-[11px] text-muted-foreground">{subtitle}</div>
      )}
      <div className="text-[11px] text-muted-foreground">
        Expira: {expiresLabel} · {link.usage_count} cargas
        {link.last_used_at && (
          <>
            {" "}
            · Última actividad:{" "}
            {new Date(link.last_used_at).toLocaleString("es-CO", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </>
        )}
      </div>
    </div>
  );
}
