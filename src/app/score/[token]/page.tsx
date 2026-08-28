"use client";

import { use, useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, ChevronLeft, ChevronRight, Trophy, CheckCircle2, Clock, Plus, Trash2, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sport,
  MatchEventType,
  Player,
  getSportCategory,
  getStatDefinition,
} from "@/types";
import { BaseballScoresheet } from "@/components/forms/baseball-scoresheet";
import {
  PlayerStats,
  buildScoresheetData,
  buildScoresheetEventsForTeam,
  BASEBALL_SCORESHEET_STATS,
  BASEBALL_OFFENSIVE_STATS,
  BASEBALL_DEFENSIVE_STATS,
} from "@/lib/baseball-scoresheet";
import { dedupePlayersByName, buildPlayerNameOptions } from "@/lib/name-utils";
import {
  setsForScore,
  validateVolleyballSets,
  volleyballDrawAllowed,
} from "@/lib/volleyball-sets";
import { buildWalkoverSets, getWalkoverRule } from "@/lib/walkover";
import { PlayerCombobox } from "@/components/forms/player-combobox";
import { FairPlayPicker } from "@/components/forms/fair-play-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ============================================================
// Tipos del payload del endpoint
// ============================================================

interface ScorerMatch {
  id: string;
  /** A qué torneo pertenece: un link puede cruzar varios. */
  tournamentId: string;
  round: number;
  matchNumber: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  date: string | null;
  time: string | null;
  venue: string | null;
  /** "group" | "playoff" | null. Solo vóley la usa: en playoffs no hay empate. */
  phase: string | null;
  resultEnteredByName: string | null;
  /** Equipo que ganó el Juego Limpio, null si no se le dio a nadie. */
  fairPlayTeamId: string | null;
  events: {
    id: string;
    team_id: string;
    player_name: string;
    type: MatchEventType;
    position: string | null;
    paid: boolean;
  }[];
  sets: {
    set_number: number;
    home_points: number;
    away_points: number;
  }[];
}

interface ScorerTeam {
  id: string;
  name: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  /** Roster del equipo. Si está vacío el anotador escribe nombres libres
   *  (caso típico de torneos donde el organizer no cargó jugadores). */
  players: { id: string; name: string }[];
}

interface ScorerTournament {
  id: string;
  name: string;
  sport: Sport;
  format: string;
  enabledStats: MatchEventType[];
  plan: string;
  /** Solo vóley: cuántos sets se juegan. Define el marcador de W. */
  bestOf?: 3 | 5;
}

interface ScorerData {
  /** Torneos cubiertos por el link (1..N). El deporte y las stats
   *  habilitadas salen del torneo de cada partido, no de uno global. */
  tournaments: ScorerTournament[];
  teams: ScorerTeam[];
  matches: ScorerMatch[];
  expiresAt: string;
  matchIds: string[];
}

// ============================================================
// Página principal — orquesta las 3 pantallas
// ============================================================

export default function ScorePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<ScorerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scorerName, setScorerName] = useState<string>("");
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  // El anotador cerró su propio link con "Terminé mi labor".
  const [finished, setFinished] = useState(false);

  // Cargar datos del link.
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/scorer/${token}`, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 404) {
          setError("link-not-found");
        } else if (res.status === 429) {
          setError("rate-limit");
        } else {
          setError("server-error");
        }
        return;
      }
      const json = (await res.json()) as ScorerData;
      setData(json);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("network");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Restaurar nombre del scorer desde localStorage al cargar. Junto con él,
  // la marca de "ya terminé": si refresca después de cerrar, le mostramos la
  // pantalla de gracias en vez del error genérico de link inválido.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(`scorer_name_${token}`);
    if (saved) setScorerName(saved);
    if (window.localStorage.getItem(`scorer_finished_${token}`) === "1") {
      setFinished(true);
    }
  }, [token]);

  const handleNameSubmit = (name: string) => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Escribí tu nombre (mínimo 2 letras)");
      return;
    }
    setScorerName(trimmed);
    window.localStorage.setItem(`scorer_name_${token}`, trimmed);
  };

  // Cierra el link desde el lado del anotador. Devuelve false si falló, para
  // que la pantalla deje el diálogo abierto y pueda reintentar.
  const handleFinish = async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/scorer/${token}/finish`, { method: "POST" });
      // 404 = el link ya no existe o ya estaba cerrado: para el anotador el
      // resultado es el mismo, terminó igual.
      if (!res.ok && res.status !== 404) {
        toast.error("No pudimos cerrar el link. Probá de nuevo.");
        return false;
      }
    } catch (err) {
      console.error(err);
      toast.error("Sin conexión. Probá de nuevo.");
      return false;
    }
    window.localStorage.setItem(`scorer_finished_${token}`, "1");
    setFinished(true);
    return true;
  };

  if (loading) {
    return <FullScreenCentered icon={<Loader2 className="h-8 w-8 animate-spin" />} text="Cargando..." />;
  }

  if (finished) {
    return (
      <FullScreenCentered
        icon={<CheckCircle2 className="h-12 w-12 text-green-600" />}
        text={scorerName ? `¡Listo, ${scorerName}! Gracias.` : "¡Listo! Gracias."}
        sub="Los resultados quedaron guardados para el organizador. Ya podés cerrar esta página."
      />
    );
  }

  if (error === "link-not-found") {
    return (
      <FullScreenCentered
        icon={<Trophy className="h-12 w-12 text-muted-foreground" />}
        text="Este link no es válido o ya expiró."
        sub="Pedile al organizador que te genere uno nuevo."
      />
    );
  }

  if (error || !data) {
    return (
      <FullScreenCentered
        icon={<Trophy className="h-12 w-12 text-muted-foreground" />}
        text="No pudimos cargar los partidos."
        sub="Probá refrescar la página."
      />
    );
  }

  // Título del link: el nombre del torneo si es uno solo, o cuántos son.
  const headerTitle =
    data.tournaments.length === 1
      ? data.tournaments[0].name
      : `${data.tournaments.length} torneos`;

  // Pantalla 1: pedir nombre si no lo tenemos.
  if (!scorerName) {
    return <NameScreen tournamentName={headerTitle} onSubmit={handleNameSubmit} />;
  }

  // Pantalla 3: scoresheet de un partido.
  if (activeMatchId) {
    const match = data.matches.find((m) => m.id === activeMatchId);
    // El torneo del partido define deporte y stats habilitadas. Si no
    // aparece (torneo borrado entre carga y click), volvemos a la lista.
    const matchTournament = match
      ? data.tournaments.find((t) => t.id === match.tournamentId)
      : undefined;
    if (!match || !matchTournament) {
      setActiveMatchId(null);
      return null;
    }
    return (
      <MatchScreen
        token={token}
        scorerName={scorerName}
        match={match}
        tournament={matchTournament}
        teams={data.teams}
        allMatches={data.matches}
        onBack={() => setActiveMatchId(null)}
        onSaved={() => {
          loadData();
          setActiveMatchId(null);
        }}
      />
    );
  }

  // Pantalla 2: lista de partidos.
  return (
    <MatchListScreen
      data={data}
      scorerName={scorerName}
      onSelectMatch={(id) => setActiveMatchId(id)}
      onFinish={handleFinish}
      onChangeName={() => {
        window.localStorage.removeItem(`scorer_name_${token}`);
        setScorerName("");
      }}
    />
  );
}

// ============================================================
// Pantalla 1 — pedir nombre
// ============================================================

function NameScreen({ tournamentName, onSubmit }: { tournamentName: string; onSubmit: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center space-y-2">
          <Trophy className="h-12 w-12 text-amber-500 mx-auto" />
          <h1 className="text-2xl font-bold">{tournamentName}</h1>
          <p className="text-sm text-muted-foreground">
            Te invitaron a anotar resultados. Antes que nada, ¿cómo te llamás?
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(name);
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="scorer-name">Tu nombre</Label>
            <Input
              id="scorer-name"
              type="text"
              autoFocus
              autoComplete="name"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Juan Pérez"
            />
          </div>
          <Button type="submit" className="w-full" disabled={name.trim().length < 2}>
            Continuar
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center">
          Tu nombre queda guardado en este dispositivo. Lo verás vos y el
          organizador en cada resultado que cargues.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Pantalla 2 — lista de partidos
// ============================================================

function MatchListScreen({
  data,
  scorerName,
  onSelectMatch,
  onFinish,
  onChangeName,
}: {
  data: ScorerData;
  scorerName: string;
  onSelectMatch: (id: string) => void;
  onFinish: () => Promise<boolean>;
  onChangeName: () => void;
}) {
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const teamById = useMemo(() => {
    const map = new Map<string, ScorerTeam>();
    for (const t of data.teams) map.set(t.id, t);
    return map;
  }, [data.teams]);

  // Con un link multi-torneo, cada partido muestra de qué torneo es; con uno
  // solo sería ruido repetido en cada fila y basta el badge del header.
  const isMultiTournament = data.tournaments.length > 1;
  const tournamentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of data.tournaments) map.set(t.id, t.name);
    return map;
  }, [data.tournaments]);

  const sortedMatches = useMemo(
    () =>
      [...data.matches].sort((a, b) => {
        if (!a.date || !b.date) return 0;
        const aMs = Date.parse(`${a.date}T${a.time ?? "00:00"}:00`);
        const bMs = Date.parse(`${b.date}T${b.time ?? "00:00"}:00`);
        return aMs - bMs;
      }),
    [data.matches]
  );

  const expiresAt = new Date(data.expiresAt);
  const pendingCount = sortedMatches.filter((m) => m.status !== "completed").length;

  const handleConfirmFinish = async () => {
    setFinishing(true);
    const ok = await onFinish();
    setFinishing(false);
    // Si falló dejamos el diálogo abierto: el toast ya explicó qué pasó y
    // puede reintentar sin volver a buscar el botón.
    if (ok) setConfirmFinish(false);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-5">
      <header className="space-y-1">
        <Badge variant="outline" className="mb-1">
          {isMultiTournament
            ? `${data.tournaments.length} torneos`
            : data.tournaments[0]?.name}
        </Badge>
        <h1 className="text-xl font-bold">Hola {scorerName} 👋</h1>
        <p className="text-sm text-muted-foreground">
          {sortedMatches.length} {sortedMatches.length === 1 ? "partido" : "partidos"} para anotar
        </p>
      </header>

      <div className="space-y-2">
        {sortedMatches.map((m) => {
          const home = m.homeTeamId ? teamById.get(m.homeTeamId) : null;
          const away = m.awayTeamId ? teamById.get(m.awayTeamId) : null;
          const isCompleted = m.status === "completed";
          return (
            <button
              key={m.id}
              onClick={() => onSelectMatch(m.id)}
              className="w-full rounded-lg border bg-card p-4 text-left hover:bg-muted/50 transition-colors space-y-2 active:scale-[0.99]"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-base">
                  {home?.name ?? "TBD"}{" "}
                  <span className="text-muted-foreground font-normal">vs</span>{" "}
                  {away?.name ?? "TBD"}
                </div>
                {isCompleted ? (
                  <Badge className="bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Cargado
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    <Clock className="h-3 w-3 mr-1" /> Pendiente
                  </Badge>
                )}
              </div>
              {isMultiTournament && (
                <div className="text-[11px] font-medium text-muted-foreground">
                  {tournamentNameById.get(m.tournamentId) ?? ""}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                {m.date} · {m.time}
                {m.venue ? ` · ${m.venue}` : ""}
              </div>
              {isCompleted && (
                <div className="text-sm font-bold">
                  {m.homeScore} - {m.awayScore}
                  {m.resultEnteredByName && (
                    <span className="text-xs font-normal text-muted-foreground ml-2">
                      Cargado por {m.resultEnteredByName}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <footer className="text-xs text-muted-foreground text-center space-y-3 pt-4 border-t">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setConfirmFinish(true)}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" /> Terminé mi labor
        </Button>
        <p>
          Este link expira el{" "}
          {expiresAt.toLocaleString("es-CO", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
          .
        </p>
        <button onClick={onChangeName} className="underline">
          Cambiar nombre
        </button>
      </footer>

      <Dialog open={confirmFinish} onOpenChange={setConfirmFinish}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Terminaste de anotar?</DialogTitle>
            <DialogDescription>
              Los resultados se envían tal como están ahora. ¿Está todo
              correcto?
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {pendingCount > 0 ? (
              <>
                Te {pendingCount === 1 ? "queda" : "quedan"}{" "}
                <span className="font-semibold text-foreground">
                  {pendingCount}{" "}
                  {pendingCount === 1 ? "partido" : "partidos"} sin cargar
                </span>
                . Al cerrar no vas a poder seguir cargando ni corregir lo que ya
                enviaste.
              </>
            ) : (
              <>
                Cargaste todos los partidos. Al cerrar no vas a poder corregir
                lo que ya enviaste.
              </>
            )}{" "}
            Si necesitás volver, pedile al organizador un link nuevo.
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmFinish(false)}
              disabled={finishing}
            >
              No, sigo anotando
            </Button>
            <Button onClick={handleConfirmFinish} disabled={finishing}>
              {finishing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cerrando...
                </>
              ) : (
                "Sí, terminé"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Pantalla 3 — scoresheet de un partido
// ============================================================

interface EventEntry {
  type: MatchEventType;
  teamId: string;
  playerName: string;
}

function MatchScreen({
  token,
  scorerName,
  match,
  tournament,
  teams,
  allMatches,
  onBack,
  onSaved,
}: {
  token: string;
  scorerName: string;
  match: ScorerMatch;
  tournament: ScorerTournament;
  teams: ScorerTeam[];
  allMatches: ScorerMatch[];
  onBack: () => void;
  onSaved: () => void;
}) {
  const teamById = useMemo(() => {
    const map = new Map<string, ScorerTeam>();
    for (const t of teams) map.set(t.id, t);
    return map;
  }, [teams]);

  const home = match.homeTeamId ? teamById.get(match.homeTeamId) : null;
  const away = match.awayTeamId ? teamById.get(match.awayTeamId) : null;

  // Nombres candidatos para el dropdown de jugador: roster + nombres ya usados
  // en eventos de todo el torneo (por equipo). Alimenta la selección aunque el
  // equipo no tenga roster cargado; no se toca la plantilla.
  const eventNamesForTeam = (teamId: string | null | undefined) =>
    teamId
      ? allMatches.flatMap((m) =>
          m.events
            .filter((e) => e.team_id === teamId)
            .map((e) => e.player_name)
        )
      : [];
  const homeNameOptions = buildPlayerNameOptions(
    (home?.players ?? []).map((p) => p.name),
    eventNamesForTeam(home?.id)
  );
  const awayNameOptions = buildPlayerNameOptions(
    (away?.players ?? []).map((p) => p.name),
    eventNamesForTeam(away?.id)
  );

  const sportCategory = getSportCategory(tournament.sport);
  const isVolleyball = sportCategory === "volleyball";
  const isBaseball = sportCategory === "baseball";
  // Marcador reglamentario de W. Misma fuente que el organizador y la
  // descalificación. Ver lib/walkover.ts.
  const walkoverRule = getWalkoverRule(tournament.sport, tournament.bestOf);

  // Inicializar valores desde el partido existente si ya tiene score.
  const [homeScore, setHomeScore] = useState(match.homeScore?.toString() ?? "");
  const [awayScore, setAwayScore] = useState(match.awayScore?.toString() ?? "");
  const [eventEntries, setEventEntries] = useState<EventEntry[]>(() =>
    match.events.map((e) => ({
      type: e.type,
      teamId: e.team_id,
      playerName: e.player_name,
    }))
  );
  // Los puntos se guardan como texto: con number el campo arranca en 0 y no se
  // puede vaciar para escribir encima (todo intento vuelve a 0).
  const [sets, setSets] = useState(() =>
    match.sets.map((s) => ({
      setNumber: s.set_number,
      homePoints: String(s.home_points),
      awayPoints: String(s.away_points),
    }))
  );
  const [submitting, setSubmitting] = useState(false);
  // Error de validación del formulario, aparte del `error` de carga de la
  // página. Se muestra en rojo junto al botón: un toast se va solo y el que
  // está al lado de la cancha, con el celular en una mano, se lo pierde.
  const [formError, setFormError] = useState<string | null>(null);
  // null = no hay W pendiente de confirmar; true/false = a quién se le daría.
  const [walkoverWinnerIsHome, setWalkoverWinnerIsHome] = useState<boolean | null>(null);

  // Béisbol/softball/wiffleball: matriz jugador×stat por equipo (la misma
  // planilla que usa el organizador), precargada desde los eventos guardados.
  const rawEvents = useMemo(
    () =>
      match.events.map((e) => ({
        teamId: e.team_id,
        playerName: e.player_name,
        type: e.type,
      })),
    [match.events]
  );
  // Béisbol: planilla por pasos (1 = equipo local, 2 = visitante).
  // 4 pasos: 1=local ofensiva, 2=local defensiva, 3=visitante ofensiva,
  // 4=visitante defensiva.
  const [sheetStep, setSheetStep] = useState<1 | 2 | 3 | 4>(1);
  const [homeSheet, setHomeSheet] = useState<Record<string, PlayerStats>>(() =>
    buildScoresheetData(rawEvents, match.homeTeamId)
  );
  const [awaySheet, setAwaySheet] = useState<Record<string, PlayerStats>>(() =>
    buildScoresheetData(rawEvents, match.awayTeamId)
  );
  const sheetChange = (
    side: "home" | "away",
    playerName: string,
    stat: MatchEventType,
    count: number
  ) => {
    const setter = side === "home" ? setHomeSheet : setAwaySheet;
    setter((prev) => ({
      ...prev,
      [playerName]: { ...(prev[playerName] || {}), [stat]: count },
    }));
  };
  // Players con teamId para el componente de planilla (espera Player[]).
  // Sin dedupe, un nombre repetido en la nómina pinta dos filas que editan la
  // misma celda: se ven como espejo y al guardar duplican los eventos.
  const homeSheetPlayers: Player[] = dedupePlayersByName(home?.players ?? []).map((p) => ({
    ...p,
    teamId: home?.id ?? "",
  }));
  const awaySheetPlayers: Player[] = dedupePlayersByName(away?.players ?? []).map((p) => ({
    ...p,
    teamId: away?.id ?? "",
  }));

  // Catálogo de stats habilitadas (excluyendo computed como goals_against).
  const enabledStats = useMemo(() => {
    return tournament.enabledStats.filter((key) => {
      const def = getStatDefinition(key);
      return def && !def.computed;
    });
  }, [tournament.enabledStats]);

  // Juego limpio: es `computed` (no sale de eventos de jugador), así que queda
  // fuera de `enabledStats` de arriba y se pinta con su propio selector.
  const showFairPlay = tournament.enabledStats.includes("fair_play");
  const [fairPlayTeamId, setFairPlayTeamId] = useState<string | null>(
    match.fairPlayTeamId ?? null
  );

  const addEvent = (type: MatchEventType) => {
    setEventEntries((prev) => [
      ...prev,
      { type, teamId: home?.id ?? "", playerName: "" },
    ]);
  };

  const updateEvent = (idx: number, patch: Partial<EventEntry>) => {
    setEventEntries((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, ...patch } : e))
    );
  };

  const removeEvent = (idx: number) => {
    setEventEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSet = (idx: number, patch: Partial<{ homePoints: string; awayPoints: string }>) => {
    setSets((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  // Vóley: las filas de sets salen del marcador, no de un botón "Agregar".
  // Un 2-1 son tres filas, un 1-1 son dos. Antes había que acordarse de
  // agregarlas a mano y era el error más común de la planilla.
  const volleyHome = /^\d+$/.test(homeScore) ? parseInt(homeScore) : null;
  const volleyAway = /^\d+$/.test(awayScore) ? parseInt(awayScore) : null;
  // Se topa en el máximo del formato para no pintar cincuenta casillas por un
  // dedazo; el marcador imposible lo rechaza igual la validación al guardar.
  const volleyMaxSets = Math.ceil((tournament.bestOf ?? 3) / 2) * 2 - 1;
  const volleyRawSets =
    volleyHome !== null && volleyAway !== null
      ? setsForScore(volleyHome, volleyAway)
      : 0;
  const volleyTotalSets = volleyRawSets > volleyMaxSets ? 0 : volleyRawSets;
  const drawAllowed = volleyballDrawAllowed(tournament.format, match.phase);

  useEffect(() => {
    if (!isVolleyball) return;
    setSets((prev) => {
      if (prev.length === volleyTotalSets) return prev;
      return Array.from({ length: volleyTotalSets }, (_, i) => ({
        setNumber: i + 1,
        homePoints: prev[i]?.homePoints ?? "",
        awayPoints: prev[i]?.awayPoints ?? "",
      }));
    });
  }, [isVolleyball, volleyTotalSets]);

  /**
   * W (walkover): un equipo no se presentó. Manda el marcador reglamentario
   * del deporte, sin eventos, por el mismo endpoint que un resultado normal —
   * el servidor revalida igual, así que no hace falta una ruta aparte.
   */
  const handleWalkover = async () => {
    if (walkoverWinnerIsHome === null) return;
    const winnerIsHome = walkoverWinnerIsHome;
    const hs = winnerIsHome ? walkoverRule.winnerScore : walkoverRule.loserScore;
    const as = winnerIsHome ? walkoverRule.loserScore : walkoverRule.winnerScore;
    const wSets = buildWalkoverSets(walkoverRule, winnerIsHome);

    setSubmitting(true);
    try {
      const res = await fetch(`/api/scorer/${token}/match/${match.id}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scorerName,
          homeScore: hs,
          awayScore: as,
          sets: isVolleyball
            ? wSets?.map((s) => ({
                setNumber: s.setNumber,
                homePoints: s.homePoints,
                awayPoints: s.awayPoints,
              }))
            : undefined,
          events: [],
          walkover: true,
          ...(showFairPlay ? { fairPlayTeamId } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "No pudimos guardar");
        return;
      }
      setWalkoverWinnerIsHome(null);
      toast.success("Partido cargado como W");
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error("Error de red");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSave = async () => {
    // Validación cliente. El servidor revalida igual.
    const hs = Number(homeScore);
    const as = Number(awayScore);
    if (!Number.isInteger(hs) || !Number.isInteger(as) || hs < 0 || as < 0 || hs > 999 || as > 999) {
      toast.error("Marcador inválido");
      return;
    }
    // Validar eventos manuales: cada uno debe tener equipo y jugador.
    // (Béisbol no usa eventos manuales — se arman desde la planilla.)
    if (!isBaseball) {
      for (const e of eventEntries) {
        if (!e.teamId || !e.playerName.trim()) {
          toast.error("Hay eventos sin equipo o jugador");
          return;
        }
      }
    }

    // Béisbol: expandir la planilla a eventos individuales con la misma
    // convención que usa el organizador. Otros deportes: eventos manuales.
    const outEvents = isBaseball
      ? [
          // Set completo (no enabledStats): la planilla captura todo y se
          // guarda todo, aunque el público solo vea las stats seleccionadas.
          ...buildScoresheetEventsForTeam(homeSheet, match.homeTeamId, homeSheetPlayers, BASEBALL_SCORESHEET_STATS),
          ...buildScoresheetEventsForTeam(awaySheet, match.awayTeamId, awaySheetPlayers, BASEBALL_SCORESHEET_STATS),
        ]
      : eventEntries.map((e) => ({
          teamId: e.teamId,
          playerName: e.playerName.trim(),
          type: e.type,
        }));

    // Voley: los sets son OBLIGATORIOS y tienen que cuadrar con el marcador.
    // Un 2-1 son tres sets, un 2-0 son dos. La tabla desempata por ratio de
    // sets y de puntos, así que un partido cargado a medias le desordena el
    // torneo al organizador sin que nadie note de dónde salió.
    // El servidor exige enteros 0-99, así que convertimos acá.
    const outSets: { setNumber: number; homePoints: number; awayPoints: number }[] = [];
    if (isVolleyball) {
      for (const s of sets) {
        const hp = s.homePoints.trim();
        const ap = s.awayPoints.trim();
        if (hp === "" && ap === "") continue;
        const hpNum = Number(hp);
        const apNum = Number(ap);
        if (
          hp === "" || ap === "" ||
          !Number.isInteger(hpNum) || !Number.isInteger(apNum) ||
          hpNum < 0 || apNum < 0 || hpNum > 99 || apNum > 99
        ) {
          setFormError(`Set ${s.setNumber}: ingresá los puntos de los dos equipos.`);
          return;
        }
        outSets.push({
          setNumber: outSets.length + 1,
          homePoints: hpNum,
          awayPoints: apNum,
        });
      }

      const setsError = validateVolleyballSets(hs, as, outSets, {
        setsToWin: Math.ceil((tournament.bestOf ?? 3) / 2),
        allowDraw: drawAllowed,
      });
      if (setsError) {
        setFormError(setsError);
        return;
      }
    }
    setFormError(null);

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/scorer/${token}/match/${match.id}/result`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scorerName,
            homeScore: hs,
            awayScore: as,
            sets: isVolleyball ? outSets : undefined,
            events: outEvents.map((e) => ({
              teamId: e.teamId,
              playerName: e.playerName,
              type: e.type,
              paid: false,
            })),
            // Solo se manda si el torneo premia el juego limpio: así el
            // servidor no pisa la columna en los torneos que no lo usan.
            ...(showFairPlay ? { fairPlayTeamId } : {}),
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "No pudimos guardar");
        return;
      }
      toast.success("Resultado guardado");
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error("Error de red");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md md:max-w-2xl mx-auto px-4 py-6 space-y-4">
      <BackHeader onBack={onBack} />

      {/* Béisbol/softball/wiffleball tienen muchas estadísticas y no se pueden
          anotar cómodo en celular: en mobile bloqueamos con un aviso y solo
          dejamos anotar desde desktop (md+). El resto del UI va oculto en
          mobile via `hidden md:block`. */}
      {isBaseball && (
        <div className="md:hidden rounded-lg border bg-card p-6 text-center space-y-3">
          <Monitor className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="font-semibold">Usá una pantalla más grande</p>
          <p className="text-sm text-muted-foreground">
            Los partidos de este deporte tienen muchas estadísticas. Para
            anotarlos, abrí este mismo enlace desde una computadora o portátil.
          </p>
        </div>
      )}

      <div className={`space-y-5 ${isBaseball ? "hidden md:block" : ""}`}>
      <div className="text-center space-y-1">
        <p className="text-xs text-muted-foreground">{match.date} · {match.time}</p>
        <h1 className="text-xl font-bold">
          {home?.name ?? "TBD"} <span className="font-normal text-muted-foreground">vs</span>{" "}
          {away?.name ?? "TBD"}
        </h1>
      </div>

      {/* Score input. En béisbol solo se muestra en el paso 1 (con el
          equipo local); el paso 2 es solo la planilla del visitante. */}
      {(!isBaseball || sheetStep === 1) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{home?.name ?? "Local"}</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={999}
              placeholder="0"
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="text-2xl font-bold text-center h-14"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{away?.name ?? "Visitante"}</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={999}
              placeholder="0"
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="text-2xl font-bold text-center h-14"
            />
          </div>
        </div>
      )}

      {/* Béisbol/softball/wiffleball: la misma planilla del organizador, por
          pasos (equipo local → siguiente → visitante). Solo visible en desktop
          (el wrapper la oculta en mobile). */}
      {isBaseball && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Estadísticas individuales</p>
            <span className="text-sm text-muted-foreground">Paso {sheetStep} de 4</span>
          </div>

          {(() => {
            const isHome = sheetStep <= 2;
            const isOffensive = sheetStep === 1 || sheetStep === 3;
            const side = isHome ? "home" : "away";
            const teamName = isHome ? home?.name ?? "Local" : away?.name ?? "Visitante";
            const teamId = (isHome ? home?.id : away?.id) ?? "";
            const players = isHome ? homeSheetPlayers : awaySheetPlayers;
            const values = isHome ? homeSheet : awaySheet;
            const onChange = (p: string, s: MatchEventType, c: number) =>
              sheetChange(side, p, s, c);
            // Una planilla por paso: ofensiva → defensiva del mismo equipo,
            // luego el otro equipo. Todas escriben la misma matriz del equipo.
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

          <div className="flex gap-2">
            {(() => {
              const step = sheetStep;
              const goBack = () =>
                step === 1 ? onBack() : setSheetStep((step - 1) as 1 | 2 | 3 | 4);
              const goNext = () => {
                // Validar marcador solo al salir del primer paso.
                if (step === 1) {
                  const hs = Number(homeScore);
                  const as = Number(awayScore);
                  if (!Number.isInteger(hs) || !Number.isInteger(as) || hs < 0 || as < 0) {
                    toast.error("Ingresá el marcador (carreras) válido");
                    return;
                  }
                }
                setSheetStep((step + 1) as 1 | 2 | 3 | 4);
              };
              const backLabel =
                step === 1
                  ? "Volver"
                  : step === 3
                  ? home?.name ?? "Equipo 1"
                  : "Ofensiva";
              const nextLabel =
                step === 1
                  ? "Defensiva"
                  : step === 2
                  ? away?.name ?? "Equipo 2"
                  : "Defensiva";
              return (
                <>
                  <Button variant="outline" className="flex-1 h-12" onClick={goBack}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> {backLabel}
                  </Button>
                  {step === 4 ? (
                    <Button className="flex-1 h-12" onClick={handleSave} disabled={submitting}>
                      {submitting ? "Guardando..." : "Guardar resultado"}
                    </Button>
                  ) : (
                    <Button className="flex-1 h-12" onClick={goNext}>
                      {nextLabel} <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Volleyball sets */}
      {isVolleyball && (
        <div className="space-y-2 rounded-lg border bg-card p-3">
          <p className="text-sm font-medium">Sets</p>
          <p className="text-xs text-muted-foreground">
            {volleyTotalSets === 0
              ? `Escribí arriba cuántos sets ganó cada equipo y acá aparecen las casillas.${
                  drawAllowed ? " Puede quedar empatado." : ""
                }`
              : `Puntos de cada set (25-23, 25-20, …)`}
          </p>
          {sets.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Badge variant="secondary" className="shrink-0">Set {s.setNumber}</Badge>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                placeholder="0"
                value={s.homePoints}
                onChange={(e) => updateSet(i, { homePoints: e.target.value })}
                onFocus={(e) => e.target.select()}
                className="text-center"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                placeholder="0"
                value={s.awayPoints}
                onChange={(e) => updateSet(i, { awayPoints: e.target.value })}
                onFocus={(e) => e.target.select()}
                className="text-center"
              />
            </div>
          ))}
        </div>
      )}

      {showFairPlay && (
        <div className="rounded-lg border bg-card p-3">
          <FairPlayPicker
            homeTeamId={match.homeTeamId}
            awayTeamId={match.awayTeamId}
            homeTeamName={home?.name ?? "Local"}
            awayTeamName={away?.name ?? "Visitante"}
            value={fairPlayTeamId}
            onChange={setFairPlayTeamId}
          />
        </div>
      )}

      {/* Events / stats (deportes con eventos manuales: fútbol, básquet, etc.) */}
      {!isBaseball && enabledStats.length > 0 && (
        <div className="space-y-2 rounded-lg border bg-card p-3">
          <p className="text-sm font-medium">Eventos / Stats</p>
          <div className="flex flex-wrap gap-1.5">
            {enabledStats.map((key) => {
              const def = getStatDefinition(key);
              if (!def) return null;
              return (
                <Button
                  key={key}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => addEvent(key)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {def.label}
                </Button>
              );
            })}
          </div>

          {eventEntries.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {eventEntries.map((e, i) => {
                const def = getStatDefinition(e.type);
                // Sugerencias para el dropdown según el equipo del evento.
                const playerOptions =
                  e.teamId === home?.id
                    ? homeNameOptions
                    : e.teamId === away?.id
                      ? awayNameOptions
                      : [];
                return (
                  <div key={i} className="space-y-1.5 rounded-md border bg-background p-2">
                    {/* Fila 1: etiqueta del evento + eliminar (siempre dentro de la tarjeta) */}
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {def?.label ?? e.type}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 text-muted-foreground"
                        onClick={() => removeEvent(i)}
                        aria-label="Quitar evento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {/* Fila 2: equipo + jugador. min-w-0 deja que ambos se encojan
                        para que nada se desborde de la tarjeta en mobile. */}
                    <div className="flex items-center gap-1.5">
                      <select
                        value={e.teamId}
                        onChange={(ev) => updateEvent(i, { teamId: ev.target.value })}
                        className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs"
                      >
                        <option value={home?.id ?? ""}>{home?.name ?? "Local"}</option>
                        <option value={away?.id ?? ""}>{away?.name ?? "Visit."}</option>
                      </select>
                      <div className="min-w-0 flex-[1.4]">
                        <PlayerCombobox
                          options={playerOptions}
                          value={e.playerName}
                          onChange={(v) => updateEvent(i, { playerName: v })}
                          placeholder="Jugador"
                          className="h-8 text-xs"
                          maxLength={60}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Save (béisbol guarda desde los botones del paso 2). */}
      {!isBaseball && (
        <div className="space-y-2">
          {formError && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
            >
              {formError}
            </p>
          )}
          <Button
            onClick={handleSave}
            disabled={submitting}
            className="w-full h-12 text-base"
          >
            {submitting ? "Guardando..." : "Guardar resultado"}
          </Button>
        </div>
      )}

      {/* W: el rival no se presentó. No hay marcador ni estadísticas que
          anotar, así que es un atajo aparte del flujo normal. */}
      <div className="rounded-lg border border-dashed p-3">
        <p className="text-sm font-medium">¿Un equipo no se presentó?</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Se carga la W con el marcador reglamentario: {walkoverRule.description}.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={submitting}
            onClick={() => setWalkoverWinnerIsHome(true)}
          >
            Gana {home?.name ?? "Local"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={submitting}
            onClick={() => setWalkoverWinnerIsHome(false)}
          >
            Gana {away?.name ?? "Visitante"}
          </Button>
        </div>
      </div>

      <Dialog
        open={walkoverWinnerIsHome !== null}
        onOpenChange={(o) => !o && !submitting && setWalkoverWinnerIsHome(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cargar W</DialogTitle>
            <DialogDescription>
              {(() => {
                const winner = walkoverWinnerIsHome ? home : away;
                const loser = walkoverWinnerIsHome ? away : home;
                const hs = walkoverWinnerIsHome
                  ? walkoverRule.winnerScore
                  : walkoverRule.loserScore;
                const as = walkoverWinnerIsHome
                  ? walkoverRule.loserScore
                  : walkoverRule.winnerScore;
                return (
                  <>
                    <strong>{loser?.name ?? "El rival"}</strong> no se presentó. El
                    partido queda{" "}
                    <strong>
                      {hs} - {as}
                    </strong>{" "}
                    a favor de <strong>{winner?.name}</strong>
                    {walkoverRule.setCount
                      ? `, con ${walkoverRule.setCount} sets de ${walkoverRule.setPoints?.winner}-${walkoverRule.setPoints?.loser}`
                      : ""}
                    , sin estadísticas de jugadores.
                  </>
                );
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={() => setWalkoverWinnerIsHome(null)}
            >
              Cancelar
            </Button>
            <Button size="sm" disabled={submitting} onClick={handleWalkover}>
              {submitting ? "Guardando..." : "Cargar W"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground text-center">
        Quedará registrado como cargado por <span className="font-medium">{scorerName}</span>.
      </p>
      </div>
    </div>
  );
}

// ============================================================
// Helpers UI
// ============================================================

function BackHeader({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="flex items-center text-sm text-muted-foreground hover:text-foreground">
      <ChevronLeft className="h-4 w-4 mr-1" />
      Volver a la lista
    </button>
  );
}

function FullScreenCentered({ icon, text, sub }: { icon: React.ReactNode; text: string; sub?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-3 max-w-sm">
        <div className="flex justify-center">{icon}</div>
        <p className="text-base font-medium">{text}</p>
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
