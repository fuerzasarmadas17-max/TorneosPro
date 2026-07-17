"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Match,
  MatchEvent,
  MatchEventType,
  Player,
  Sport,
  VolleyballSet,
  getSportCategory,
  getStatDefinition,
} from "@/types";
import { useTournaments } from "@/context/tournament-context";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { BaseballScoresheet } from "./baseball-scoresheet";
import {
  PlayerStats,
  buildScoresheetData,
  buildScoresheetEventsForTeam,
  BASEBALL_SCORESHEET_STATS,
  BASEBALL_OFFENSIVE_STATS,
  BASEBALL_DEFENSIVE_STATS,
} from "@/lib/baseball-scoresheet";
import { dedupePlayersByName } from "@/lib/name-utils";

interface EventEntry {
  type: MatchEventType;
  teamId: string;
  playerName: string;
}

interface MatchResultFormProps {
  match: Match;
  enabledStats?: MatchEventType[];
  sport?: Sport;
  bestOf?: 3 | 5;
}

export function MatchResultForm({
  match,
  enabledStats,
  sport,
  bestOf,
}: MatchResultFormProps) {
  const { getTeamById, updateMatch } = useTournaments();
  const router = useRouter();

  // `isEditing` = el partido ya tiene resultado cargado y estamos
  // corrigiendo. Cambia el copy de título/botones y precarga el form con
  // los valores existentes en lugar de arrancar vacío. La precarga es
  // lo que hace seguro pisar el resultado — sino el organizer entraría
  // a un form en blanco y al guardar sobrescribiría con nulls.
  const isEditing = match.status === "completed";

  const [homeScore, setHomeScore] = useState(
    match.homeScore != null ? String(match.homeScore) : ""
  );
  const [awayScore, setAwayScore] = useState(
    match.awayScore != null ? String(match.awayScore) : ""
  );
  const [eventEntries, setEventEntries] = useState<EventEntry[]>(() =>
    (match.events ?? []).map((e) => ({
      type: e.type,
      teamId: e.teamId,
      playerName: e.playerName,
    }))
  );
  const [error, setError] = useState("");
  // 4 pasos de planilla: 1=local ofensiva, 2=local defensiva,
  // 3=visitante ofensiva, 4=visitante defensiva.
  const [scoresheetStep, setScoresheetStep] = useState<1 | 2 | 3 | 4>(1);

  const homeTeam = match.homeTeamId ? getTeamById(match.homeTeamId) : null;
  const awayTeam = match.awayTeamId ? getTeamById(match.awayTeamId) : null;

  // Dedupe: un nombre repetido en la nómina pinta dos filas que editan la
  // misma celda de la planilla y al guardar duplican los eventos.
  const homePlayers = dedupePlayersByName(homeTeam?.players || []);
  const awayPlayers = dedupePlayersByName(awayTeam?.players || []);

  const stats = enabledStats || [];
  const isBaseball = sport ? getSportCategory(sport) === "baseball" : false;
  const useScoresheet = isBaseball;
  const isVolleyball = sport === "volleyball";
  const setsToWin = bestOf ? Math.ceil(bestOf / 2) : 2;

  // Scoresheet state for baseball — pre-cargar la matriz player×stat
  // desde `match.events` para que la edición arranque con los datos
  // ya cargados.
  const [homeScoresheetData, setHomeScoresheetData] = useState<
    Record<string, PlayerStats>
  >(() => buildScoresheetData(match.events ?? [], match.homeTeamId));
  const [awayScoresheetData, setAwayScoresheetData] = useState<
    Record<string, PlayerStats>
  >(() => buildScoresheetData(match.events ?? [], match.awayTeamId));

  // Volleyball set scores state — precargar los sets ya cargados o
  // arrancar con la cantidad de bestOf si es la primera vez.
  const [setScores, setSetScores] = useState<Array<{ home: string; away: string }>>(
    () => {
      const existing = match.sets ?? [];
      if (existing.length > 0) {
        return existing.map((s) => ({
          home: String(s.homePoints),
          away: String(s.awayPoints),
        }));
      }
      return Array.from({ length: bestOf || 3 }, () => ({ home: "", away: "" }));
    }
  );

  const getPlayersForTeam = (teamId: string): Player[] => {
    if (teamId === match.homeTeamId) return homePlayers;
    if (teamId === match.awayTeamId) return awayPlayers;
    return [];
  };

  const addEvent = (type: MatchEventType, teamId: string) => {
    setEventEntries([...eventEntries, { type, teamId, playerName: "" }]);
  };

  const removeEvent = (index: number) => {
    setEventEntries(eventEntries.filter((_, i) => i !== index));
  };

  const updateEventPlayer = (index: number, playerName: string) => {
    const updated = [...eventEntries];
    updated[index] = { ...updated[index], playerName };
    setEventEntries(updated);
  };

  const handleScoresheetChange = (
    side: "home" | "away",
    playerName: string,
    stat: MatchEventType,
    count: number
  ) => {
    const setter =
      side === "home" ? setHomeScoresheetData : setAwayScoresheetData;
    setter((prev) => ({
      ...prev,
      [playerName]: { ...(prev[playerName] || {}), [stat]: count },
    }));
  };

  const buildEventsFromScoresheet = (): MatchEvent[] => {
    let idx = 0;
    // Serializamos con el set COMPLETO de béisbol (no `stats`/enabledStats)
    // para no perder ninguna columna cargada en la planilla — se captura todo.
    const base = [
      ...buildScoresheetEventsForTeam(homeScoresheetData, match.homeTeamId, homePlayers, BASEBALL_SCORESHEET_STATS),
      ...buildScoresheetEventsForTeam(awayScoresheetData, match.awayTeamId, awayPlayers, BASEBALL_SCORESHEET_STATS),
    ];
    return base.map((e) => ({
      id: `evt-${Date.now()}-${idx++}`,
      matchId: match.id,
      ...e,
    }));
  };

  // Volleyball: compute sets won from setScores
  const computedHomeSets = setScores.filter(
    (s) => s.home !== "" && s.away !== "" && parseInt(s.home) > parseInt(s.away)
  ).length;
  const computedAwaySets = setScores.filter(
    (s) => s.home !== "" && s.away !== "" && parseInt(s.away) > parseInt(s.home)
  ).length;
  const volleyballMatchDecided =
    computedHomeSets >= setsToWin || computedAwaySets >= setsToWin;

  const updateSetScore = (index: number, side: "home" | "away", value: string) => {
    setSetScores((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [side]: value };
      return updated;
    });
  };

  const handleSave = () => {
    setError("");

    // Volleyball: validate and save set-by-set
    if (isVolleyball) {
      const completedSets: VolleyballSet[] = [];
      for (let i = 0; i < setScores.length; i++) {
        const s = setScores[i];
        if (s.home === "" && s.away === "") continue;
        const hp = parseInt(s.home);
        const ap = parseInt(s.away);
        if (isNaN(hp) || isNaN(ap)) {
          setError(`Set ${i + 1}: ingresa marcadores validos`);
          return;
        }
        if (hp < 0 || ap < 0) {
          setError(`Set ${i + 1}: los marcadores no pueden ser negativos`);
          return;
        }
        if (hp === ap) {
          setError(`Set ${i + 1}: un set no puede terminar en empate`);
          return;
        }
        completedSets.push({ setNumber: i + 1, homePoints: hp, awayPoints: ap });
        // Stop processing after a team wins enough sets
        const homeWon = completedSets.filter((cs) => cs.homePoints > cs.awayPoints).length;
        const awayWon = completedSets.filter((cs) => cs.awayPoints > cs.homePoints).length;
        if (homeWon >= setsToWin || awayWon >= setsToWin) break;
      }

      const homeSetsWon = completedSets.filter((s) => s.homePoints > s.awayPoints).length;
      const awaySetsWon = completedSets.filter((s) => s.awayPoints > s.homePoints).length;

      if (homeSetsWon < setsToWin && awaySetsWon < setsToWin) {
        setError("El partido no esta decidido aun");
        return;
      }

      // Build events from card/stat entries (yellow cards, red cards, etc.)
      const events: MatchEvent[] = eventEntries
        .filter((entry) => entry.playerName.trim())
        .map((entry, i) => ({
          id: `evt-${Date.now()}-${i}`,
          matchId: match.id,
          teamId: entry.teamId,
          playerName: entry.playerName.trim(),
          type: entry.type,
        }));

      updateMatch(match.tournamentId, match.id, homeSetsWon, awaySetsWon, events, completedSets);
      toast.success("Resultado guardado");
      router.push(`/tournaments/${match.tournamentId}`);
      return;
    }

    const home = parseInt(homeScore);
    const away = parseInt(awayScore);

    if (isNaN(home) || isNaN(away)) {
      setError("Ingresa marcadores validos");
      return;
    }

    if (home < 0 || away < 0) {
      setError("Los marcadores no pueden ser negativos");
      return;
    }

    let events: MatchEvent[];

    if (useScoresheet) {
      events = buildEventsFromScoresheet();
    } else {
      events = eventEntries
        .filter((entry) => entry.playerName.trim())
        .map((entry, i) => ({
          id: `evt-${Date.now()}-${i}`,
          matchId: match.id,
          teamId: entry.teamId,
          playerName: entry.playerName.trim(),
          type: entry.type,
        }));
    }

    updateMatch(match.tournamentId, match.id, home, away, events);
    toast.success("Resultado guardado");
    router.push(`/tournaments/${match.tournamentId}`);
  };

  const PlayerSearchInput = ({
    players,
    value,
    onChange,
    placeholder,
  }: {
    players: Player[];
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
  }) => {
    const [query, setQuery] = useState(value);
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      setQuery(value);
    }, [value]);

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filtered = players.filter((p) =>
      p.name.toLowerCase().includes(query.toLowerCase())
    );

    return (
      <div ref={containerRef} className="relative">
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="h-8 text-sm"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-md border bg-popover shadow-md">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent cursor-pointer"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(p.name);
                  setQuery(p.name);
                  setOpen(false);
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderPlayerSelect = (
    teamId: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string
  ) => {
    const players = getPlayersForTeam(teamId);
    if (players.length > 0) {
      return (
        <PlayerSearchInput
          players={players}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
      );
    }
    return (
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-sm"
      />
    );
  };

  // Group events by type (exclude computed stats like goals_against)
  const eventsByType = stats
    .filter((statKey) => !getStatDefinition(statKey)?.computed)
    .map((statKey) => ({
      statKey,
      def: getStatDefinition(statKey),
      entries: eventEntries
        .map((e, i) => ({ ...e, originalIndex: i }))
        .filter((e) => e.type === statKey),
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">
          {isEditing ? "Editar Resultado" : "Ingresar Resultado"}
        </CardTitle>
        {isEditing && (
          <p className="text-xs text-muted-foreground text-center">
            Este partido ya tiene resultado cargado. Cualquier cambio que
            guardes va a pisar lo anterior y recalcular las estadísticas y
            la tabla de posiciones automáticamente.
          </p>
        )}
      </CardHeader>
      <form onSubmit={(e) => e.preventDefault()}>
        <CardContent className="space-y-6">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Volleyball: set-by-set entry */}
          {isVolleyball ? (
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                <p className="text-sm font-semibold text-center truncate">
                  {homeTeam?.name || "TBD"}
                </p>
                <span />
                <p className="text-sm font-semibold text-center truncate">
                  {awayTeam?.name || "TBD"}
                </p>
              </div>
              {setScores.map((set, i) => {
                // Hide sets after a team already won
                const homeSoFar = setScores
                  .slice(0, i)
                  .filter((s) => s.home !== "" && s.away !== "" && parseInt(s.home) > parseInt(s.away)).length;
                const awaySoFar = setScores
                  .slice(0, i)
                  .filter((s) => s.home !== "" && s.away !== "" && parseInt(s.away) > parseInt(s.home)).length;
                if (homeSoFar >= setsToWin || awaySoFar >= setsToWin) return null;

                return (
                  <div key={i} className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={set.home}
                      onChange={(e) => updateSetScore(i, "home", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.preventDefault();
                      }}
                      className="text-center text-lg h-12"
                    />
                    <span className="text-sm text-muted-foreground font-medium w-12 text-center">
                      Set {i + 1}
                    </span>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={set.away}
                      onChange={(e) => updateSetScore(i, "away", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.preventDefault();
                      }}
                      className="text-center text-lg h-12"
                    />
                  </div>
                );
              })}
              <div className="text-center">
                <span className="text-2xl font-bold">
                  {computedHomeSets} - {computedAwaySets}
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  {volleyballMatchDecided
                    ? `Partido decidido`
                    : `Gana el primero en llegar a ${setsToWin} sets`}
                </p>
              </div>
            </div>
          ) : (
            /* Standard score inputs */
            <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-end">
              <div className="space-y-2">
                <Label className="text-center block font-semibold">
                  {homeTeam?.name || "TBD"}
                </Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={homeScore}
                  onChange={(e) => setHomeScore(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  className="text-center text-2xl h-16"
                />
              </div>
              <span className="text-2xl font-bold text-muted-foreground pb-2">
                -
              </span>
              <div className="space-y-2">
                <Label className="text-center block font-semibold">
                  {awayTeam?.name || "TBD"}
                </Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  className="text-center text-2xl h-16"
                />
              </div>
            </div>
          )}

          {/* Baseball scoresheet mode - step by step. Siempre se muestra
              completa (no depende de enabledStats). */}
          {useScoresheet && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <Label className="text-base">
                  Estadísticas Individuales
                </Label>
                <span className="text-sm text-muted-foreground">
                  Paso {scoresheetStep} de 4
                </span>
              </div>

              {(() => {
                const isHome = scoresheetStep <= 2;
                const isOffensive = scoresheetStep === 1 || scoresheetStep === 3;
                const side = isHome ? "home" : "away";
                const teamName = isHome
                  ? homeTeam?.name || "Local"
                  : awayTeam?.name || "Visitante";
                const teamId = (isHome ? match.homeTeamId : match.awayTeamId) || "";
                const players = isHome ? homePlayers : awayPlayers;
                const values = isHome ? homeScoresheetData : awayScoresheetData;
                const onChange = (
                  playerName: string,
                  stat: MatchEventType,
                  count: number
                ) => handleScoresheetChange(side, playerName, stat, count);
                // Una planilla por paso: primero ofensiva del equipo, luego
                // defensiva, y después el otro equipo. Ambas escriben en la
                // misma matriz de valores del equipo.
                return (
                  <BaseballScoresheet
                    key={`${side}-${isOffensive ? "off" : "def"}`}
                    teamName={teamName}
                    teamId={teamId}
                    section={isOffensive ? "Ofensiva" : "Defensiva"}
                    statKeys={isOffensive ? BASEBALL_OFFENSIVE_STATS : BASEBALL_DEFENSIVE_STATS}
                    players={players}
                    values={values}
                    onChange={onChange}
                  />
                );
              })()}
            </>
          )}

          {/* Original event-by-event mode (non-baseball or no players) */}
          {!useScoresheet && stats.length > 0 && (
            <>
              {homePlayers.length === 0 && awayPlayers.length === 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  Los equipos no tienen jugadores registrados. Puedes escribir
                  los nombres manualmente.
                </p>
              )}

              {eventsByType.map(({ statKey, def, entries }) => {
                if (!def) return null;

                const homeEntries = entries.filter(
                  (e) => e.teamId === match.homeTeamId
                );
                const awayEntries = entries.filter(
                  (e) => e.teamId === match.awayTeamId
                );

                return (
                  <div key={statKey}>
                    <Separator />
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-center gap-2">
                        <Label className="text-base">{def.pluralLabel}</Label>
                        <span className="text-xs text-muted-foreground">
                          Opcional
                        </span>
                      </div>

                      <div className="grid grid-cols-[1fr_auto_1fr] gap-6">
                        {/* Home team column */}
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground truncate">
                            {homeTeam?.name || "Local"}
                          </p>
                          {homeEntries.map((entry) => (
                            <div
                              key={entry.originalIndex}
                              className="flex items-center gap-1.5"
                            >
                              <div className="flex-1">
                                {renderPlayerSelect(
                                  entry.teamId,
                                  entry.playerName,
                                  (v) =>
                                    updateEventPlayer(entry.originalIndex, v),
                                  "Jugador"
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => removeEvent(entry.originalIndex)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                          {match.homeTeamId && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full text-xs"
                              onClick={() =>
                                addEvent(statKey, match.homeTeamId!)
                              }
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              {def.label}
                            </Button>
                          )}
                        </div>

                        {/* Vertical divider */}
                        <div className="w-px bg-border" />

                        {/* Away team column */}
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground truncate">
                            {awayTeam?.name || "Visitante"}
                          </p>
                          {awayEntries.map((entry) => (
                            <div
                              key={entry.originalIndex}
                              className="flex items-center gap-1.5"
                            >
                              <div className="flex-1">
                                {renderPlayerSelect(
                                  entry.teamId,
                                  entry.playerName,
                                  (v) =>
                                    updateEventPlayer(entry.originalIndex, v),
                                  "Jugador"
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => removeEvent(entry.originalIndex)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                          {match.awayTeamId && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full text-xs"
                              onClick={() =>
                                addEvent(statKey, match.awayTeamId!)
                              }
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              {def.label}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </CardContent>
        <CardFooter className="flex gap-2 pt-6">
          {useScoresheet ? (() => {
            const step = scoresheetStep;
            // Validación de marcadores solo al salir del primer paso.
            const validateScores = () => {
              setError("");
              const home = parseInt(homeScore);
              const away = parseInt(awayScore);
              if (isNaN(home) || isNaN(away)) {
                setError("Ingresa marcadores validos");
                return false;
              }
              if (home < 0 || away < 0) {
                setError("Los marcadores no pueden ser negativos");
                return false;
              }
              return true;
            };
            const goNext = () => {
              if (step === 1 && !validateScores()) return;
              setScoresheetStep((step + 1) as 1 | 2 | 3 | 4);
            };
            const goBack = () =>
              step === 1
                ? router.back()
                : setScoresheetStep((step - 1) as 1 | 2 | 3 | 4);
            // Etiqueta del botón "siguiente" según a dónde va.
            const nextLabel =
              step === 1
                ? "Defensiva"
                : step === 2
                ? awayTeam?.name || "Visitante"
                : "Defensiva"; // step 3 → visitante defensiva
            const backLabel =
              step === 1
                ? "Cancelar"
                : step === 3
                ? homeTeam?.name || "Local"
                : "Ofensiva"; // steps 2 y 4 → ofensiva del mismo equipo
            return (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={goBack}
                >
                  {step > 1 && <ChevronLeft className="h-4 w-4 mr-1" />}
                  {backLabel}
                </Button>
                {step === 4 ? (
                  <Button type="button" className="flex-1" onClick={handleSave}>
                    {isEditing ? "Sobrescribir resultado" : "Guardar Resultado"}
                  </Button>
                ) : (
                  <Button type="button" className="flex-1" onClick={goNext}>
                    {nextLabel}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </>
            );
          })() : (
            <>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => router.back()}
              >
                Cancelar
              </Button>
              <Button type="button" className="flex-1" onClick={handleSave}>
                {isEditing ? "Sobrescribir resultado" : "Guardar Resultado"}
              </Button>
            </>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
