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
} from "@/lib/baseball-scoresheet";

// ============================================================
// Tipos del payload del endpoint
// ============================================================

interface ScorerMatch {
  id: string;
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
  resultEnteredByName: string | null;
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

interface ScorerData {
  tournament: {
    id: string;
    name: string;
    sport: Sport;
    format: string;
    enabledStats: MatchEventType[];
    plan: string;
  };
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

  // Restaurar nombre del scorer desde localStorage al cargar.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(`scorer_name_${token}`);
    if (saved) setScorerName(saved);
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

  if (loading) {
    return <FullScreenCentered icon={<Loader2 className="h-8 w-8 animate-spin" />} text="Cargando..." />;
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

  // Pantalla 1: pedir nombre si no lo tenemos.
  if (!scorerName) {
    return <NameScreen tournamentName={data.tournament.name} onSubmit={handleNameSubmit} />;
  }

  // Pantalla 3: scoresheet de un partido.
  if (activeMatchId) {
    const match = data.matches.find((m) => m.id === activeMatchId);
    if (!match) {
      setActiveMatchId(null);
      return null;
    }
    return (
      <MatchScreen
        token={token}
        scorerName={scorerName}
        match={match}
        tournament={data.tournament}
        teams={data.teams}
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
  onChangeName,
}: {
  data: ScorerData;
  scorerName: string;
  onSelectMatch: (id: string) => void;
  onChangeName: () => void;
}) {
  const teamById = useMemo(() => {
    const map = new Map<string, ScorerTeam>();
    for (const t of data.teams) map.set(t.id, t);
    return map;
  }, [data.teams]);

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

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-5">
      <header className="space-y-1">
        <Badge variant="outline" className="mb-1">
          {data.tournament.name}
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

      <footer className="text-xs text-muted-foreground text-center space-y-2 pt-4 border-t">
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
  onBack,
  onSaved,
}: {
  token: string;
  scorerName: string;
  match: ScorerMatch;
  tournament: ScorerData["tournament"];
  teams: ScorerTeam[];
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

  const sportCategory = getSportCategory(tournament.sport);
  const isVolleyball = sportCategory === "volleyball";
  const isBaseball = sportCategory === "baseball";

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
  const [sets, setSets] = useState(() =>
    match.sets.length > 0
      ? match.sets.map((s) => ({
          setNumber: s.set_number,
          homePoints: s.home_points,
          awayPoints: s.away_points,
        }))
      : [{ setNumber: 1, homePoints: 0, awayPoints: 0 }]
  );
  const [submitting, setSubmitting] = useState(false);

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
  const [sheetStep, setSheetStep] = useState<1 | 2>(1);
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
  const homeSheetPlayers: Player[] = (home?.players ?? []).map((p) => ({
    ...p,
    teamId: home?.id ?? "",
  }));
  const awaySheetPlayers: Player[] = (away?.players ?? []).map((p) => ({
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

  const addSet = () => {
    setSets((prev) => [
      ...prev,
      { setNumber: prev.length + 1, homePoints: 0, awayPoints: 0 },
    ]);
  };

  const updateSet = (idx: number, patch: Partial<{ homePoints: number; awayPoints: number }>) => {
    setSets((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const removeSet = (idx: number) => {
    setSets((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, setNumber: i + 1 })));
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
          ...buildScoresheetEventsForTeam(homeSheet, match.homeTeamId, homeSheetPlayers, enabledStats),
          ...buildScoresheetEventsForTeam(awaySheet, match.awayTeamId, awaySheetPlayers, enabledStats),
        ]
      : eventEntries.map((e) => ({
          teamId: e.teamId,
          playerName: e.playerName.trim(),
          type: e.type,
        }));

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
            sets: isVolleyball ? sets : undefined,
            events: outEvents.map((e) => ({
              teamId: e.teamId,
              playerName: e.playerName,
              type: e.type,
              paid: false,
            })),
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
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
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
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
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
            <span className="text-sm text-muted-foreground">Paso {sheetStep} de 2</span>
          </div>

          <BaseballScoresheet
            key={sheetStep === 1 ? "home" : "away"}
            teamName={sheetStep === 1 ? home?.name ?? "Local" : away?.name ?? "Visitante"}
            teamId={(sheetStep === 1 ? home?.id : away?.id) ?? ""}
            players={sheetStep === 1 ? homeSheetPlayers : awaySheetPlayers}
            stats={enabledStats}
            values={sheetStep === 1 ? homeSheet : awaySheet}
            onChange={(p, s, c) => sheetChange(sheetStep === 1 ? "home" : "away", p, s, c)}
          />

          <div className="flex gap-2">
            {sheetStep === 1 ? (
              <>
                <Button variant="outline" className="flex-1 h-12" onClick={onBack}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Volver
                </Button>
                <Button
                  className="flex-1 h-12"
                  onClick={() => {
                    const hs = Number(homeScore);
                    const as = Number(awayScore);
                    if (!Number.isInteger(hs) || !Number.isInteger(as) || hs < 0 || as < 0) {
                      toast.error("Ingresá el marcador (carreras) válido");
                      return;
                    }
                    setSheetStep(2);
                  }}
                >
                  {away?.name ?? "Equipo 2"} <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" className="flex-1 h-12" onClick={() => setSheetStep(1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> {home?.name ?? "Equipo 1"}
                </Button>
                <Button className="flex-1 h-12" onClick={handleSave} disabled={submitting}>
                  {submitting ? "Guardando..." : "Guardar resultado"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Volleyball sets */}
      {isVolleyball && (
        <div className="space-y-2 rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Sets</p>
            <Button size="sm" variant="outline" onClick={addSet} disabled={sets.length >= 9}>
              <Plus className="h-3 w-3 mr-1" /> Agregar
            </Button>
          </div>
          {sets.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Badge variant="secondary" className="shrink-0">Set {s.setNumber}</Badge>
              <Input
                type="number"
                min={0}
                max={99}
                value={s.homePoints}
                onChange={(e) => updateSet(i, { homePoints: Number(e.target.value) || 0 })}
                className="text-center"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="number"
                min={0}
                max={99}
                value={s.awayPoints}
                onChange={(e) => updateSet(i, { awayPoints: Number(e.target.value) || 0 })}
                className="text-center"
              />
              {sets.length > 1 && (
                <Button size="sm" variant="ghost" onClick={() => removeSet(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
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

          {/* Datalists con el roster de cada equipo. Cada input de jugador
              referencia uno via `list={`players-${teamId}`}` y obtiene
              typeahead nativo + sugerencias del browser. Si el roster está
              vacío o el anotador escribe un nombre no listado, se acepta
              igual como texto libre — el campo es input, no select. */}
          {home && home.players.length > 0 && (
            <datalist id={`scorer-players-${home.id}`}>
              {home.players.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          )}
          {away && away.players.length > 0 && (
            <datalist id={`scorer-players-${away.id}`}>
              {away.players.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          )}

          {eventEntries.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {eventEntries.map((e, i) => {
                const def = getStatDefinition(e.type);
                const teamHasRoster =
                  (e.teamId === home?.id && (home?.players.length ?? 0) > 0) ||
                  (e.teamId === away?.id && (away?.players.length ?? 0) > 0);
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
                      <input
                        type="text"
                        list={teamHasRoster ? `scorer-players-${e.teamId}` : undefined}
                        value={e.playerName}
                        onChange={(ev) => updateEvent(i, { playerName: ev.target.value })}
                        placeholder="Jugador"
                        className="h-8 min-w-0 flex-[1.4] rounded-md border bg-background px-2 text-xs"
                        maxLength={60}
                        autoComplete="off"
                      />
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
        <Button
          onClick={handleSave}
          disabled={submitting}
          className="w-full h-12 text-base"
        >
          {submitting ? "Guardando..." : "Guardar resultado"}
        </Button>
      )}

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
