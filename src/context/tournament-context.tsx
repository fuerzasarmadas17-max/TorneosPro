"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  ReactNode,
} from "react";
import { Tournament, Team, TournamentFilters, Match, MatchEvent, Player, VolleyballSet, Sponsor, PhaseConfig } from "@/types";
import { fillPlayoffBracket, fillPhase2Groups } from "@/data/helpers";
import { fetchTournaments, createTournament as dbCreateTournament, updateTournament as dbUpdateTournament, deleteTournament as dbDeleteTournament, addTournamentTeams, removeTeamFromTournament as dbRemoveTeamFromTournament, updatePlayoffConfig as dbUpdatePlayoffConfig, updateTournamentSponsors, insertMatchesForPhase, assignTeamsToGroup } from "@/lib/db/tournaments";
import { fetchAllTeams, createTeams as dbCreateTeams, updateTeam as dbUpdateTeam, updateTeamPlayers as dbUpdateTeamPlayers } from "@/lib/db/teams";
import { createMatch as dbCreateMatch, createMatches as dbCreateMatches, updateMatchResult as dbUpdateMatchResult, updateMatchDetails as dbUpdateMatchDetails, deleteMatch as dbDeleteMatch, updateEventPaid as dbUpdateEventPaid } from "@/lib/db/matches";
import { toDbMatch } from "@/lib/db/mappers";
import { supabase } from "@/lib/supabase";

interface TournamentContextType {
  tournaments: Tournament[];
  teams: Team[];
  isLoading: boolean;
  error: string | null;
  addTournament: (tournament: Tournament) => Promise<{ id: string } | null>;
  addTeams: (newTeams: Team[]) => Promise<string[]>;
  addTeamsToTournament: (tournamentId: string, teamIds: string[]) => Promise<boolean>;
  setTournamentMatches: (tournamentId: string, matches: Match[]) => Promise<void>;
  addMatchToTournament: (tournamentId: string, match: Match) => Promise<void>;
  removeMatchFromTournament: (tournamentId: string, matchId: string) => Promise<void>;
  removeTeamFromTournament: (tournamentId: string, teamId: string) => Promise<void>;
  disqualifyTeam: (tournamentId: string, teamId: string) => Promise<void>;
  removeTournament: (tournamentId: string) => Promise<boolean>;
  updateMatchDetails: (tournamentId: string, matchId: string, updates: Partial<Pick<Match, "round" | "homeTeamId" | "awayTeamId" | "date" | "time" | "venue" | "status" | "postponedReason">>) => Promise<void>;
  updateTournamentProps: (tournamentId: string, updates: Partial<Pick<Tournament, "doubleRoundRobin" | "groupStageComplete" | "sponsors" | "tier" | "price" | "plan" | "phaseConfigs" | "visibleTabs" | "disqualifiedTeamIds">>) => Promise<void>;
  updatePlayoffConfig: (tournamentId: string, advancePerGroup: number, totalAdvancing: number) => Promise<void>;
  updateMatch: (
    tournamentId: string,
    matchId: string,
    homeScore: number,
    awayScore: number,
    events?: MatchEvent[],
    sets?: VolleyballSet[]
  ) => Promise<void>;
  updateTeamPlayers: (teamId: string, players: Player[]) => Promise<void>;
  updateTeam: (teamId: string, updates: Partial<Pick<Team, "name" | "primaryColor" | "secondaryColor">>) => Promise<void>;
  updateEventPaid: (tournamentId: string, matchId: string, eventId: string, paid: boolean) => Promise<void>;
  assignTeamsToGroupFn: (groupId: string, teamIds: string[]) => Promise<boolean>;
  addMatchesToTournament: (tournamentId: string, newMatches: Match[]) => Promise<void>;
  getTournamentById: (id: string) => Tournament | undefined;
  getTeamById: (id: string) => Team | undefined;
  getFilteredTournaments: (filters: TournamentFilters) => Tournament[];
  refetch: () => Promise<void>;
}

const TournamentContext = createContext<TournamentContextType | undefined>(
  undefined
);

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [tournamentsData, teamsData] = await Promise.all([
        fetchTournaments(),
        fetchAllTeams(),
      ]);
      setTournaments(tournamentsData);
      setTeams(teamsData);
      setError(null);
    } catch (err) {
      setError("Error al cargar datos");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load data immediately (works if session is valid or for public RLS)
    loadData();

    // Re-load when Supabase confirms a valid session (after token refresh,
    // sign-in, or session restore). This catches the case where the initial
    // load failed because the JWT was expired.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        loadData();
      }
    });

    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, [loadData]);

  const refetch = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const addTournament = useCallback(async (tournament: Tournament): Promise<{ id: string } | null> => {
    const tournamentId = await dbCreateTournament(tournament);
    if (tournamentId) {
      // Refetch to get the full tournament with DB-generated IDs
      await loadData();
      return { id: tournamentId };
    }
    return null;
  }, [loadData]);

  const addTeams = useCallback(async (newTeams: Team[]): Promise<string[]> => {
    const ids = await dbCreateTeams(newTeams);
    if (ids.length > 0) {
      // Reload teams
      const teamsData = await fetchAllTeams();
      setTeams(teamsData);
    }
    return ids;
  }, []);

  const addTeamsToTournamentFn = useCallback(async (tournamentId: string, teamIds: string[]): Promise<boolean> => {
    const ok = await addTournamentTeams(tournamentId, teamIds);
    if (ok) {
      await loadData();
    }
    return ok;
  }, [loadData]);

  const assignTeamsToGroupFn = useCallback(async (groupId: string, teamIds: string[]): Promise<boolean> => {
    const ok = await assignTeamsToGroup(groupId, teamIds);
    if (ok) {
      await loadData();
    }
    return ok;
  }, [loadData]);

  const addMatchesToTournament = useCallback(async (tournamentId: string, newMatches: Match[]) => {
    if (newMatches.length === 0) return;
    const idMapping = await insertMatchesForPhase(newMatches, tournamentId);
    setTournaments(prev => prev.map(t => {
      if (t.id !== tournamentId) return t;
      const mappedMatches = newMatches.map(m => ({
        ...m,
        id: idMapping[m.id] || m.id,
      }));
      return { ...t, matches: [...t.matches, ...mappedMatches] };
    }));
  }, []);

  const setTournamentMatches = useCallback(async (tournamentId: string, matches: Match[]) => {
    // Delete existing matches and insert new ones
    await supabase.from("matches").delete().eq("tournament_id", tournamentId);

    if (matches.length > 0) {
      // Insert matches, need to handle nextMatchId references
      // First insert all without nextMatchId
      const idMapping: Record<string, string> = {};

      for (const match of matches) {
        const dbData = toDbMatch({ ...match, tournamentId });
        dbData.next_match_id = null;
        // Map group_id if needed
        if (match.groupId) {
          // groupId should already be a DB UUID if groups were created properly
          dbData.group_id = match.groupId;
        }

        const { data } = await supabase
          .from("matches")
          .insert(dbData)
          .select("id")
          .single();

        if (data) {
          idMapping[match.id] = data.id as string;
        }
      }

      // Update nextMatchId references
      for (const match of matches) {
        if (match.nextMatchId && idMapping[match.nextMatchId]) {
          await supabase
            .from("matches")
            .update({ next_match_id: idMapping[match.nextMatchId] })
            .eq("id", idMapping[match.id]);
        }
      }
    }

    await loadData();
  }, [loadData]);

  const addMatchToTournament = useCallback(async (tournamentId: string, match: Match) => {
    const dbData = toDbMatch({ ...match, tournamentId });
    await supabase.from("matches").insert(dbData);
    await loadData();
  }, [loadData]);

  const removeMatchFromTournament = useCallback(async (tournamentId: string, matchId: string) => {
    await dbDeleteMatch(matchId);
    // Optimistic update
    setTournaments((prev) =>
      prev.map((t) => (t.id === tournamentId ? { ...t, matches: t.matches.filter((m) => m.id !== matchId) } : t))
    );
  }, []);

  const removeTeamFromTournamentFn = useCallback(async (tournamentId: string, teamId: string) => {
    await dbRemoveTeamFromTournament(tournamentId, teamId);
    // Optimistic update
    setTournaments((prev) =>
      prev.map((t) => {
        if (t.id !== tournamentId) return t;
        return {
          ...t,
          teamIds: t.teamIds.filter((id) => id !== teamId),
          groups: t.groups?.map((g) => ({
            ...g,
            teamIds: g.teamIds.filter((id) => id !== teamId),
          })),
          matches: t.matches.filter(
            (m) => m.homeTeamId !== teamId && m.awayTeamId !== teamId
          ),
        };
      })
    );
  }, []);

  const disqualifyTeam = useCallback(async (tournamentId: string, teamId: string) => {
    const tournament = tournaments.find((t) => t.id === tournamentId);
    if (!tournament) return;

    // 1. Add to disqualifiedTeamIds
    const current = tournament.disqualifiedTeamIds || [];
    if (current.includes(teamId)) return;
    const newDQ = [...current, teamId];

    // 2. Find non-completed PLAYOFF matches (walkover only in playoffs)
    const futurePlayoffMatches = tournament.matches.filter(
      (m) => m.status !== "completed" && m.phase === "playoff" &&
        (m.homeTeamId === teamId || m.awayTeamId === teamId)
    );

    // 3. Playoff: walkover 3-0 + propagate winner
    for (const match of futurePlayoffMatches) {
      const opponentIsHome = match.awayTeamId === teamId;
      const winnerId = opponentIsHome ? match.homeTeamId : match.awayTeamId;
      await dbUpdateMatchDetails(match.id, {
        homeScore: opponentIsHome ? 3 : 0,
        awayScore: opponentIsHome ? 0 : 3,
        winnerId: winnerId,
        status: "completed",
      });

      if (match.nextMatchId && winnerId) {
        const nextMatch = tournament.matches.find((m) => m.id === match.nextMatchId);
        if (nextMatch) {
          const feeders = tournament.matches.filter((m) => m.nextMatchId === nextMatch.id);
          const feederIdx = feeders.findIndex((f) => f.id === match.id);
          if (feederIdx === 0) {
            await dbUpdateMatchDetails(nextMatch.id, { homeTeamId: winnerId });
          } else {
            await dbUpdateMatchDetails(nextMatch.id, { awayTeamId: winnerId });
          }
        }
      }
    }

    // 4. Persist disqualifiedTeamIds (standings will ignore DQ team matches automatically)
    await dbUpdateTournament(tournamentId, { disqualifiedTeamIds: newDQ });

    // 5. Optimistic update
    setTournaments((prev) =>
      prev.map((t) => {
        if (t.id !== tournamentId) return t;
        let updatedMatches = [...t.matches];
        for (const match of futurePlayoffMatches) {
          const opponentIsHome = match.awayTeamId === teamId;
          const winnerId = opponentIsHome ? match.homeTeamId : match.awayTeamId;
          updatedMatches = updatedMatches.map((m) => {
            if (m.id === match.id) {
              return {
                ...m,
                homeScore: opponentIsHome ? 3 : 0,
                awayScore: opponentIsHome ? 0 : 3,
                winnerId,
                status: "completed" as const,
              };
            }
            if (match.nextMatchId && m.id === match.nextMatchId && winnerId) {
              const feeders = t.matches.filter((f) => f.nextMatchId === match.nextMatchId);
              const feederIdx = feeders.findIndex((f) => f.id === match.id);
              if (feederIdx === 0) return { ...m, homeTeamId: winnerId };
              return { ...m, awayTeamId: winnerId };
            }
            return m;
          });
        }
        return { ...t, disqualifiedTeamIds: newDQ, matches: updatedMatches };
      })
    );
  }, [tournaments]);

  const removeTournament = useCallback(async (tournamentId: string) => {
    const ok = await dbDeleteTournament(tournamentId);
    if (ok) {
      setTournaments((prev) => prev.filter((t) => t.id !== tournamentId));
    }
    return ok;
  }, []);

  const updateMatchDetails = useCallback(
    async (tournamentId: string, matchId: string, updates: Partial<Pick<Match, "round" | "homeTeamId" | "awayTeamId" | "date" | "time" | "venue" | "status" | "postponedReason">>) => {
      await dbUpdateMatchDetails(matchId, updates);
      // Optimistic update
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
    async (tournamentId: string, updates: Partial<Pick<Tournament, "doubleRoundRobin" | "groupStageComplete" | "sponsors" | "tier" | "price" | "plan" | "phaseConfigs" | "visibleTabs" | "disqualifiedTeamIds">>) => {
      // Update tournament fields in DB
      const dbUpdates: Partial<Tournament> = {};
      if (updates.doubleRoundRobin !== undefined) dbUpdates.doubleRoundRobin = updates.doubleRoundRobin;
      if (updates.groupStageComplete !== undefined) dbUpdates.groupStageComplete = updates.groupStageComplete;
      if (updates.tier !== undefined) dbUpdates.tier = updates.tier;
      if (updates.price !== undefined) dbUpdates.price = updates.price;
      if (updates.plan !== undefined) dbUpdates.plan = updates.plan;
      if (updates.phaseConfigs !== undefined) dbUpdates.phaseConfigs = updates.phaseConfigs;
      if (updates.visibleTabs !== undefined) dbUpdates.visibleTabs = updates.visibleTabs;
      if (updates.disqualifiedTeamIds !== undefined) dbUpdates.disqualifiedTeamIds = updates.disqualifiedTeamIds;

      if (Object.keys(dbUpdates).length > 0) {
        await dbUpdateTournament(tournamentId, dbUpdates);
      }

      // Handle sponsors separately
      let savedSponsors = updates.sponsors;
      if (updates.sponsors !== undefined) {
        const result = await updateTournamentSponsors(
          tournamentId,
          updates.sponsors.map((s) => ({ imageUrl: s.imageUrl, linkUrl: s.linkUrl }))
        );
        if (result) savedSponsors = result;
      }

      // Update with real DB IDs
      setTournaments((prev) =>
        prev.map((t) => (t.id === tournamentId ? { ...t, ...updates, sponsors: savedSponsors } : t))
      );
    },
    []
  );

  const updatePlayoffConfig = useCallback(
    async (tournamentId: string, advancePerGroup: number, totalAdvancing: number) => {
      await dbUpdatePlayoffConfig(tournamentId, advancePerGroup, totalAdvancing);
      setTournaments((prev) =>
        prev.map((t) =>
          t.id === tournamentId
            ? { ...t, playoffConfig: { advancePerGroup, totalAdvancing } }
            : t
        )
      );
    },
    []
  );

  const updateTeamPlayers = useCallback(async (teamId: string, players: Player[]) => {
    await dbUpdateTeamPlayers(teamId, players);
    // Reload teams to get new player IDs
    const teamsData = await fetchAllTeams();
    setTeams(teamsData);
  }, []);

  const updateTeam = useCallback(async (teamId: string, updates: Partial<Pick<Team, "name" | "primaryColor" | "secondaryColor">>) => {
    await dbUpdateTeam(teamId, updates);
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, ...updates } : t))
    );
  }, []);

  const updateEventPaid = useCallback(
    async (tournamentId: string, matchId: string, eventId: string, paid: boolean) => {
      await dbUpdateEventPaid(eventId, paid);
      // Optimistic update
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
    async (
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

                // Persist next match team assignment
                dbUpdateMatchDetails(nextMatch.id, {
                  homeTeamId: nextMatch.homeTeamId,
                  awayTeamId: nextMatch.awayTeamId,
                });
              }
            }
          }

          // For group-playoff: auto-fill playoff bracket when all group matches complete
          let groupStageComplete = t.groupStageComplete;
          let updatedPhaseConfigs = t.phaseConfigs ? [...t.phaseConfigs.map(pc => ({ ...pc }))] : undefined;
          let updatedGroups = t.groups;

          if (t.format === "group-playoff" && t.phaseConfigs?.length) {
            // Multi-phase: detect phase completion
            for (const pc of updatedPhaseConfigs!) {
              if (pc.complete) continue;
              const phaseGroups = (updatedGroups || []).filter(g => g.phase === pc.phase);
              const phaseGroupIds = new Set(phaseGroups.map(g => g.id));
              const phaseMatches = updatedMatches.filter(
                m => m.phase === "group" && m.groupId && phaseGroupIds.has(m.groupId)
              );
              if (phaseMatches.length === 0 || !phaseMatches.every(m => m.status === "completed")) break;

              pc.complete = true;

              if (pc.nextGroupCount) {
                // Intermediate phase → fill next phase groups
                const result = fillPhase2Groups(
                  { ...t, groups: updatedGroups, matches: updatedMatches },
                  pc
                );
                updatedMatches.push(...result.phase2Matches);

                // Update local groups with team assignments
                updatedGroups = (updatedGroups || []).map(g => {
                  if (result.groupTeamAssignments[g.id]) {
                    return { ...g, teamIds: result.groupTeamAssignments[g.id] };
                  }
                  return g;
                });

                // Persist: insert phase 2 matches, assign teams to groups
                insertMatchesForPhase(result.phase2Matches, t.id);
                for (const [groupId, teamIds] of Object.entries(result.groupTeamAssignments)) {
                  assignTeamsToGroup(groupId, teamIds);
                }
              } else {
                // Last group phase → fill playoff bracket
                const lastPhaseGroups = (updatedGroups || []).filter(g => g.phase === pc.phase);
                const filled = fillPlayoffBracket(
                  { ...t, groups: updatedGroups, matches: updatedMatches },
                  pc.phase
                );
                updatedMatches.splice(0, updatedMatches.length, ...filled);
                groupStageComplete = true;
                dbUpdateTournament(t.id, { groupStageComplete: true });

                const playoffMatches = filled.filter((m) => m.phase === "playoff");
                for (const pm of playoffMatches) {
                  if (pm.homeTeamId || pm.awayTeamId) {
                    dbUpdateMatchDetails(pm.id, {
                      homeTeamId: pm.homeTeamId,
                      awayTeamId: pm.awayTeamId,
                      ...(pm.winnerId ? { winnerId: pm.winnerId, homeScore: pm.homeScore, awayScore: pm.awayScore, status: pm.status } : {}),
                    });
                  }
                }
              }

              // Persist phase config update
              dbUpdateTournament(t.id, { phaseConfigs: updatedPhaseConfigs });
              break; // Only process one phase at a time
            }
          } else if (t.format === "group-playoff" && !t.groupStageComplete) {
            // Single-phase group-playoff (original behavior)
            const groupMatches = updatedMatches.filter((m) => m.phase === "group");
            const allGroupsDone = groupMatches.every((m) => m.status === "completed");
            if (allGroupsDone) {
              groupStageComplete = true;
              const filled = fillPlayoffBracket({ ...t, matches: updatedMatches });
              updatedMatches.splice(0, updatedMatches.length, ...filled);

              // Persist group stage complete
              dbUpdateTournament(t.id, { groupStageComplete: true });

              // Persist playoff bracket team assignments
              const playoffMatches = filled.filter((m) => m.phase === "playoff");
              for (const pm of playoffMatches) {
                if (pm.homeTeamId || pm.awayTeamId) {
                  dbUpdateMatchDetails(pm.id, {
                    homeTeamId: pm.homeTeamId,
                    awayTeamId: pm.awayTeamId,
                    ...(pm.winnerId ? { winnerId: pm.winnerId, homeScore: pm.homeScore, awayScore: pm.awayScore, status: pm.status } : {}),
                  });
                }
              }
            }
          }

          // Check if all matches are completed
          const allCompleted = updatedMatches.every(
            (m) => m.status === "completed"
          );
          const anyStarted = updatedMatches.some(
            (m) => m.status === "completed" || m.status === "scheduled" || m.status === "postponed"
          );

          const newStatus = allCompleted
            ? ("completed" as const)
            : anyStarted
              ? ("in-progress" as const)
              : t.status;

          // Persist status change
          if (newStatus !== t.status) {
            dbUpdateTournament(t.id, { status: newStatus });
          }

          return {
            ...t,
            matches: updatedMatches,
            groups: updatedGroups,
            groupStageComplete,
            phaseConfigs: updatedPhaseConfigs,
            status: newStatus,
          };
        })
      );

      // Persist the match result to DB
      const tournament = tournaments.find((t) => t.id === tournamentId);
      const match = tournament?.matches.find((m) => m.id === matchId);
      const winnerId =
        homeScore > awayScore
          ? match?.homeTeamId ?? null
          : awayScore > homeScore
            ? match?.awayTeamId ?? null
            : null;

      await dbUpdateMatchResult(matchId, homeScore, awayScore, winnerId, events, sets);
    },
    [tournaments]
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
        if (filters.department && t.department !== filters.department) return false;
        if (filters.municipality && t.municipality !== filters.municipality) return false;
        return true;
      });
    },
    [tournaments]
  );

  const value = useMemo(
    () => ({
      tournaments,
      teams,
      isLoading,
      error,
      addTournament,
      addTeams,
      addTeamsToTournament: addTeamsToTournamentFn,
      setTournamentMatches,
      addMatchToTournament,
      removeMatchFromTournament,
      removeTeamFromTournament: removeTeamFromTournamentFn,
      disqualifyTeam,
      removeTournament,
      updateMatchDetails,
      updateTournamentProps,
      updatePlayoffConfig,
      updateTeamPlayers,
      updateTeam,
      updateEventPaid,
      assignTeamsToGroupFn,
      addMatchesToTournament,
      updateMatch,
      getTournamentById,
      getTeamById,
      getFilteredTournaments,
      refetch,
    }),
    [
      tournaments,
      teams,
      isLoading,
      error,
      addTournament,
      addTeams,
      addTeamsToTournamentFn,
      setTournamentMatches,
      addMatchToTournament,
      removeMatchFromTournament,
      removeTeamFromTournamentFn,
      disqualifyTeam,
      removeTournament,
      updateMatchDetails,
      updateTournamentProps,
      updatePlayoffConfig,
      updateTeamPlayers,
      updateTeam,
      updateEventPaid,
      assignTeamsToGroupFn,
      addMatchesToTournament,
      updateMatch,
      getTournamentById,
      getTeamById,
      getFilteredTournaments,
      refetch,
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
