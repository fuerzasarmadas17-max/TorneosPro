"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, Download } from "lucide-react";
import { Tournament, getSportCategory } from "@/types";
import { useTournamentStats, CardEntry } from "@/hooks/use-tournament-stats";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { TableWatermark } from "./table-watermark";
import { useTournaments } from "@/context/tournament-context";
import { downloadStatsPdf } from "@/lib/stats-pdf";
import { BASEBALL_LEADERBOARD_ORDER } from "@/lib/baseball-order";
import { getShortName } from "@/lib/name-utils";

// Sin filtro de equipo: las cards muestran top 5 + "Ver más" → modal con
// top 10. La tabla individual de béisbol muestra top 5 + "Ver más" →
// top 20 inline (sin modal, solo extiende la tabla).
// Con filtro: ambas vistas muestran TODOS los entries del equipo, sin
// botón "Ver más".
const TOP_PREVIEW = 5;
const TOP_MODAL = 10;
const TOP_BASEBALL_EXPANDED = 20;

// El ranking de bateadores (beisbol/softball/wiffleball) usa calificación
// estilo MLB: un jugador "califica" si acumuló suficientes apariciones al
// plato según los partidos que jugó su equipo (lógica en use-tournament-stats).
// - Tabla general (sin filtro): solo se listan jugadores calificados,
//   ordenados por OPS puro. Así un OPS inflado en 1-2 turnos no encabeza.
// - Con filtro de equipo: se muestran TODOS los jugadores del equipo; los
//   que no califican van al final, atenuados y marcados con "*".

// Abreviación de stats para mostrar en mobile como header de columna.
// El título de la card (lb.pluralLabel = "Bases por bolas") queda intacto
// — solo se acorta la columna individual del valor para que no se rompa
// el layout responsive. Las stats no listadas usan lb.label tal cual.
const SHORT_STAT_HEADER: Record<string, string> = {
  walk: "BB",
  run_scored: "R",
  at_bat: "AB",
  fair_play: "JL",
};
const shortHeader = (statKey: string, fallback: string) =>
  SHORT_STAT_HEADER[statKey] ?? fallback;


const fmt = (v: number) => v.toFixed(3).replace(/^0/, "");

interface TournamentStatsProps {
  tournament: Tournament;
  canEdit?: boolean;
}

export function TournamentStats({ tournament, canEdit }: TournamentStatsProps) {
  const { leaderboards, hasStats, cardEntries, baseballPlayerStats, baseballFieldingStats } = useTournamentStats(tournament);
  const { getTeamById, updateEventPaid } = useTournaments();
  // Which leaderboard is being shown expanded in the dialog.
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  // Filtro de equipo único que aplica a todas las cards + la tabla
  // individual. "all" = sin filtro (comportamiento original).
  const [selectedTeamId, setSelectedTeamId] = useState<string>("all");
  // "Ver más" inline para la tabla de béisbol (sin filtro). Cuando hay
  // filtro de equipo este flag se ignora — siempre mostramos todos.
  const [baseballExpanded, setBaseballExpanded] = useState(false);
  // "Ver más" inline para la tabla defensiva (mismo comportamiento).
  const [fieldingExpanded, setFieldingExpanded] = useState(false);
  // Diálogo para elegir top N al descargar PDF sin filtro de equipo.
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfTopN, setPdfTopN] = useState<string>("10");

  const isBaseball = getSportCategory(tournament.sport) === "baseball";
  const showBaseballTable = isBaseball && baseballPlayerStats.length > 0;
  const showFieldingTable = isBaseball && baseballFieldingStats.length > 0;
  const hasFilter = selectedTeamId !== "all";

  // Opciones del dropdown de equipo: todos los del torneo, ordenados
  // alfabéticamente para que el organizador no tenga que cazarlos.
  const teamOptions = useMemo(() => {
    return tournament.teamIds
      .map((id) => ({ id, name: getTeamById(id)?.name || id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tournament.teamIds, getTeamById]);

  // Determine if cards/ejections are enabled
  const hasCardStats =
    tournament.enabledStats?.includes("yellow_card") ||
    tournament.enabledStats?.includes("red_card") ||
    tournament.enabledStats?.includes("ejection") ||
    tournament.enabledStats?.includes("blue_card");

  // Filter cards based on view: creator sees all, public sees only unpaid
  const visibleCardsAll: CardEntry[] = canEdit
    ? cardEntries
    : cardEntries.filter((c) => !c.paid);
  // El filtro de equipo también aplica a sanciones — si el organizer
  // está mirando un equipo específico, le sirve ver solo sus tarjetas.
  const visibleCards = hasFilter
    ? visibleCardsAll.filter((c) => c.teamId === selectedTeamId)
    : visibleCardsAll;

  // Non-card leaderboards (exclude yellow_card, red_card, ejection)
  const nonCardLeaderboards = leaderboards.filter(
    (lb) => lb.statKey !== "yellow_card" && lb.statKey !== "red_card" && lb.statKey !== "ejection" && lb.statKey !== "blue_card"
  );

  // Aplicar el filtro de equipo a cada leaderboard. Filtramos las
  // entradas de jugador por teamId, y para los "computed" (team-level
  // stats como Goals Against) filtramos las teamLeaders por id directo.
  const filteredLeaderboards = useMemo(() => {
    const base = hasFilter
      ? nonCardLeaderboards.map((lb) => ({
          ...lb,
          leaders: lb.leaders.filter((l) => l.teamId === selectedTeamId),
          teamLeaders: lb.teamLeaders.filter((t) => t.teamId === selectedTeamId),
        }))
      : nonCardLeaderboards;
    // Aplicar el orden de béisbol para que las cards sigan la secuencia
    // que el organizador espera (sencillos → ... → AB). Para otros
    // deportes mantenemos el orden original que viene del catálogo.
    if (!isBaseball) return base;
    return [...base].sort((a, b) => {
      const aIdx = BASEBALL_LEADERBOARD_ORDER.indexOf(a.statKey);
      const bIdx = BASEBALL_LEADERBOARD_ORDER.indexOf(b.statKey);
      const aOrder = aIdx === -1 ? BASEBALL_LEADERBOARD_ORDER.length : aIdx;
      const bOrder = bIdx === -1 ? BASEBALL_LEADERBOARD_ORDER.length : bIdx;
      return aOrder - bOrder;
    });
  }, [nonCardLeaderboards, selectedTeamId, hasFilter, isBaseball]);

  const hasNonCardStats = filteredLeaderboards.some(
    (lb) => lb.leaders.length > 0 || lb.teamLeaders.length > 0
  );

  // Tabla general: solo jugadores calificados (umbral MLB por partidos),
  // ya ordenados por AVG (desempate por OPS) desde el hook. Al filtrar por equipo NO se
  // aplica el filtro de calificación (se muestran todos, marcando los no
  // calificados).
  const generalQualifiedPlayers = useMemo(
    () => baseballPlayerStats.filter((p) => p.qualified),
    [baseballPlayerStats]
  );
  // Tabla individual de béisbol filtrada + paginada:
  // - con filtro: todos los jugadores del equipo, sin slice ni filtro de calificación.
  // - sin filtro: top 5 inicial (o top 20 si baseballExpanded), solo calificados.
  const filteredBaseballPlayers = useMemo(() => {
    if (hasFilter) {
      return baseballPlayerStats.filter((p) => p.teamId === selectedTeamId);
    }
    return generalQualifiedPlayers.slice(
      0,
      baseballExpanded ? TOP_BASEBALL_EXPANDED : TOP_PREVIEW
    );
  }, [baseballPlayerStats, generalQualifiedPlayers, hasFilter, selectedTeamId, baseballExpanded]);
  const hasMoreBaseball =
    !hasFilter && generalQualifiedPlayers.length > TOP_PREVIEW;

  // Fildeo (Líderes Defensiva): mismo patrón que bateo, pero con calificación
  // por juegos participados y orden por FLD% (desde el hook).
  const generalQualifiedFielders = useMemo(
    () => baseballFieldingStats.filter((f) => f.qualified),
    [baseballFieldingStats]
  );
  const filteredFielders = useMemo(() => {
    if (hasFilter) {
      return baseballFieldingStats.filter((f) => f.teamId === selectedTeamId);
    }
    return generalQualifiedFielders.slice(
      0,
      fieldingExpanded ? TOP_BASEBALL_EXPANDED : TOP_PREVIEW
    );
  }, [baseballFieldingStats, generalQualifiedFielders, hasFilter, selectedTeamId, fieldingExpanded]);
  const hasMoreFielding =
    !hasFilter && generalQualifiedFielders.length > TOP_PREVIEW;

  if (!hasStats && visibleCardsAll.length === 0 && !showBaseballTable && !showFieldingTable) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            No hay estadisticas registradas aun.
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            Agrega eventos al ingresar resultados de partidos.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleTogglePaid = (card: CardEntry) => {
    updateEventPaid(tournament.id, card.matchId, card.eventId, !card.paid);
  };

  // Genera y descarga el PDF. Con filtro de equipo se baja directo (todas
  // las stats del equipo); sin filtro abre el mini-diálogo para que el
  // organizador elija cuántos top jugadores incluir por estadística.
  const handleDownloadPdfClick = () => {
    if (hasFilter) {
      generatePdf(0);
    } else {
      setPdfDialogOpen(true);
    }
  };

  const generatePdf = async (topN: number) => {
    const teamsMap = new Map(
      tournament.teamIds
        .map((id) => [id, getTeamById(id)])
        .filter(([, t]) => !!t) as [string, NonNullable<ReturnType<typeof getTeamById>>][]
    );
    setPdfDialogOpen(false);
    // downloadStatsPdf es async porque hace dynamic import de jspdf.
    // No bloqueamos la UI: el await es solo para errores; la descarga
    // dispara sola cuando termina.
    await downloadStatsPdf(
      tournament,
      { leaderboards, cardEntries, baseballPlayerStats, baseballFieldingStats },
      teamsMap,
      {
        filterTeamId: hasFilter ? selectedTeamId : null,
        topN,
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Filtro de equipo + botón de descarga PDF (organizer only).
          Aplica a sanciones + cards + tabla béisbol. El botón PDF
          respeta el filtro: con filtro descarga directo todas las
          stats del equipo; sin filtro abre un diálogo para elegir
          cuántos top por estadística incluir. */}
      {teamOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={selectedTeamId} onValueChange={(v) => {
            setSelectedTeamId(v);
            // Resetear los toggles inline cuando se cambia el filtro —
            // así al volver a "Todos" arrancamos en preview otra vez.
            setBaseballExpanded(false);
            setFieldingExpanded(false);
          }}>
            <SelectTrigger className="h-9 w-full sm:w-64">
              <SelectValue placeholder="Filtrar por equipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los equipos</SelectItem>
              {teamOptions.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdfClick}
              className="h-9 ml-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar PDF
            </Button>
          )}
        </div>
      )}

      {/* Card payment table */}
      {hasCardStats && visibleCards.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sanciones</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Jugador</TableHead>
                  <TableHead className="whitespace-nowrap">Equipo</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Tipo</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleCards.map((card) => {
                  const team = getTeamById(card.teamId);
                  const badgeClass =
                    card.type === "yellow_card"
                      ? "bg-yellow-400/20 text-yellow-600 border-yellow-400/30"
                      : card.type === "red_card"
                      ? "bg-red-500/20 text-red-600 border-red-500/30"
                      : card.type === "blue_card"
                      ? "bg-blue-400/20 text-blue-600 border-blue-400/30"
                      : "bg-red-700/20 text-red-700 border-red-700/30";
                  const badgeLabel =
                    card.type === "yellow_card"
                      ? "Amarilla"
                      : card.type === "red_card"
                      ? "Roja"
                      : card.type === "blue_card"
                      ? "Azul"
                      : "Expulsion";
                  return (
                    <TableRow
                      key={card.eventId}
                      className={card.paid ? "opacity-50" : ""}
                    >
                      <TableCell className="font-medium whitespace-nowrap">
                        {/* Mobile: nombre corto (primer nombre + primer
                            apellido). Desktop: nombre completo. */}
                        <span className="sm:hidden">{getShortName(card.playerName)}</span>
                        <span className="hidden sm:inline">{card.playerName}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {team?.name || card.teamId}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={badgeClass}>
                          {badgeLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => handleTogglePaid(card)}
                            className="cursor-pointer"
                          >
                            <Badge
                              className={
                                card.paid
                                  ? "bg-green-500/20 text-green-600 border-green-500/30"
                                  : "bg-orange-500/20 text-orange-600 border-orange-500/30"
                              }
                            >
                              {card.paid ? "Pagado" : "Sin Pagar"}
                            </Badge>
                          </button>
                        ) : (
                          <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30">
                            Sin Pagar
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* "Todas las sanciones están pagadas" es info para el organizador.
          El público solo debe ver la tabla de Sanciones cuando hay
          expulsiones activas (sin pagar); si no hay, no se le muestra nada. */}
      {canEdit && hasCardStats && visibleCards.length === 0 && cardEntries.length > 0 && !hasFilter && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sanciones</CardTitle>
          </CardHeader>
          <CardContent className="py-4 text-center">
            <p className="text-sm text-muted-foreground">
              Todas las sanciones estan pagadas.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Baseball / softball / wiffleball: per-player AVG / OBP / SLG / OPS */}
      {showBaseballTable && filteredBaseballPlayers.length > 0 && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Líderes de Bateo</CardTitle>
            {hasMoreBaseball && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setBaseballExpanded((v) => !v)}
              >
                {baseballExpanded ? "Ver menos" : "Ver más"}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {filteredBaseballPlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {hasFilter
                  ? "Este equipo aún no tiene estadísticas de bateo."
                  : "Aún no hay bateadores que califiquen al ranking (turnos insuficientes según los partidos jugados)."}
              </p>
            ) : (
            <div className="relative">
            <TableWatermark />
            <ScrollArea className="w-full relative z-10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Jugador</TableHead>
                    <TableHead>Equipo</TableHead>
                    <TableHead className="text-center w-12">AB</TableHead>
                    <TableHead className="text-center w-12">H</TableHead>
                    <TableHead className="text-center w-12">2B</TableHead>
                    <TableHead className="text-center w-12">3B</TableHead>
                    <TableHead className="text-center w-12">HR</TableHead>
                    <TableHead className="text-center w-12">BB</TableHead>
                    <TableHead className="text-center w-12">K</TableHead>
                    <TableHead className="text-center w-12">RBI</TableHead>
                    <TableHead className="text-center w-12">R</TableHead>
                    <TableHead className="text-center w-12">PA</TableHead>
                    <TableHead className="text-center w-14">AVG</TableHead>
                    <TableHead className="text-center w-14">OBP</TableHead>
                    <TableHead className="text-center w-14">SLG</TableHead>
                    <TableHead className="text-center w-14 font-bold">OPS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBaseballPlayers.map((p, index) => {
                    const team = getTeamById(p.teamId);
                    // Los calificados van primero (orden del hook), así que su
                    // índice ya es su ranking. Los no calificados (solo visibles
                    // al filtrar por equipo) van al final: sin número, atenuados
                    // y con "*".
                    return (
                      <TableRow
                        key={`${p.playerName}-${p.teamId}`}
                        className={p.qualified ? "" : "opacity-55"}
                      >
                        <TableCell className="font-medium">
                          {p.qualified ? index + 1 : "–"}
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          <span className="sm:hidden">{getShortName(p.playerName)}</span>
                          <span className="hidden sm:inline">{p.playerName}</span>
                          {!p.qualified && (
                            <span className="text-muted-foreground" title="No califica al ranking (turnos insuficientes)"> *</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {team?.name || p.teamId}
                        </TableCell>
                        <TableCell className="text-center">{p.ab}</TableCell>
                        {/* H = total de hits (convención MLB). */}
                        <TableCell className="text-center">{p.h}</TableCell>
                        <TableCell className="text-center">{p.doubles}</TableCell>
                        <TableCell className="text-center">{p.triples}</TableCell>
                        <TableCell className="text-center">{p.hr}</TableCell>
                        <TableCell className="text-center">{p.bb}</TableCell>
                        <TableCell className="text-center">{p.k}</TableCell>
                        <TableCell className="text-center">{p.rbi}</TableCell>
                        <TableCell className="text-center">{p.r}</TableCell>
                        <TableCell className="text-center">{p.pa}</TableCell>
                        <TableCell className="text-center">{fmt(p.avg)}</TableCell>
                        <TableCell className="text-center">{fmt(p.obp)}</TableCell>
                        <TableCell className="text-center">{fmt(p.slg)}</TableCell>
                        <TableCell className="text-center font-bold">{fmt(p.ops)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            {filteredBaseballPlayers.some((p) => !p.qualified) && (
              <p className="text-xs text-muted-foreground mt-2 relative z-10">
                * No califica al ranking todavía: le faltan turnos al bate
                según los partidos jugados por su equipo.
              </p>
            )}
            </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Líderes Defensiva: fildeo por jugador (PO / A / E / Lances / FLD%),
          ordenado por % de fildeo entre calificados (participación por juegos). */}
      {showFieldingTable && filteredFielders.length > 0 && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Líderes Defensiva</CardTitle>
            {hasMoreFielding && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setFieldingExpanded((v) => !v)}
              >
                {fieldingExpanded ? "Ver menos" : "Ver más"}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="relative">
            <TableWatermark />
            <ScrollArea className="w-full relative z-10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Jugador</TableHead>
                    <TableHead>Equipo</TableHead>
                    <TableHead className="text-center w-12" title="Outs (putouts)">PO</TableHead>
                    <TableHead className="text-center w-12" title="Asistencias">A</TableHead>
                    <TableHead className="text-center w-12" title="Errores">E</TableHead>
                    <TableHead className="text-center w-16" title="Lances totales (PO + A + E)">Lances</TableHead>
                    <TableHead className="text-center w-16 font-bold" title="% de fildeo">FLD%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFielders.map((f, index) => {
                    const team = getTeamById(f.teamId);
                    return (
                      <TableRow
                        key={`${f.playerName}-${f.teamId}`}
                        className={f.qualified ? "" : "opacity-55"}
                      >
                        <TableCell className="font-medium">
                          {f.qualified ? index + 1 : "–"}
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          <span className="sm:hidden">{getShortName(f.playerName)}</span>
                          <span className="hidden sm:inline">{f.playerName}</span>
                          {!f.qualified && (
                            <span className="text-muted-foreground" title="No califica al ranking (pocos juegos)"> *</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {team?.name || f.teamId}
                        </TableCell>
                        <TableCell className="text-center">{f.po}</TableCell>
                        <TableCell className="text-center">{f.a}</TableCell>
                        <TableCell className="text-center">{f.e}</TableCell>
                        <TableCell className="text-center">{f.tc}</TableCell>
                        <TableCell className="text-center font-bold">{fmt(f.fld)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            {filteredFielders.some((f) => !f.qualified) && (
              <p className="text-xs text-muted-foreground mt-2 relative z-10">
                * No califica al ranking defensivo todavía: participó en pocos
                juegos respecto a los que jugó su equipo.
              </p>
            )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Non-card leaderboards.
          - Sin filtro: top 5 inline + "Ver más" → modal con top 10.
          - Con filtro: TODOS los entries del equipo inline, sin "Ver más".
          `min-w-0` en el grid es clave: sin él, los items del grid se
          expanden al ancho del contenido natural de la tabla (que tiene
          whitespace-nowrap), rompiendo el viewport mobile. Con min-w-0
          el item respeta el viewport y el overflow-x-auto interno del
          <Table> de shadcn produce scroll horizontal dentro de la card. */}
      {hasNonCardStats && (
        <div className="grid gap-6 md:grid-cols-2 [&>*]:min-w-0">
          {filteredLeaderboards.map((lb) => {
            if (lb.computed) {
              if (lb.teamLeaders.length === 0) return null;
              const rows = hasFilter
                ? lb.teamLeaders
                : lb.teamLeaders.slice(0, TOP_PREVIEW);
              const canExpand = !hasFilter && lb.teamLeaders.length > TOP_PREVIEW;
              return (
                <Card key={lb.statKey}>
                  <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">{lb.pluralLabel}</CardTitle>
                    {canExpand && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setExpandedKey(lb.statKey)}
                      >
                        Ver más
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                    <TableWatermark />
                    <div className="relative z-10">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Equipo</TableHead>
                          <TableHead className="text-center w-12">PJ</TableHead>
                          <TableHead className="text-center w-12">
                            {/* Mobile: abreviado (BB / R / AB). Desktop:
                                etiqueta completa del catálogo. */}
                            <span className="sm:hidden">{shortHeader(lb.statKey, lb.label)}</span>
                            <span className="hidden sm:inline">{lb.label}</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((entry, index) => {
                          const team = getTeamById(entry.teamId);
                          return (
                            <TableRow key={entry.teamId}>
                              <TableCell className="font-medium">
                                {index + 1}
                              </TableCell>
                              <TableCell className="font-medium whitespace-nowrap">
                                {team?.name || entry.teamId}
                              </TableCell>
                              <TableCell className="text-center">
                                {entry.matchesPlayed}
                              </TableCell>
                              <TableCell className="text-center font-bold">
                                {entry.value}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            if (lb.leaders.length === 0) return null;
            const rows = hasFilter ? lb.leaders : lb.leaders.slice(0, TOP_PREVIEW);
            const canExpand = !hasFilter && lb.leaders.length > TOP_PREVIEW;
            return (
              <Card key={lb.statKey}>
                <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">{lb.pluralLabel}</CardTitle>
                  {canExpand && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setExpandedKey(lb.statKey)}
                    >
                      Ver más
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="relative">
                  <TableWatermark />
                  <div className="relative z-10">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Jugador</TableHead>
                        <TableHead>Equipo</TableHead>
                        <TableHead className="text-center w-14">
                          <span className="sm:hidden">{shortHeader(lb.statKey, lb.label)}</span>
                          <span className="hidden sm:inline">{lb.label}</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((entry, index) => {
                        const team = getTeamById(entry.teamId);
                        return (
                          <TableRow
                            key={`${entry.playerName}-${entry.teamId}`}
                          >
                            <TableCell className="font-medium">
                              {index + 1}
                            </TableCell>
                            <TableCell className="font-medium whitespace-nowrap">
                              <span className="sm:hidden">{getShortName(entry.playerName)}</span>
                              <span className="hidden sm:inline">{entry.playerName}</span>
                            </TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {team?.name || entry.teamId}
                            </TableCell>
                            <TableCell className="text-center font-bold">
                              {entry.count}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Top N modal (one shared modal; content depends on which leaderboard
          was clicked via "Ver más"). Solo se usa cuando NO hay filtro de
          equipo activo — con filtro mostramos todos inline. */}
      <Dialog
        open={expandedKey !== null}
        onOpenChange={(o) => !o && setExpandedKey(null)}
      >
        <DialogContent className="max-w-xl">
          {(() => {
            const lb = filteredLeaderboards.find((l) => l.statKey === expandedKey);
            if (!lb) return null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{lb.pluralLabel}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh]">
                  {lb.computed ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Equipo</TableHead>
                          <TableHead className="text-center w-12">PJ</TableHead>
                          <TableHead className="text-center w-12">
                            {/* Mobile: abreviado (BB / R / AB). Desktop:
                                etiqueta completa del catálogo. */}
                            <span className="sm:hidden">{shortHeader(lb.statKey, lb.label)}</span>
                            <span className="hidden sm:inline">{lb.label}</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lb.teamLeaders.slice(0, TOP_MODAL).map((entry, index) => {
                          const team = getTeamById(entry.teamId);
                          return (
                            <TableRow key={entry.teamId}>
                              <TableCell className="font-medium">
                                {index + 1}
                              </TableCell>
                              <TableCell className="font-medium">
                                {team?.name || entry.teamId}
                              </TableCell>
                              <TableCell className="text-center">
                                {entry.matchesPlayed}
                              </TableCell>
                              <TableCell className="text-center font-bold">
                                {entry.value}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Jugador</TableHead>
                          <TableHead>Equipo</TableHead>
                          <TableHead className="text-center w-14">
                            {lb.label}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lb.leaders.slice(0, TOP_MODAL).map((entry, index) => {
                          const team = getTeamById(entry.teamId);
                          return (
                            <TableRow key={`${entry.playerName}-${entry.teamId}`}>
                              <TableCell className="font-medium">
                                {index + 1}
                              </TableCell>
                              <TableCell className="font-medium whitespace-nowrap">
                                <span className="sm:hidden">{getShortName(entry.playerName)}</span>
                                <span className="hidden sm:inline">{entry.playerName}</span>
                              </TableCell>
                              <TableCell className="text-muted-foreground whitespace-nowrap">
                                {team?.name || entry.teamId}
                              </TableCell>
                              <TableCell className="text-center font-bold">
                                {entry.count}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Diálogo para elegir top N al descargar PDF sin filtro. Si hay
          filtro de equipo este diálogo no se abre — la descarga es
          directa con todas las stats del equipo. */}
      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Descargar PDF de estadísticas</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              ¿Cuántos jugadores/equipos por estadística querés incluir?
            </p>
            <Select value={pdfTopN} onValueChange={setPdfTopN}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">Top 5</SelectItem>
                <SelectItem value="10">Top 10</SelectItem>
                <SelectItem value="20">Top 20</SelectItem>
                <SelectItem value="9999">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setPdfDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => generatePdf(parseInt(pdfTopN, 10) || 10)}>
              <Download className="h-4 w-4 mr-2" />
              Descargar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
