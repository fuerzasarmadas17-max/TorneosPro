"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Team, Player } from "@/types";
import { useTournaments } from "@/context/tournament-context";
import { toast } from "sonner";
import { Plus, Trash2, Users, Upload } from "lucide-react";
import * as XLSX from "xlsx";

interface TeamRosterDialogProps {
  team: Team;
}

interface PlayerEntry {
  name: string;
  age: string;
}

export function TeamRosterDialog({ team }: TeamRosterDialogProps) {
  const { updateTeamPlayers, updateTeam } = useTournaments();
  const [open, setOpen] = useState(false);
  const [teamName, setTeamName] = useState(team.name);
  const [primaryColor, setPrimaryColor] = useState(team.primaryColor || "#ffffff");
  const [secondaryColor, setSecondaryColor] = useState(team.secondaryColor || "#000000");
  const [playerEntries, setPlayerEntries] = useState<PlayerEntry[]>(
    team.players.map((p) => ({ name: p.name, age: p.age ? String(p.age) : "" }))
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addPlayer = () => {
    setPlayerEntries([...playerEntries, { name: "", age: "" }]);
  };

  const removePlayer = (index: number) => {
    setPlayerEntries(playerEntries.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: keyof PlayerEntry, value: string) => {
    const updated = [...playerEntries];
    updated[index] = { ...updated[index], [field]: value };
    setPlayerEntries(updated);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        // Detect if first row is team name header ("Nombre del equipo" or single value)
        const firstCell = sheet[XLSX.utils.encode_cell({ r: 0, c: 0 })] as { v?: unknown } | undefined;
        const firstVal = firstCell?.v ? String(firstCell.v).trim().toLowerCase() : "";
        const startRow = firstVal === "nombre del equipo" || firstVal === "" ? 1 : 0;
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { range: startRow });

        const imported: PlayerEntry[] = [];
        for (const row of rows) {
          // Try common column name variations
          const capitalize = (s: string) =>
            s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

          const nombre = capitalize(String(row["Nombre"] || row["nombre"] || row["NOMBRE"] || "").trim());
          const apellido1 = capitalize(String(row["Apellido 1"] || row["apellido 1"] || row["Apellido1"] || row["apellido1"] || row["APELLIDO 1"] || row["APELLIDO1"] || "").trim());
          const apellido2 = capitalize(String(row["Apellido 2"] || row["apellido 2"] || row["Apellido2"] || row["apellido2"] || row["APELLIDO 2"] || row["APELLIDO2"] || "").trim());

          if (!nombre) continue;

          // Age: try Fecha de nacimiento first, then fallback to Edad
          let edad = "";
          const fechaNacRaw = row["Fecha de nacimiento"] || row["fecha de nacimiento"] || row["FECHA DE NACIMIENTO"];
          if (fechaNacRaw) {
            if (typeof fechaNacRaw === "number") {
              // Excel date serial number
              const parsed = XLSX.SSF.parse_date_code(fechaNacRaw);
              if (parsed.y) {
                edad = String(new Date().getFullYear() - parsed.y);
              }
            } else {
              const parsed = new Date(String(fechaNacRaw));
              if (!isNaN(parsed.getTime())) {
                edad = String(new Date().getFullYear() - parsed.getFullYear());
              }
            }
          } else {
            const edadRaw = row["Edad"] || row["edad"] || row["EDAD"];
            edad = edadRaw ? String(edadRaw).trim() : "";
          }

          const fullName = [nombre, apellido1, apellido2].filter(Boolean).join(" ");
          imported.push({ name: fullName, age: edad });
        }

        if (imported.length === 0) {
          toast.error("No se encontraron jugadores. Verifica que el archivo tenga columnas: Nombre, Apellido 1, Apellido 2");
          return;
        }

        setPlayerEntries([...playerEntries, ...imported]);
        toast.success(`${imported.length} jugadores importados`);
      } catch {
        toast.error("Error al leer el archivo Excel");
      }
    };
    reader.readAsArrayBuffer(file);

    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = () => {
    // Save team info
    updateTeam(team.id, {
      name: teamName.trim() || team.name,
      primaryColor,
      secondaryColor,
    });

    // Save players
    const players: Player[] = playerEntries
      .filter((p) => p.name.trim())
      .map((entry, i) => ({
        id: `${team.id}-p-${i + 1}`,
        name: entry.name.trim(),
        teamId: team.id,
        age: entry.age ? parseInt(entry.age) || undefined : undefined,
      }));

    updateTeamPlayers(team.id, players);
    toast.success(`${teamName.trim() || team.name} actualizado`);
    setOpen(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setTeamName(team.name);
      setPrimaryColor(team.primaryColor || "#ffffff");
      setSecondaryColor(team.secondaryColor || "#000000");
      setPlayerEntries(
        team.players.map((p) => ({ name: p.name, age: p.age ? String(p.age) : "" }))
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {team.players.length > 0 ? (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {team.players.length}
            </Badge>
          ) : (
            <span className="text-xs">Editar</span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Equipo</DialogTitle>
          <DialogDescription>
            Nombre, colores y jugadores
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Team Name */}
          <div className="space-y-2">
            <Label>Nombre del equipo</Label>
            <Input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Nombre del equipo"
            />
          </div>

          {/* Colors */}
          <div className="space-y-2">
            <Label>Colores</Label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border border-border"
                />
                <span className="text-xs text-muted-foreground">Principal</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border border-border"
                />
                <span className="text-xs text-muted-foreground">Secundario</span>
              </div>
              <div
                className="w-10 h-10 rounded border border-border overflow-hidden flex"
                title="Vista previa"
              >
                <div className="w-1/2 h-full" style={{ backgroundColor: primaryColor }} />
                <div className="w-1/2 h-full" style={{ backgroundColor: secondaryColor }} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Players */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Jugadores</Label>
              <span className="text-xs text-muted-foreground">
                {playerEntries.filter((p) => p.name.trim()).length} registrados
              </span>
            </div>

            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {playerEntries.map((entry, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    placeholder={`Jugador ${index + 1}`}
                    value={entry.name}
                    onChange={(e) => updateEntry(index, "name", e.target.value)}
                    className="h-9"
                  />
                  <Input
                    placeholder="Edad"
                    type="number"
                    min="1"
                    value={entry.age}
                    onChange={(e) => updateEntry(index, "age", e.target.value)}
                    className="h-9 w-20 shrink-0"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => removePlayer(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={addPlayer}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Agregar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5 mr-1" />
                Importar Excel
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImportExcel}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              El Excel debe tener columnas: Nombre, Apellido 1, Apellido 2. Opcionalmente: Fecha de nacimiento, etc.
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleSave}>
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
