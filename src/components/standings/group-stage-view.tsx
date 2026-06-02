"use client";

import { useState } from "react";
import { Tournament, getSportCategory } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useTournaments } from "@/context/tournament-context";
import { StandingsTable } from "./standings-table";
import { BaseballStandingsTable } from "./baseball-standings-table";
import { BasketballStandingsTable } from "./basketball-standings-table";
import { VolleyballStandingsTable } from "./volleyball-standings-table";

interface GroupStageViewProps {
  tournament: Tournament;
  phase?: number;
  canEdit?: boolean;
}

export function GroupStageView({ tournament, phase, canEdit }: GroupStageViewProps) {
  const sportCategory = getSportCategory(tournament.sport);
  const { renameGroup } = useTournaments();

  // Filter groups by phase if specified
  const groups = phase != null
    ? tournament.groups?.filter((g) => g.phase === phase)
    : tournament.groups;

  // Determine completion status
  const isComplete = phase != null
    ? tournament.phaseConfigs?.find((pc) => pc.phase === phase)?.complete
    : tournament.groupStageComplete;

  const completionLabel = phase != null
    ? `Fase ${phase} completada`
    : "Fase de grupos completada - Playoffs generados";

  return (
    <div className="space-y-6">
      {isComplete && (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
          {completionLabel}
        </Badge>
      )}

      {groups?.map((group) => {
        const groupMatches = tournament.matches.filter(
          (m) => m.phase === "group" && m.groupId === group.id
        );

        // Skip groups with no matches and no teams (empty Phase 2 groups)
        if (group.teamIds.length === 0 && groupMatches.length === 0) return null;

        const groupTournament: Tournament = {
          ...tournament,
          teamIds: group.teamIds,
          matches: groupMatches,
        };

        const standingsContent = group.teamIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Pendiente — los equipos se asignaran cuando la fase anterior se complete
          </p>
        ) : sportCategory === "baseball" ? (
          <BaseballStandingsTable tournament={groupTournament} />
        ) : sportCategory === "basketball" ? (
          <BasketballStandingsTable tournament={groupTournament} />
        ) : sportCategory === "volleyball" ? (
          <VolleyballStandingsTable tournament={groupTournament} />
        ) : (
          <StandingsTable tournament={groupTournament} />
        );

        // Single group in phase: render without Card wrapper (no title shown,
        // so there's also no name to edit here).
        if (groups.length === 1) {
          return <div key={group.id}>{standingsContent}</div>;
        }

        return (
          <Card key={group.id}>
            <CardHeader>
              <GroupTitle
                groupId={group.id}
                name={group.name}
                canEdit={!!canEdit}
                onRename={(newName) => renameGroup(tournament.id, group.id, newName)}
              />
            </CardHeader>
            <CardContent>{standingsContent}</CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * Inline-editable group title. Read-only when canEdit is false — renders just
 * the name to keep the public view identical to before. When editing: input +
 * confirm/cancel. Enter saves, Escape cancels.
 */
function GroupTitle({
  groupId,
  name,
  canEdit,
  onRename,
}: {
  groupId: string;
  name: string;
  canEdit: boolean;
  onRename: (newName: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);

  if (!canEdit) {
    return <CardTitle className="text-lg">{name}</CardTitle>;
  }

  const startEdit = () => {
    setDraft(name);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(name);
    setEditing(false);
  };

  const save = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      toast.error("El nombre del grupo no puede estar vacio");
      return;
    }
    if (trimmed === name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(trimmed);
      toast.success("Nombre del grupo actualizado");
      setEditing(false);
    } catch {
      toast.error("No pudimos actualizar el nombre");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          id={`group-name-${groupId}`}
          value={draft}
          autoFocus
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          className="h-8 max-w-[14rem] text-base font-semibold"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-green-600"
          onClick={save}
          disabled={saving}
          aria-label="Guardar"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={cancel}
          disabled={saving}
          aria-label="Cancelar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <CardTitle className="text-lg">{name}</CardTitle>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={startEdit}
        aria-label="Editar nombre del grupo"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
