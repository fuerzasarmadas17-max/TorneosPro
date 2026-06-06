"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Match, Tournament } from "@/types";
import { useTournaments } from "@/context/tournament-context";
import { cn } from "@/lib/utils";

interface BracketMatchProps {
  match: Match;
  vueltaMatch?: Match;
  canEdit: boolean;
  tournament?: Tournament;
  /** Pieza I: when set, the card renders the whole best-of-N series with
   *  a game-by-game line and a running series score. */
  seriesMatches?: Match[];
  /** Wins to clinch the series (3 for best-of-5, 4 for best-of-7). */
  seriesTarget?: number;
}

export function BracketMatch({ match, vueltaMatch, canEdit, tournament, seriesMatches, seriesTarget }: BracketMatchProps) {
  const { getTeamById, updateMatchDetails } = useTournaments();

  const homeTeam = match.homeTeamId ? getTeamById(match.homeTeamId) ?? null : null;
  const awayTeam = match.awayTeamId ? getTeamById(match.awayTeamId) ?? null : null;

  // For first-round matches with empty slots, show team selector
  const needsAssignment = canEdit && (match.status === "scheduled" || match.status === "unscheduled") && tournament &&
    (!match.homeTeamId || !match.awayTeamId) && match.round === 1;

  // Get already assigned teams in this round to exclude
  const assignedInBracket = new Set<string>();
  if (tournament) {
    for (const m of tournament.matches) {
      if (m.phase === match.phase || (!m.phase && !match.phase)) {
        if (m.homeTeamId) assignedInBracket.add(m.homeTeamId);
        if (m.awayTeamId) assignedInBracket.add(m.awayTeamId);
      }
    }
  }

  const availableTeams = tournament
    ? tournament.teamIds.filter((id) => {
        if (assignedInBracket.has(id)) return false;
        if (id === match.homeTeamId || id === match.awayTeamId) return true;
        return true;
      })
    : [];

  const handleTeamSelect = (slot: "home" | "away", teamId: string) => {
    if (!tournament) return;
    if (slot === "home") {
      updateMatchDetails(tournament.id, match.id, { homeTeamId: teamId });
    } else {
      updateMatchDetails(tournament.id, match.id, { awayTeamId: teamId });
    }
  };

  // Pieza I: best-of-N series render. View-only card. Two team rows on the
  // left with their game-by-game scores laid out as columns to the right —
  // one column per game — so the whole series reads horizontally instead of
  // stacking five rows.
  if (seriesMatches && seriesMatches.length > 0) {
    const homeTeamId = match.homeTeamId;
    const awayTeamId = match.awayTeamId;
    let homeWins = 0;
    let awayWins = 0;
    for (const g of seriesMatches) {
      if (g.status !== "completed" || !g.winnerId) continue;
      if (g.winnerId === homeTeamId) homeWins++;
      else if (g.winnerId === awayTeamId) awayWins++;
    }
    const seriesOver =
      seriesTarget != null &&
      (homeWins >= seriesTarget || awayWins >= seriesTarget);
    const seriesWinnerId = seriesOver
      ? homeWins > awayWins
        ? homeTeamId
        : awayTeamId
      : null;

    // Width grows with the number of games so all columns fit without
    // squashing the team names.
    const cardWidth = 220 + Math.max(0, seriesMatches.length - 3) * 28;

    return (
      <Card
        className={cn(
          "overflow-hidden text-sm",
          seriesOver && "border-muted"
        )}
        style={{ width: cardWidth }}
      >
        <div className="flex items-center justify-between px-3 py-1 bg-muted/50 text-[10px] text-muted-foreground font-medium">
          <span>Serie · {seriesMatches.length} juegos</span>
          <span className="tabular-nums">
            {homeWins} – {awayWins}
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto] divide-y">
          {/* Home row */}
          <div
            className={cn(
              "flex items-center px-3 py-1.5 truncate",
              seriesWinnerId === homeTeamId && "bg-primary/5 font-semibold"
            )}
          >
            {homeTeam?.name || "TBD"}
          </div>
          <div
            className={cn(
              "flex divide-x border-l text-xs",
              seriesWinnerId === homeTeamId && "bg-primary/5 font-semibold"
            )}
          >
            {seriesMatches.map((g) => (
              <span
                key={`h-${g.id}`}
                className="w-7 px-1 py-1.5 tabular-nums text-center"
              >
                {g.status === "completed" && g.homeScore != null
                  ? g.homeScore
                  : "–"}
              </span>
            ))}
          </div>
          {/* Away row */}
          <div
            className={cn(
              "flex items-center px-3 py-1.5 truncate",
              seriesWinnerId === awayTeamId && "bg-primary/5 font-semibold"
            )}
          >
            {awayTeam?.name || "TBD"}
          </div>
          <div
            className={cn(
              "flex divide-x border-l text-xs",
              seriesWinnerId === awayTeamId && "bg-primary/5 font-semibold"
            )}
          >
            {seriesMatches.map((g) => (
              <span
                key={`a-${g.id}`}
                className="w-7 px-1 py-1.5 tabular-nums text-center"
              >
                {g.status === "completed" && g.awayScore != null
                  ? g.awayScore
                  : "–"}
              </span>
            ))}
          </div>
        </div>
        {/* Game labels footer for orientation */}
        <div className="grid grid-cols-[1fr_auto] border-t bg-muted/20">
          <div className="px-3 py-1 text-[10px] text-muted-foreground" />
          <div className="flex divide-x border-l text-[10px] text-muted-foreground">
            {seriesMatches.map((_, i) => (
              <span key={`l-${i}`} className="w-7 px-1 py-1 text-center">
                G{i + 1}
              </span>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  // Double-leg: show both ida and vuelta scores
  if (vueltaMatch) {
    const idaHomeScore = match.homeScore;
    const idaAwayScore = match.awayScore;
    const vltHomeScore = vueltaMatch.homeScore;
    const vltAwayScore = vueltaMatch.awayScore;

    // In vuelta, home/away are swapped. So vuelta.home = match.away, vuelta.away = match.home
    // For aggregate: homeTeam total = ida home + vuelta away, awayTeam total = ida away + vuelta home
    const bothCompleted = match.status === "completed" && vueltaMatch.status === "completed";
    const winner = vueltaMatch.winnerId;

    // Determine which match to link to (the one that needs a result)
    const linkMatch = match.status !== "completed" ? match : vueltaMatch;
    const canLink = canEdit && (linkMatch.status === "scheduled" || linkMatch.status === "unscheduled") && linkMatch.homeTeamId && linkMatch.awayTeamId;

    const content = (
      <Card className={cn(
        "w-[220px] overflow-hidden text-sm",
        bothCompleted && "border-muted",
        canLink && "hover:border-primary cursor-pointer"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1 bg-muted/50 text-[10px] text-muted-foreground font-medium">
          <span className="truncate">Ida / Vta</span>
          {bothCompleted && <span className="text-[10px]">Global</span>}
        </div>
        {/* Home team (ida perspective) */}
        <div className={cn(
          "flex items-center justify-between px-3 py-1.5 border-b",
          winner && winner === match.homeTeamId && "bg-primary/5 font-semibold"
        )}>
          <span className="truncate mr-2 flex-1">{homeTeam?.name || "TBD"}</span>
          <div className="flex items-center gap-1.5 tabular-nums text-xs">
            <span>{idaHomeScore !== null ? idaHomeScore : "-"}</span>
            <span className="text-muted-foreground">/</span>
            <span>{vltAwayScore !== null ? vltAwayScore : "-"}</span>
            {bothCompleted && idaHomeScore !== null && vltAwayScore !== null && (
              <span className="ml-1 font-bold text-xs">({idaHomeScore + vltAwayScore})</span>
            )}
          </div>
        </div>
        {/* Away team (ida perspective) */}
        <div className={cn(
          "flex items-center justify-between px-3 py-1.5",
          winner && winner === match.awayTeamId && "bg-primary/5 font-semibold"
        )}>
          <span className="truncate mr-2 flex-1">{awayTeam?.name || "TBD"}</span>
          <div className="flex items-center gap-1.5 tabular-nums text-xs">
            <span>{idaAwayScore !== null ? idaAwayScore : "-"}</span>
            <span className="text-muted-foreground">/</span>
            <span>{vltHomeScore !== null ? vltHomeScore : "-"}</span>
            {bothCompleted && idaAwayScore !== null && vltHomeScore !== null && (
              <span className="ml-1 font-bold text-xs">({idaAwayScore + vltHomeScore})</span>
            )}
          </div>
        </div>
      </Card>
    );

    if (canLink) {
      return (
        <Link href={`/tournaments/${linkMatch.tournamentId}/matches/${linkMatch.id}`}>
          {content}
        </Link>
      );
    }
    return content;
  }

  // Bye render: round-1 match with exactly one team set. The lone team
  // auto-advances to the next round (configureBracketSlots resolved it on
  // save). We render a dedicated card so both the organizer and public
  // viewers see who passed directly instead of seeing a "TBD" placeholder.
  const isByeMatch =
    match.round === 1 &&
    ((!!match.homeTeamId && !match.awayTeamId) ||
      (!match.homeTeamId && !!match.awayTeamId));
  if (isByeMatch) {
    const advancingTeam = match.homeTeamId ? homeTeam : awayTeam;
    return (
      <Card className="w-[200px] overflow-hidden text-sm border-dashed border-amber-500/40 bg-amber-500/[0.03]">
        <div className="bg-amber-500/10 px-3 py-1 text-[10px] uppercase text-amber-700 font-semibold tracking-wide flex items-center justify-between">
          <span>Pase directo</span>
          <span>Bye</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2 font-medium">
          <span className="truncate mr-2">{advancingTeam?.name || "TBD"}</span>
        </div>
        <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t">
          Avanza directo a la siguiente ronda
        </div>
      </Card>
    );
  }

  // Single-leg rendering (original)
  const renderSlot = (
    team: { name: string; primaryColor?: string; secondaryColor?: string } | null,
    teamId: string | null,
    slot: "home" | "away",
    isWinner: boolean,
    score: number | null
  ) => {
    if (needsAssignment && !teamId) {
      return (
        <div className={cn("flex items-center justify-between px-1.5 py-1.5", slot === "home" && "border-b")}>
          <select
            className="w-full h-6 text-xs bg-transparent border-none focus:outline-none cursor-pointer"
            value=""
            onChange={(e) => {
              if (e.target.value) handleTeamSelect(slot, e.target.value);
            }}
          >
            <option value="" disabled>Seleccionar</option>
            {availableTeams.map((id) => {
              const t = getTeamById(id);
              return <option key={id} value={id}>{t?.name || id}</option>;
            })}
          </select>
        </div>
      );
    }

    return (
      <div className={cn(
        "flex items-center justify-between px-3 py-2",
        slot === "home" && "border-b",
        isWinner && "bg-primary/5 font-semibold"
      )}>
        <span className="truncate mr-2">{team?.name || "TBD"}</span>
        <span className="tabular-nums">{score !== null ? score : "-"}</span>
      </div>
    );
  };

  const content = (
    <Card className={cn(
      "w-[200px] overflow-hidden text-sm",
      match.status === "completed" && "border-muted",
      canEdit && (match.status === "scheduled" || match.status === "unscheduled") && match.homeTeamId && match.awayTeamId && "hover:border-primary cursor-pointer"
    )}>
      {renderSlot(homeTeam, match.homeTeamId, "home", !!(match.winnerId && match.winnerId === match.homeTeamId), match.homeScore)}
      {renderSlot(awayTeam, match.awayTeamId, "away", !!(match.winnerId && match.winnerId === match.awayTeamId), match.awayScore)}
    </Card>
  );

  if (canEdit && (match.status === "scheduled" || match.status === "unscheduled") && match.homeTeamId && match.awayTeamId) {
    return (
      <Link href={`/tournaments/${match.tournamentId}/matches/${match.id}`}>
        {content}
      </Link>
    );
  }

  return content;
}
