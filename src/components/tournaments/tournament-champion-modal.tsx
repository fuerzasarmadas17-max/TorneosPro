"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Tournament } from "@/types";
import { getFinalSeriesChampion } from "@/data/helpers";
import { useTournaments } from "@/context/tournament-context";
import { supabase } from "@/lib/supabase";
import {
  resizeImageForUpload,
  IMAGE_SIZES,
  MAX_UPLOAD_BYTES,
  isImageFile,
} from "@/lib/images";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, ImageIcon, Loader2 } from "lucide-react";
import { ChampionHeader } from "@/components/tournaments/tournament-champion-header";
import { ChampionSponsorsStrip } from "@/components/tournaments/champion-sponsors-strip";

interface TournamentChampionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament;
  /** True when the user is the tournament organizer. The upload UI only renders
   *  for them. Public viewers see this modal via the read-only viewer instead
   *  (TournamentChampionViewerModal) once the photo is set. */
  isOrganizer?: boolean;
  /** Force the upload UI even when a photo is already persisted. Used by the
   *  "Reemplazar foto del campeón" button so the organizer can swap the photo
   *  after the original upload (or skip). */
  forceUpload?: boolean;
}

/**
 * Celebration modal that fires when the tournament transitions to
 * `status === "completed"` during the session — i.e. the organizer just
 * loaded the result that crowned the champion. One-shot per page load to
 * match Pieza F's modal semantics (a reload won't re-fire it).
 *
 * Pieza J: when the organizer hasn't uploaded a champion photo yet, this
 * modal also shows a horizontal-photo uploader so they can publish it in
 * the same flow. Once saved, every visitor sees the photo via the
 * always-on-load viewer modal.
 */
export function TournamentChampionModal({
  open,
  onOpenChange,
  tournament,
  isOrganizer = false,
  forceUpload = false,
}: TournamentChampionModalProps) {
  const { teams, updateTournamentProps } = useTournaments();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // Local preview before persist — flips back to null after save so the next
  // open shows the persisted URL via `tournament.championPhotoUrl`.
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState<string | null>(null);

  // Champion comes from the Pieza I helper so the modal works for single,
  // double-leg AND best-of-N final formats uniformly. For the runner-up we
  // pick the other team that played in the final series.
  const championId = getFinalSeriesChampion(tournament);
  const playoff = tournament.matches.filter(
    (m) => m.phase === "playoff" || !m.phase
  );
  const maxRound =
    playoff.length > 0 ? Math.max(...playoff.map((m) => m.round)) : 0;
  const lastRound = playoff
    .filter((m) => m.round === maxRound)
    .sort((a, b) => a.matchNumber - b.matchNumber);
  const firstFinal = lastRound[0];
  const runnerUpId =
    championId && firstFinal
      ? firstFinal.homeTeamId === championId
        ? firstFinal.awayTeamId
        : firstFinal.homeTeamId === null
          ? null
          : firstFinal.homeTeamId
      : null;
  const championTeam = championId
    ? (teams.find((t) => t.id === championId) ?? null)
    : null;
  const championName = championTeam?.name ?? "El campeón";
  const runnerUpName = runnerUpId
    ? teams.find((t) => t.id === runnerUpId)?.name ?? null
    : null;

  // Persisted photo wins; pending local preview is shown only until save.
  const photoUrl = tournament.championPhotoUrl || pendingPhotoUrl;
  // Show upload UI when organizer has no photo OR the caller forced replace
  // mode (and we haven't already uploaded a new one in this session).
  const showUpload =
    isOrganizer && (forceUpload ? !pendingPhotoUrl : !tournament.championPhotoUrl);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isImageFile(file)) {
      toast.error("El archivo debe ser una imagen (PNG, JPG, etc.)");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("La imagen no debe superar los 12MB");
      return;
    }

    setUploading(true);
    const { blob, ext } = await resizeImageForUpload(file, {
      maxDim: IMAGE_SIZES.photo,
    });
    // Requires the storage RLS policy `Usuarios suben imagenes` to whitelist
    // the `champions/` prefix (migration 20260607_storage_champions_prefix).
    const path = `champions/${tournament.id}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from("images")
      .upload(path, blob, { contentType: blob.type });
    if (error) {
      console.error("Storage upload error:", error);
      toast.error("Error al subir la foto: " + error.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("images")
      .getPublicUrl(path);

    // Persist immediately so any other viewer also sees it on next load.
    try {
      await updateTournamentProps(tournament.id, {
        championPhotoUrl: urlData.publicUrl,
      });
      setPendingPhotoUrl(urlData.publicUrl);
      toast.success("Foto del campeón publicada");
    } catch (err) {
      console.error("Save champion photo error:", err);
      toast.error("No pudimos guardar la foto. Intentá de nuevo.");
    }

    setUploading(false);
    // Reset the input so picking the same file again still fires onChange.
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* max-h + scroll: con la fila de logos, la foto, los patrocinadores y
          los dos botones de subida, el modal pasaba el alto de la pantalla y
          se cortaba arriba y abajo — el Dialog base no limita el alto y va
          centrado con translate, así que lo que sobra queda fuera de la
          pantalla y sin forma de llegar. `dvh` y no `vh` por el navegador del
          celular, donde la barra de direcciones se come parte del `vh`. */}
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto gap-3">
        <DialogHeader>
          <ChampionHeader
            title="¡Tenemos campeón!"
            teamLogoUrl={championTeam?.logoUrl}
            teamName={championName}
            description={
              <>
                <span className="font-semibold text-foreground">
                  {championName}
                </span>{" "}
                se consagró campeón del torneo{" "}
                <span className="font-semibold text-foreground">
                  {tournament.name}
                </span>
                .
              </>
            }
          />
        </DialogHeader>

        {runnerUpName && (
          <p className="text-sm text-muted-foreground text-center -mt-2">
            Subcampeón:{" "}
            <span className="font-medium text-foreground">{runnerUpName}</span>
          </p>
        )}

        {/* Preview of the uploaded/persisted photo. Horizontal aspect (16:9).
            Cuando el organizador está eligiendo foto, la vista previa va
            angosta: a lo ancho del modal mide casi 300px de alto y empujaba
            los botones de subida fuera de la pantalla, que es justo lo que
            viene a hacer acá. Ya publicada se muestra grande. */}
        {photoUrl && (
          <div
            className={`relative aspect-video overflow-hidden rounded-lg border bg-muted ${
              showUpload ? "mx-auto w-full max-w-[280px]" : "w-full"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt={`Campeón ${championName}`}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        )}

        {/* Sponsors strip below the photo — same data as the tournament's
            public sponsor banner, scaled down so 1..N logos fit cleanly. */}
        <ChampionSponsorsStrip
          sponsors={tournament.sponsors}
          tournamentId={tournament.id}
        />

        {/* Organizer-only uploader: shows when there's no persisted photo, OR
            when the caller forced replace mode (so the organizer can swap the
            current one). We hide the uploader once a new photo lands locally
            via `pendingPhotoUrl` so the success state isn't cluttered. */}
        {showUpload && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center">
              {tournament.championPhotoUrl
                ? "Reemplazá la foto del equipo campeón."
                : "Subí una foto del equipo campeón. La verá cualquiera que entre al torneo."}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Subiendo…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {tournament.championPhotoUrl
                    ? "Elegir otra foto"
                    : "Subir foto del campeón"}
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              <ImageIcon className="h-3 w-3 inline mr-1" />
              Horizontal (16:9). Máximo 12MB.
            </p>
          </div>
        )}

        <DialogFooter className="sm:justify-center">
          <Button onClick={() => onOpenChange(false)}>
            {photoUrl ? "Cerrar" : showUpload ? "Saltar por ahora" : "Cerrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
