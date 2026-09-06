"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Tournament } from "@/types";
import { useTournaments } from "@/context/tournament-context";
import { supabase } from "@/lib/supabase";
import {
  resizeImageForUpload,
  IMAGE_SIZES,
  MAX_UPLOAD_BYTES,
  isImageFile,
} from "@/lib/images";
import {
  buildPlayerNameOptions,
  normalizePlayerName,
} from "@/lib/name-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MvpPicker, type MvpSelection } from "@/components/forms/mvp-picker";
import { Star, Upload, ImageIcon, Loader2, Trash2 } from "lucide-react";

/**
 * MVP del torneo: el organizador elige al mejor jugador y le sube una foto.
 * Se abre desde el detalle del torneo, solo para el organizador y solo cuando
 * el torneo está `completed` — hermano del modal de la foto del campeón.
 *
 * La foto es VERTICAL (3:4). Es una persona sola: el 16:9 del campeón, pensado
 * para un equipo formado en fila, la recortaría por la mitad.
 *
 * Elegir al MVP es del organizador, no del sistema, y funciona en todos los
 * deportes tenga o no prendida la estadística de MVP por partido. Cuando sí la
 * llevó, se le sugiere el que más ganó — pero es una sugerencia: hay ligas
 * donde el MVP del torneo lo vota un jurado y no tiene por qué coincidir.
 *
 * Todo se guarda de una sola vez con "Guardar": la foto se sube recién ahí. Si
 * se subiera al elegir el archivo, cerrar el modal sin guardar dejaría una
 * imagen huérfana en el bucket y un MVP a medias.
 */
export function TournamentMvpModal({
  open,
  onOpenChange,
  tournament,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament;
}) {
  const { teams, updateTournamentProps } = useTournaments();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mvp, setMvp] = useState<MvpSelection | null>(
    tournament.mvpPlayerName && tournament.mvpTeamId
      ? {
          teamId: tournament.mvpTeamId,
          playerName: tournament.mvpPlayerName,
        }
      : null
  );

  const tournamentTeams = useMemo(
    () => teams.filter((t) => tournament.teamIds.includes(t.id)),
    [teams, tournament.teamIds]
  );

  // Candidatos: la nómina de cada equipo más los nombres que ya aparecieron en
  // estadísticas de ese equipo. Es la misma fuente que usa el form de
  // resultado, así que un goleador cargado a mano —que nunca se inscribió—
  // también se puede elegir como MVP.
  const pickerTeams = useMemo(
    () =>
      tournamentTeams.map((t) => ({
        teamId: t.id,
        teamName: t.name,
        options: buildPlayerNameOptions(
          (t.players ?? []).map((p) => p.name),
          tournament.matches.flatMap((m) =>
            (m.events ?? [])
              .filter((e) => e.teamId === t.id)
              .map((e) => e.playerName)
          )
        ),
      })),
    [tournamentTeams, tournament.matches]
  );

  // Sugerencia: el que más MVP de partido ganó. Sale vacía en los torneos que
  // no llevaron la estadística, y ahí el bloque no se pinta.
  const suggestion = useMemo(() => {
    const counts = new Map<
      string,
      { teamId: string; playerName: string; count: number }
    >();
    for (const m of tournament.matches) {
      for (const e of m.events ?? []) {
        if (e.type !== "mvp") continue;
        const key = `${e.teamId}::${normalizePlayerName(e.playerName)}`;
        const prev = counts.get(key);
        if (prev) prev.count++;
        else
          counts.set(key, {
            teamId: e.teamId,
            playerName: e.playerName,
            count: 1,
          });
      }
    }
    const ranked = [...counts.values()].sort(
      (a, b) => b.count - a.count || a.playerName.localeCompare(b.playerName)
    );
    return ranked[0] ?? null;
  }, [tournament.matches]);

  const teamNameOf = (teamId: string | null | undefined) =>
    teamId ? (teams.find((t) => t.id === teamId)?.name ?? "") : "";

  // La foto que se ve ahora: la que está por subir, o la ya publicada.
  const shownPhoto = previewUrl || tournament.mvpPhotoUrl || null;
  const hasSomething = Boolean(shownPhoto || mvp);
  const alreadyPublished = Boolean(
    tournament.mvpPhotoUrl || tournament.mvpPlayerName
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!isImageFile(f)) {
      toast.error("El archivo debe ser una imagen (PNG, JPG, etc.)");
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      toast.error("La imagen no debe superar los 12MB");
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    // Reset del input para que elegir el mismo archivo otra vez vuelva a
    // disparar onChange.
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let photoUrl = tournament.mvpPhotoUrl ?? null;

      if (file) {
        const { blob, ext } = await resizeImageForUpload(file, {
          maxDim: IMAGE_SIZES.photo,
        });
        // Va bajo `champions/` porque es el prefijo que la policy de storage ya
        // tiene habilitado; el `-mvp-` del nombre la distingue de la del
        // campeón. Ver 20260906_mvp_del_torneo.sql.
        const path = `champions/${tournament.id}-mvp-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${ext}`;
        const { error } = await supabase.storage
          .from("images")
          .upload(path, blob, { contentType: blob.type });
        if (error) {
          console.error("Storage upload error:", error);
          toast.error("Error al subir la foto: " + error.message);
          return;
        }
        photoUrl = supabase.storage.from("images").getPublicUrl(path)
          .data.publicUrl;
      }

      // El `player_id` se resuelve contra la nómina fresca del equipo elegido:
      // si el nombre está inscrito, el MVP queda atado a la persona y sobrevive
      // a que le corrijan el nombre. Si no, va null y manda el texto.
      const playerId = mvp
        ? ((tournamentTeams.find((t) => t.id === mvp.teamId)?.players ?? []).find(
            (p) => normalizePlayerName(p.name) === normalizePlayerName(mvp.playerName)
          )?.id ?? null)
        : null;

      await updateTournamentProps(tournament.id, {
        mvpPhotoUrl: photoUrl,
        mvpPlayerId: mvp ? playerId : null,
        mvpPlayerName: mvp ? mvp.playerName : null,
        mvpTeamId: mvp ? mvp.teamId : null,
      });

      setFile(null);
      setPreviewUrl(null);
      toast.success("MVP del torneo publicado");
      onOpenChange(false);
    } catch (err) {
      console.error("Save MVP error:", err);
      toast.error("No pudimos guardar el MVP. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      await updateTournamentProps(tournament.id, {
        mvpPhotoUrl: null,
        mvpPlayerId: null,
        mvpPlayerName: null,
        mvpTeamId: null,
      });
      setMvp(null);
      setFile(null);
      setPreviewUrl(null);
      toast.success("Se quitó el MVP del torneo");
      onOpenChange(false);
    } catch (err) {
      console.error("Remove MVP error:", err);
      toast.error("No pudimos quitarlo. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col items-center gap-2 pt-2 text-center">
            <Star className="h-12 w-12 text-amber-500" />
            <DialogTitle className="text-2xl">MVP del torneo</DialogTitle>
            <DialogDescription className="text-base">
              El mejor jugador de{" "}
              <span className="font-semibold text-foreground">
                {tournament.name}
              </span>
              . Elegí quién fue y subí su foto: la va a ver cualquier persona
              que entre al torneo, junto a la del campeón.
            </DialogDescription>
          </div>
        </DialogHeader>

        {suggestion && (
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">
              Es el que más MVP ganó en los partidos de este torneo.
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {suggestion.playerName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {teamNameOf(suggestion.teamId)} · {suggestion.count}{" "}
                  {suggestion.count === 1 ? "partido" : "partidos"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setMvp({
                    teamId: suggestion.teamId,
                    playerName: suggestion.playerName,
                  })
                }
              >
                Usar este
              </Button>
            </div>
          </div>
        )}

        <MvpPicker
          teams={pickerTeams}
          value={mvp}
          onChange={setMvp}
          title="Quién fue el MVP"
          help="Buscá al jugador entre los equipos del torneo. Si no está en ninguna nómina, escribí el nombre igual."
        />

        {shownPhoto && (
          <div className="mx-auto w-48">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shownPhoto}
                alt={mvp?.playerName ?? "MVP del torneo"}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
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
            disabled={saving}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {shownPhoto ? "Elegir otra foto" : "Subir foto del MVP"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            <ImageIcon className="mr-1 inline h-3 w-3" />
            Formato vertical recomendado (3:4), como un retrato. Máximo 12MB.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {alreadyPublished ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={saving}
              onClick={handleRemove}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Quitar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={saving || !hasSomething} onClick={handleSave}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
