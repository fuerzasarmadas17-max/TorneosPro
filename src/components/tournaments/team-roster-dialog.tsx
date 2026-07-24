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
import { Separator } from "@/components/ui/separator";
import { Team, Player } from "@/types";
import { useTournaments } from "@/context/tournament-context";
import { useAuth } from "@/context/auth-context";
import { TeamLogoPicker } from "@/components/logos/team-logo-picker";
import { toast } from "sonner";
import { Plus, Trash2, Users, Upload, ChevronDown, ChevronUp, ImagePlus } from "lucide-react";
import * as XLSX from "xlsx";

interface TeamRosterDialogProps {
  team: Team;
}

interface PlayerEntry {
  // id estable del jugador: se conserva el de la DB para los existentes y se
  // mintea un uuid para los nuevos. Es lo que permite el guardado granular
  // (upsert) sin regenerar ids. Ver updateTeamPlayers en lib/db/teams.ts.
  id: string;
  name: string;
  age: string;
  documentNumber: string;
  eps: string;
  birthDate: string;
}

export function TeamRosterDialog({ team }: TeamRosterDialogProps) {
  const { updateTeamPlayers, updateTeam } = useTournaments();
  const { user } = useAuth();
  const orgId = user?.organizationProfile?.id;
  const [open, setOpen] = useState(false);
  const [teamName, setTeamName] = useState(team.name);
  const [primaryColor, setPrimaryColor] = useState(team.primaryColor || "#ffffff");
  const [secondaryColor, setSecondaryColor] = useState(team.secondaryColor || "#000000");
  const [logoUrl, setLogoUrl] = useState<string>(team.logoUrl || "");
  const [clubLogoId, setClubLogoId] = useState<string>(team.clubLogoId || "");
  const [playerEntries, setPlayerEntries] = useState<PlayerEntry[]>(
    team.players.map((p) => ({ id: p.id || crypto.randomUUID(), name: p.name, age: p.age ? String(p.age) : "", documentNumber: p.documentNumber || "", eps: p.eps || "", birthDate: p.birthDate || "" }))
  );
  const [expandedPlayers, setExpandedPlayers] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleExpanded = (index: number) => {
    setExpandedPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const addPlayer = () => {
    setPlayerEntries([...playerEntries, { id: crypto.randomUUID(), name: "", age: "", documentNumber: "", eps: "", birthDate: "" }]);
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

          // Una sola columna "Nombre Completo". Aceptamos variantes de
          // mayúsculas / con o sin espacio porque los organizadores
          // a veces editan el header del template sin querer.
          const nombreCompleto = capitalize(
            String(
              row["Nombre Completo"] ||
                row["nombre completo"] ||
                row["NOMBRE COMPLETO"] ||
                row["NombreCompleto"] ||
                row["nombrecompleto"] ||
                ""
            ).trim()
          );

          if (!nombreCompleto) continue;

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

          // Document number
          const documento = String(row["Número de documento"] || row["número de documento"] || row["NÚMERO DE DOCUMENTO"] || row["Numero de documento"] || row["numero de documento"] || row["NUMERO DE DOCUMENTO"] || row["Documento"] || row["documento"] || row["DOCUMENTO"] || row["No. Documento"] || row["No. documento"] || "").trim();

          // EPS
          const epsVal = String(row["EPS"] || row["eps"] || row["Eps"] || "").trim();

          // Birth date as string
          let fechaNac = "";
          if (fechaNacRaw) {
            if (typeof fechaNacRaw === "number") {
              const parsed = XLSX.SSF.parse_date_code(fechaNacRaw);
              if (parsed.y) {
                fechaNac = `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
              }
            } else {
              const parsed = new Date(String(fechaNacRaw));
              if (!isNaN(parsed.getTime())) {
                fechaNac = parsed.toISOString().split("T")[0];
              }
            }
          }

          imported.push({
            id: crypto.randomUUID(),
            name: nombreCompleto,
            age: edad,
            documentNumber: documento,
            eps: epsVal,
            birthDate: fechaNac,
          });
        }

        if (imported.length === 0) {
          toast.error(
            "No se encontraron jugadores. Verifica que el archivo tenga la columna: Nombre Completo"
          );
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
      logoUrl,
      clubLogoId,
    });

    // Save players
    const players: Player[] = playerEntries
      .filter((p) => p.name.trim())
      .map((entry) => ({
        id: entry.id,
        name: entry.name.trim(),
        teamId: team.id,
        age: entry.age ? parseInt(entry.age) || undefined : undefined,
        documentNumber: entry.documentNumber.trim() || undefined,
        eps: entry.eps.trim() || undefined,
        birthDate: entry.birthDate.trim() || undefined,
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
      setLogoUrl(team.logoUrl || "");
      setClubLogoId(team.clubLogoId || "");
      setPlayerEntries(
        team.players.map((p) => ({ id: p.id || crypto.randomUUID(), name: p.name, age: p.age ? String(p.age) : "", documentNumber: p.documentNumber || "", eps: p.eps || "", birthDate: p.birthDate || "" }))
      );
      setExpandedPlayers(new Set());
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Users className="h-3.5 w-3.5" />
          <span className="text-xs">Editar</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Equipo</DialogTitle>
          <DialogDescription>
            Nombre, colores y jugadores
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
          {/* Team Name */}
          <div className="space-y-2">
            <Label>Nombre del equipo</Label>
            <Input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Nombre del equipo"
            />
          </div>

          {/* Logo del club */}
          <div className="space-y-2">
            <Label>Logo del club (opcional)</Label>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" loading="lazy" decoding="async" className="h-full w-full object-contain p-1.5" />
                ) : (
                  <ImagePlus className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <TeamLogoPicker
                  orgId={orgId}
                  currentClubLogoId={clubLogoId || undefined}
                  onSelect={(sel) => {
                    setLogoUrl(sel.imageUrl);
                    setClubLogoId(sel.clubLogoId);
                  }}
                  trigger={
                    <Button type="button" variant="outline" size="sm">
                      <Upload className="mr-1 h-3.5 w-3.5" />
                      {logoUrl ? "Cambiar logo" : "Elegir logo"}
                    </Button>
                  }
                />
                {logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-destructive hover:text-destructive"
                    onClick={() => {
                      setLogoUrl("");
                      setClubLogoId("");
                    }}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Quitar
                  </Button>
                )}
              </div>
            </div>
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

            <div className="space-y-1">
              {playerEntries.map((entry, index) => (
                <div
                  key={index}
                  className="border border-border rounded-md overflow-hidden"
                >
                  {/* Collapsed row: name + expand + delete */}
                  <div className="flex gap-2 items-center px-2 py-1.5">
                    <Input
                      placeholder={`Jugador ${index + 1}`}
                      value={entry.name}
                      onChange={(e) => updateEntry(index, "name", e.target.value)}
                      className="h-8 border-0 shadow-none focus-visible:ring-0 px-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground"
                      onClick={() => toggleExpanded(index)}
                      title="Ver más datos"
                    >
                      {expandedPlayers.has(index) ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removePlayer(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Expanded details */}
                  {expandedPlayers.has(index) && (
                    <div className="px-3 pb-2 pt-1 border-t border-border bg-muted/30">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Fecha de nacimiento</Label>
                          <Input
                            type="date"
                            value={entry.birthDate}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPlayerEntries((prev) => {
                                const updated = [...prev];
                                updated[index] = { ...updated[index], birthDate: val };
                                if (val) {
                                  const birth = new Date(val);
                                  updated[index].age = String(new Date().getFullYear() - birth.getFullYear());
                                }
                                return updated;
                              });
                            }}
                            className="h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Edad</Label>
                          <Input
                            placeholder="Edad"
                            type="number"
                            min="1"
                            value={entry.age}
                            onChange={(e) => updateEntry(index, "age", e.target.value)}
                            className="h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">No. Documento</Label>
                          <Input
                            placeholder="Número de documento"
                            value={entry.documentNumber}
                            onChange={(e) => updateEntry(index, "documentNumber", e.target.value)}
                            className="h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">EPS</Label>
                          <Input
                            placeholder="EPS"
                            value={entry.eps}
                            onChange={(e) => updateEntry(index, "eps", e.target.value)}
                            className="h-8"
                          />
                        </div>
                      </div>
                    </div>
                  )}
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
              Columna: Nombre Completo. Opcionales: Fecha de nacimiento (YYYY-MM-DD, ej: 1995-06-15), Edad, No. Documento, EPS.
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-2 shrink-0">
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
