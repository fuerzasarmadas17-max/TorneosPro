"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Match, Tournament, Team } from "@/types";
import { useTournaments } from "@/context/tournament-context";
import { TeamMark } from "@/components/teams/team-mark";
import { cn } from "@/lib/utils";

interface BracketMatchProps {
  match: Match;
  vueltaMatch?: Match;
  canEdit: boolean;
  tournament?: Tournament;
  /** Tennis-style final series. When set, the card renders both finalists
   *  with the per-game scores as columns (like tennis sets). */
  seriesMatches?: Match[];
  /** Wins to clinch the series (1 for single/double-leg, 3 for best-of-5,
   *  4 for best-of-7). */
  seriesTarget?: number;
  /** Drives the summary header label and the win-counting rule. */
  seriesFormat?: Tournament["playoffFinalFormat"];
}

export function BracketMatch({ match, vueltaMatch, canEdit, tournament, seriesMatches, seriesTarget, seriesFormat }: BracketMatchProps) {
  void seriesTarget; // currently informational; rule comes from format
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

  // Tennis-style final series render. One card with two team rows on the
  // left and per-game scores as columns on the right — works uniformly for
  // single / double_leg / best_of_5 / best_of_7. For double_leg the games
  // have swapped sides, so we map each score to a "canonical home/away"
  // anchored on the first game so the team rows stay coherent.
  if (seriesMatches && seriesMatches.length > 0) {
    const canonicalHomeId = match.homeTeamId;
    const canonicalAwayId = match.awayTeamId;

    type LegScores = { homeScore: number | null; awayScore: number | null };
    const legScores = (g: Match): LegScores => {
      // Identify which side of the game corresponds to canonical home/away.
      // If the game's home matches canonical home: same orientation.
      // If the game's home matches canonical away: sides are swapped (vuelta).
      if (g.homeTeamId === canonicalHomeId) {
        return { homeScore: g.homeScore, awayScore: g.awayScore };
      }
      if (g.awayTeamId === canonicalHomeId) {
        return { homeScore: g.awayScore, awayScore: g.homeScore };
      }
      // Teams don't line up — bail out with the raw scores so the card
      // still renders something useful.
      return { homeScore: g.homeScore, awayScore: g.awayScore };
    };

    let homeWins = 0;
    let awayWins = 0;
    let homeAggregate = 0;
    let awayAggregate = 0;
    for (const g of seriesMatches) {
      const { homeScore: hs, awayScore: as_ } = legScores(g);
      if (hs != null) homeAggregate += hs;
      if (as_ != null) awayAggregate += as_;
      if (g.status !== "completed" || !g.winnerId) continue;
      if (g.winnerId === canonicalHomeId) homeWins++;
      else if (g.winnerId === canonicalAwayId) awayWins++;
    }

    // Format-specific winner detection: best-of-N counts wins to a target;
    // double_leg uses aggregate; single uses the only game's winnerId.
    let seriesWinnerId: string | null = null;
    if (seriesFormat === "best_of_5" || seriesFormat === "best_of_7") {
      const target = seriesFormat === "best_of_5" ? 3 : 4;
      if (homeWins >= target) seriesWinnerId = canonicalHomeId;
      else if (awayWins >= target) seriesWinnerId = canonicalAwayId;
    } else if (seriesFormat === "double_leg") {
      const bothComplete = seriesMatches.every((g) => g.status === "completed");
      if (bothComplete) {
        if (homeAggregate > awayAggregate) seriesWinnerId = canonicalHomeId;
        else if (awayAggregate > homeAggregate) seriesWinnerId = canonicalAwayId;
      }
    } else {
      // single
      const only = seriesMatches[0];
      if (only?.status === "completed" && only.winnerId) {
        seriesWinnerId = only.winnerId;
      }
    }

    const headerLeft =
      seriesFormat === "best_of_5"
        ? "Final · Mejor de 5"
        : seriesFormat === "best_of_7"
          ? "Final · Mejor de 7"
          : seriesFormat === "double_leg"
            ? "Final · Ida y Vuelta"
            : "Final · Partido único";
    const headerRight =
      seriesFormat === "best_of_5" || seriesFormat === "best_of_7"
        ? `Serie ${homeWins}–${awayWins}`
        : seriesFormat === "double_leg"
          ? `Global ${homeAggregate}–${awayAggregate}`
          : null;

    // Width grows with the number of games so all columns fit without
    // squashing the team names.
    const cardWidth = 220 + Math.max(0, seriesMatches.length - 3) * 28;

    return (
      <Card
        className={cn(
          "overflow-hidden text-sm",
          seriesWinnerId && "border-muted"
        )}
        style={{ width: cardWidth }}
      >
        <div className="flex items-center justify-between px-3 py-1 bg-muted/50 text-[10px] text-muted-foreground font-medium">
          <span>{headerLeft}</span>
          {headerRight && (
            <span className="tabular-nums">{headerRight}</span>
          )}
        </div>
        <div className="grid grid-cols-[1fr_auto] divide-y">
          {/* Home row */}
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5",
              seriesWinnerId === canonicalHomeId && "bg-primary/5 font-semibold"
            )}
          >
            <TeamMark team={homeTeam} size={16} />
            <span className="truncate">{homeTeam?.name || "TBD"}</span>
          </div>
          <div
            className={cn(
              "flex divide-x border-l text-xs",
              seriesWinnerId === canonicalHomeId && "bg-primary/5 font-semibold"
            )}
          >
            {seriesMatches.map((g) => {
              const { homeScore } = legScores(g);
              return (
                <span
                  key={`h-${g.id}`}
                  className="w-7 px-1 py-1.5 tabular-nums text-center"
                >
                  {g.status === "completed" && homeScore != null
                    ? homeScore
                    : "–"}
                </span>
              );
            })}
          </div>
          {/* Away row */}
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5",
              seriesWinnerId === canonicalAwayId && "bg-primary/5 font-semibold"
            )}
          >
            <TeamMark team={awayTeam} size={16} />
            <span className="truncate">{awayTeam?.name || "TBD"}</span>
          </div>
          <div
            className={cn(
              "flex divide-x border-l text-xs",
              seriesWinnerId === canonicalAwayId && "bg-primary/5 font-semibold"
            )}
          >
            {seriesMatches.map((g) => {
              const { awayScore } = legScores(g);
              return (
                <span
                  key={`a-${g.id}`}
                  className="w-7 px-1 py-1.5 tabular-nums text-center"
                >
                  {g.status === "completed" && awayScore != null
                    ? awayScore
                    : "–"}
                </span>
              );
            })}
          </div>
        </div>
        {/* Game labels footer — Ida / Vuelta for double_leg, G1..GN otherwise. */}
        <div className="grid grid-cols-[1fr_auto] border-t bg-muted/20">
          <div className="px-3 py-1 text-[10px] text-muted-foreground" />
          <div className="flex divide-x border-l text-[10px] text-muted-foreground">
            {seriesMatches.map((_, i) => {
              const label =
                seriesFormat === "double_leg"
                  ? i === 0
                    ? "Ida"
                    : "Vta"
                  : seriesMatches.length === 1
                    ? "Final"
                    : `G${i + 1}`;
              return (
                <span key={`l-${i}`} className="w-7 px-1 py-1 text-center">
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      </Card>
    );
  }

  // Bye check sits ABOVE the double-leg render so a bye matchup shows the
  // "PASE DIRECTO" card even when the bracket is ida y vuelta. In double-leg
  // the ida is passed as `match` and the vuelta as `vueltaMatch`; for byes
  // both have the one-team-set/one-null pattern but we only need to render
  // the bye card once based on the ida.
  const isByeIdaMatch =
    match.round === 1 &&
    ((!!match.homeTeamId && !match.awayTeamId) ||
      (!match.homeTeamId && !!match.awayTeamId));
  if (isByeIdaMatch) {
    const advancingTeam = match.homeTeamId ? homeTeam : awayTeam;
    return (
      <Card className="w-[200px] overflow-hidden text-sm border-dashed border-amber-500/40 bg-amber-500/[0.03]">
        <div className="bg-amber-500/10 px-3 py-1 text-[10px] uppercase text-amber-700 font-semibold tracking-wide flex items-center justify-between">
          <span>Pase directo</span>
          <span>Bye</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2 font-medium">
          <span className="flex items-center gap-2 truncate mr-2">
            <TeamMark team={advancingTeam} size={16} />
            <span className="truncate">{advancingTeam?.name || "TBD"}</span>
          </span>
        </div>
        <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t">
          Avanza directo a la siguiente ronda
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

  // (Bye render moved above the double-leg branch so it fires uniformly.)

  // Single-leg rendering (original)
  const renderSlot = (
    team: Team | null,
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
        <span className="flex items-center gap-2 truncate mr-2">
          <TeamMark team={team} size={16} />
          <span className="truncate">{team?.name || "TBD"}</span>
        </span>
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
