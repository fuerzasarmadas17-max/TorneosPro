"use client";

import { useState } from "react";
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
  Team,
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
import { dedupePlayersByName, buildPlayerNameOptions, normalizePlayerName } from "@/lib/name-utils";
import { fetchTeamsByIds } from "@/lib/db/teams";
import { PlayerCombobox } from "./player-combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const { getTeamById, updateMatch, getTournamentById, updateTeamPlayers } = useTournaments();
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

  // Nombres ya usados en eventos del torneo (por equipo) para alimentar el
  // dropdown de goleador aun cuando el equipo no tenga roster cargado. Es solo
  // la fuente de sugerencias: NO se modifica la plantilla, así que importar la
  // planilla oficial más tarde no genera jugadores duplicados.
  const tournamentMatches = getTournamentById(match.tournamentId)?.matches ?? [];
  const eventNamesForTeam = (teamId: string) =>
    tournamentMatches.flatMap((m) =>
      (m.events ?? []).filter((e) => e.teamId === teamId).map((e) => e.playerName)
    );
  const homePlayerOptions = buildPlayerNameOptions(
    homePlayers.map((p) => p.name),
    match.homeTeamId ? eventNamesForTeam(match.homeTeamId) : []
  );
  const awayPlayerOptions = buildPlayerNameOptions(
    awayPlayers.map((p) => p.name),
    match.awayTeamId ? eventNamesForTeam(match.awayTeamId) : []
  );

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

  // Flujo A: al guardar, los nombres tipeados que no están en la plantilla de
  // su equipo se muestran en un modal de confirmación; al aceptar, se inscriben
  // en el equipo (con id estable) y recién ahí se guarda el resultado. Solo
  // corre en el flujo del organizador (este form); el link del anotador no
  // inscribe.
  const [inscribeOpen, setInscribeOpen] = useState(false);
  const [inscribeData, setInscribeData] = useState<{
    groups: { teamId: string; teamName: string; names: string[] }[];
    freshTeams: Team[];
    finalEvents: MatchEvent[];
    performSave: (finalEvents: MatchEvent[]) => void;
  } | null>(null);
  const [inscribing, setInscribing] = useState(false);

  // Corazón del Flujo A. Trabaja con la plantilla FRESCA de la base porque el
  // estado en memoria puede estar viejo (un jugador inscrito en otra pantalla).
  //   1. Canoniza cada nombre tipeado que coincide (normalizado) con un jugador
  //      del roster, reemplazándolo por su ortografía oficial. Así la
  //      estadística se asocia al jugador correcto en vez de crear un goleador
  //      fantasma (p.ej. "GLEN U" -> "Glen U").
  //   2. Los nombres que quedan sin match se ofrecen para inscribir en un modal.
  // Solo corre en el flujo del organizador (este form); el anotador no inscribe.
  const saveWithInscription = async (
    events: MatchEvent[],
    performSave: (finalEvents: MatchEvent[]) => void
  ) => {
    const teamIds = Array.from(
      new Set(events.map((e) => e.teamId).filter(Boolean))
    );
    if (teamIds.length === 0) {
      performSave(events);
      return;
    }

    const fresh = await fetchTeamsByIds(teamIds);
    // teamId -> (nombre normalizado -> jugador oficial del roster {name, id})
    const rosterByTeam = new Map<
      string,
      Map<string, { name: string; id: string }>
    >();
    for (const t of fresh) {
      const m = new Map<string, { name: string; id: string }>();
      for (const p of t.players ?? [])
        m.set(normalizePlayerName(p.name), { name: p.name, id: p.id });
      rosterByTeam.set(t.id, m);
    }

    // 1. Canonizar el nombre y ESTAMPAR el player_id de los que ya están en el
    //    roster, para que la estadística quede atada al jugador correcto.
    const finalEvents = events.map((e) => {
      const rp = rosterByTeam.get(e.teamId)?.get(normalizePlayerName(e.playerName));
      return rp ? { ...e, playerName: rp.name, playerId: rp.id } : e;
    });

    // 2. Agrupar los nombres que siguen sin estar en el roster (para inscribir).
    const byTeam = new Map<
      string,
      { teamName: string; names: string[]; seen: Set<string> }
    >();
    for (const e of finalEvents) {
      const name = e.playerName.trim();
      if (!name) continue;
      const key = normalizePlayerName(name);
      if (rosterByTeam.get(e.teamId)?.has(key)) continue;
      const entry =
        byTeam.get(e.teamId) ??
        {
          teamName: fresh.find((t) => t.id === e.teamId)?.name ?? "Equipo",
          names: [],
          seen: new Set<string>(),
        };
      if (!entry.seen.has(key)) {
        entry.seen.add(key);
        entry.names.push(name);
      }
      byTeam.set(e.teamId, entry);
    }
    const groups = Array.from(byTeam.entries()).map(([teamId, v]) => ({
      teamId,
      teamName: v.teamName,
      names: v.names,
    }));

    if (groups.length === 0) {
      performSave(finalEvents);
      return;
    }
    setInscribeData({ groups, freshTeams: fresh, finalEvents, performSave });
    setInscribeOpen(true);
  };

  const confirmInscribe = async () => {
    if (!inscribeData) return;
    setInscribing(true);
    const { groups, freshTeams, finalEvents, performSave } = inscribeData;
    // teamId -> (nombre normalizado -> player id), arrancando del roster fresco.
    const idByTeam = new Map<string, Map<string, string>>();
    for (const t of freshTeams) {
      const m = new Map<string, string>();
      for (const p of t.players ?? []) m.set(normalizePlayerName(p.name), p.id);
      idByTeam.set(t.id, m);
    }
    for (const g of groups) {
      // Partimos de la plantilla fresca (con sus ids estables) y le sumamos
      // solo los nombres nuevos; updateTeamPlayers conserva los existentes.
      const existing = freshTeams.find((t) => t.id === g.teamId)?.players ?? [];
      const newPlayers: Player[] = g.names.map((name) => ({
        id: crypto.randomUUID(),
        name,
        teamId: g.teamId,
      }));
      await updateTeamPlayers(g.teamId, [...existing, ...newPlayers]);
      const m = idByTeam.get(g.teamId) ?? new Map<string, string>();
      for (const p of newPlayers) m.set(normalizePlayerName(p.name), p.id);
      idByTeam.set(g.teamId, m);
    }
    // Estampar el player_id de los recién inscritos (los del roster ya lo
    // traen desde la canonización).
    const stamped = finalEvents.map((e) => {
      if (e.playerId) return e;
      const pid = idByTeam.get(e.teamId)?.get(normalizePlayerName(e.playerName));
      return pid ? { ...e, playerId: pid } : e;
    });
    setInscribing(false);
    setInscribeOpen(false);
    performSave(stamped);
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

      void saveWithInscription(events, (finalEvents) => {
        updateMatch(match.tournamentId, match.id, homeSetsWon, awaySetsWon, finalEvents, completedSets);
        toast.success("Resultado guardado");
        router.push(`/tournaments/${match.tournamentId}`);
      });
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

    void saveWithInscription(events, (finalEvents) => {
      updateMatch(match.tournamentId, match.id, home, away, finalEvents);
      toast.success("Resultado guardado");
      router.push(`/tournaments/${match.tournamentId}`);
    });
  };

  const renderPlayerSelect = (
    teamId: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string
  ) => {
    const options =
      teamId === match.homeTeamId
        ? homePlayerOptions
        : teamId === match.awayTeamId
          ? awayPlayerOptions
          : [];
    return (
      <PlayerCombobox
        options={options}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-8 text-sm"
        maxLength={60}
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

      <Dialog open={inscribeOpen} onOpenChange={(o) => !inscribing && setInscribeOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Jugadores no inscritos</DialogTitle>
            <DialogDescription>
              Estos nombres no están en la plantilla de su equipo. Al guardar
              quedarán inscritos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {inscribeData?.groups.map((g) => (
              <div key={g.teamId} className="space-y-1">
                <p className="text-sm font-medium">{g.teamName}</p>
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {g.names.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInscribeOpen(false)}
              disabled={inscribing}
            >
              Cancelar
            </Button>
            <Button onClick={confirmInscribe} disabled={inscribing}>
              {inscribing ? "Guardando..." : "Guardar e inscribir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
