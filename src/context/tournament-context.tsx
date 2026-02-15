"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { Tournament, Team, TournamentFilters, Match, MatchEvent, Player, VolleyballSet, Sponsor } from "@/types";
import { MOCK_TOURNAMENTS } from "@/data/tournaments";
import { MOCK_TEAMS } from "@/data/teams";
import { fillPlayoffBracket } from "@/data/helpers";

interface TournamentContextType {
  tournaments: Tournament[];
  teams: Team[];
  addTournament: (tournament: Tournament) => void;
  addTeams: (newTeams: Team[]) => void;
  setTournamentMatches: (tournamentId: string, matches: Match[]) => void;
  addMatchToTournament: (tournamentId: string, match: Match) => void;
  removeMatchFromTournament: (tournamentId: string, matchId: string) => void;
  updateMatchDetails: (tournamentId: string, matchId: string, updates: Partial<Pick<Match, "homeTeamId" | "awayTeamId" | "date" | "time" | "venue" | "status" | "postponedReason">>) => void;
  updateTournamentProps: (tournamentId: string, updates: Partial<Pick<Tournament, "doubleRoundRobin" | "groupStageComplete" | "sponsors">>) => void;
  updateMatch: (
    tournamentId: string,
    matchId: string,
    homeScore: number,
    awayScore: number,
    events?: MatchEvent[],
    sets?: VolleyballSet[]
  ) => void;
  updateTeamPlayers: (teamId: string, players: Player[]) => void;
  updateTeam: (teamId: string, updates: Partial<Pick<Team, "name" | "primaryColor" | "secondaryColor">>) => void;
  updateEventPaid: (tournamentId: string, matchId: string, eventId: string, paid: boolean) => void;
  getTournamentById: (id: string) => Tournament | undefined;
  getTeamById: (id: string) => Team | undefined;
  getFilteredTournaments: (filters: TournamentFilters) => Tournament[];
}

const TournamentContext = createContext<TournamentContextType | undefined>(
  undefined
);

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [tournaments, setTournaments] = useState<Tournament[]>([
    ...MOCK_TOURNAMENTS,
  ]);
  const [teams, setTeams] = useState<Team[]>([...MOCK_TEAMS]);

  const addTournament = useCallback((tournament: Tournament) => {
    setTournaments((prev) => [...prev, tournament]);
  }, []);

  const addTeams = useCallback((newTeams: Team[]) => {
    setTeams((prev) => [...prev, ...newTeams]);
  }, []);

  const setTournamentMatches = useCallback((tournamentId: string, matches: Match[]) => {
    setTournaments((prev) =>
      prev.map((t) => (t.id === tournamentId ? { ...t, matches } : t))
    );
  }, []);

  const addMatchToTournament = useCallback((tournamentId: string, match: Match) => {
    setTournaments((prev) =>
      prev.map((t) => (t.id === tournamentId ? { ...t, matches: [...t.matches, match] } : t))
    );
  }, []);

  const removeMatchFromTournament = useCallback((tournamentId: string, matchId: string) => {
    setTournaments((prev) =>
      prev.map((t) => (t.id === tournamentId ? { ...t, matches: t.matches.filter((m) => m.id !== matchId) } : t))
    );
  }, []);

  const updateMatchDetails = useCallback(
    (tournamentId: string, matchId: string, updates: Partial<Pick<Match, "homeTeamId" | "awayTeamId" | "date" | "time" | "venue" | "status" | "postponedReason">>) => {
      setTournaments((prev) =>
        prev.map((t) => {
          if (t.id !== tournamentId) return t;
          return {
            ...t,
            matches: t.matches.map((m) =>
              m.id === matchId ? { ...m, ...updates } : m
            ),
          };
        })
      );
    },
    []
  );

  const updateTournamentProps = useCallback(
    (tournamentId: string, updates: Partial<Pick<Tournament, "doubleRoundRobin" | "groupStageComplete" | "sponsors">>) => {
      setTournaments((prev) =>
        prev.map((t) => (t.id === tournamentId ? { ...t, ...updates } : t))
      );
    },
    []
  );

  const updateTeamPlayers = useCallback((teamId: string, players: Player[]) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, players } : t))
    );
  }, []);

  const updateTeam = useCallback((teamId: string, updates: Partial<Pick<Team, "name" | "primaryColor" | "secondaryColor">>) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, ...updates } : t))
    );
  }, []);

  const updateEventPaid = useCallback(
    (tournamentId: string, matchId: string, eventId: string, paid: boolean) => {
      setTournaments((prev) =>
        prev.map((t) => {
          if (t.id !== tournamentId) return t;
          return {
            ...t,
            matches: t.matches.map((m) => {
              if (m.id !== matchId || !m.events) return m;
              return {
                ...m,
                events: m.events.map((e) =>
                  e.id === eventId ? { ...e, paid } : e
                ),
              };
            }),
          };
        })
      );
    },
    []
  );

  const updateMatch = useCallback(
    (
      tournamentId: string,
      matchId: string,
      homeScore: number,
      awayScore: number,
      events?: MatchEvent[],
      sets?: VolleyballSet[]
    ) => {
      setTournaments((prev) =>
        prev.map((t) => {
          if (t.id !== tournamentId) return t;

          const updatedMatches = t.matches.map((m) => {
            if (m.id !== matchId) return m;
            const winnerId =
              homeScore > awayScore
                ? m.homeTeamId
                : awayScore > homeScore
                  ? m.awayTeamId
                  : null;
            return {
              ...m,
              homeScore,
              awayScore,
              winnerId,
              status: "completed" as const,
              events: events || [],
              ...(sets ? { sets } : {}),
            };
          });

          // For elimination or playoff phase: propagate winner to next match
          const shouldPropagate =
            t.format === "elimination" ||
            (t.format === "group-playoff" &&
              updatedMatches.find((m) => m.id === matchId)?.phase === "playoff");

          if (shouldPropagate) {
            const completedMatch = updatedMatches.find(
              (m) => m.id === matchId
            );
            if (completedMatch?.winnerId && completedMatch.nextMatchId) {
              const nextMatchIdx = updatedMatches.findIndex(
                (m) => m.id === completedMatch.nextMatchId
              );
              if (nextMatchIdx !== -1) {
                const nextMatch = { ...updatedMatches[nextMatchIdx] };
                // Find which feeder slot this match fills
                const feeders = updatedMatches.filter(
                  (m) => m.nextMatchId === nextMatch.id
                );
                const feederIndex = feeders.findIndex(
                  (m) => m.id === matchId
                );
                if (feederIndex === 0) {
                  nextMatch.homeTeamId = completedMatch.winnerId;
                } else {
                  nextMatch.awayTeamId = completedMatch.winnerId;
                }
                updatedMatches[nextMatchIdx] = nextMatch;
              }
            }
          }

          // For group-playoff: auto-fill playoff bracket when all group matches complete
          let groupStageComplete = t.groupStageComplete;
          if (t.format === "group-playoff" && !t.groupStageComplete) {
            const groupMatches = updatedMatches.filter((m) => m.phase === "group");
            const allGroupsDone = groupMatches.every((m) => m.status === "completed");
            if (allGroupsDone) {
              groupStageComplete = true;
              const filled = fillPlayoffBracket({ ...t, matches: updatedMatches });
              updatedMatches.splice(0, updatedMatches.length, ...filled);
            }
          }

          // Check if all matches are completed
          const allCompleted = updatedMatches.every(
            (m) => m.status === "completed"
          );
          const anyStarted = updatedMatches.some(
            (m) => m.status === "completed" || m.status === "scheduled" || m.status === "postponed"
          );

          return {
            ...t,
            matches: updatedMatches,
            groupStageComplete,
            status: allCompleted
              ? ("completed" as const)
              : anyStarted
                ? ("in-progress" as const)
                : t.status,
          };
        })
      );
    },
    []
  );

  const getTournamentById = useCallback(
    (id: string) => tournaments.find((t) => t.id === id),
    [tournaments]
  );

  const getTeamById = useCallback(
    (id: string) => teams.find((t) => t.id === id),
    [teams]
  );

  const getFilteredTournaments = useCallback(
    (filters: TournamentFilters) => {
      return tournaments.filter((t) => {
        if (filters.sport && t.sport !== filters.sport) return false;
        if (filters.format && t.format !== filters.format) return false;
        if (filters.status && t.status !== filters.status) return false;
        if (
          filters.search &&
          !t.name.toLowerCase().includes(filters.search.toLowerCase())
        )
          return false;
        return true;
      });
    },
    [tournaments]
  );

  const value = useMemo(
    () => ({
      tournaments,
      teams,
      addTournament,
      addTeams,
      setTournamentMatches,
      addMatchToTournament,
      removeMatchFromTournament,
      updateMatchDetails,
      updateTournamentProps,
      updateTeamPlayers,
      updateTeam,
      updateEventPaid,
      updateMatch,
      getTournamentById,
      getTeamById,
      getFilteredTournaments,
    }),
    [
      tournaments,
      teams,
      addTournament,
      addTeams,
      setTournamentMatches,
      addMatchToTournament,
      removeMatchFromTournament,
      updateMatchDetails,
      updateTournamentProps,
      updateTeamPlayers,
      updateTeam,
      updateEventPaid,
      updateMatch,
      getTournamentById,
      getTeamById,
      getFilteredTournaments,
    ]
  );

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournaments() {
  const ctx = useContext(TournamentContext);
  if (!ctx)
    throw new Error("useTournaments must be used within TournamentProvider");
  return ctx;
}
