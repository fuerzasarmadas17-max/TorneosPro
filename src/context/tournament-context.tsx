"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { Tournament, Team, TournamentFilters, Match, MatchEvent, Player, VolleyballSet, Sponsor, PhaseConfig } from "@/types";
import { generateRoundRobinCircle, getFinalSeriesChampion } from "@/data/helpers";
import { fetchTournaments, createTournament as dbCreateTournament, updateTournament as dbUpdateTournament, deleteTournament as dbDeleteTournament, addTournamentTeams, removeTeamFromTournament as dbRemoveTeamFromTournament, updatePlayoffConfig as dbUpdatePlayoffConfig, updateTournamentSponsors, insertMatchesForPhase, assignTeamsToGroup, assignTeamsToPhaseGroups as dbAssignTeamsToPhaseGroups, assignTeamsToBracketSlots as dbAssignTeamsToBracketSlots, updateGroupName as dbUpdateGroupName } from "@/lib/db/tournaments";
import { fetchAllTeams, createTeams as dbCreateTeams, updateTeam as dbUpdateTeam, updateTeamPlayers as dbUpdateTeamPlayers } from "@/lib/db/teams";
import { createMatch as dbCreateMatch, createMatches as dbCreateMatches, updateMatchResult as dbUpdateMatchResult, updateMatchDetails as dbUpdateMatchDetails, deleteMatch as dbDeleteMatch, updateEventPaid as dbUpdateEventPaid } from "@/lib/db/matches";
import { toDbMatch } from "@/lib/db/mappers";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";

interface TournamentContextType {
  tournaments: Tournament[];
  teams: Team[];
  isLoading: boolean;
  /** True mientras se carga la lista de equipos del sistema (background
   *  load). La página de detalle del torneo lo usa para mostrar un
   *  spinner hasta que los nombres de equipos estén disponibles. */
  teamsLoading: boolean;
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
  updateTournamentProps: (tournamentId: string, updates: Partial<Pick<Tournament, "name" | "description" | "startDate" | "endDate" | "bestOf" | "doubleRoundRobin" | "groupStageComplete" | "playoffDoubleLeg" | "playoffFixtureGenerated" | "playoffFinalFormat" | "championPhotoUrl" | "sponsors" | "tier" | "price" | "plan" | "phaseConfigs" | "visibleTabs" | "disqualifiedTeamIds">>) => Promise<void>;
  updatePlayoffConfig: (
    tournamentId: string,
    advancePerGroup: number,
    totalAdvancing: number,
    perGroup?: Record<string, number>
  ) => Promise<void>;
  renameGroup: (tournamentId: string, groupId: string, name: string) => Promise<void>;
  /** Save the organizer's group assignments for a finished phase's next phase
   *  (e.g. fase 1 finishes → assign classified teams to fase 2 groups). */
  configurePhaseGroups: (
    tournamentId: string,
    phase: number,
    assignments: Record<string, string[]>
  ) => Promise<boolean>;
  /** Save the organizer's slot assignments to existing bracket matches. */
  configureBracketSlots: (
    tournamentId: string,
    slotAssignments: Record<string, { homeTeamId: string | null; awayTeamId: string | null }>
  ) => Promise<boolean>;
  /** Pieza I: materialize the final's match list per the chosen format. Wipes
   *  the existing final matches and inserts the new ones (single, ida y
   *  vuelta, best-of-5, best-of-7). All series matches share the same teams;
   *  for double_leg the sides are swapped on match 2. Feeders of the final
   *  (vueltas of the semifinals or the semifinal ida if single-leg) get
   *  rewired to point at the new match 1. Optionally schedules dates.
   *
   *  Returns false if the finalists aren't both known yet (semifinals still
   *  pending). */
  configurePlayoffFinal: (
    tournamentId: string,
    format: NonNullable<Tournament["playoffFinalFormat"]>,
    schedules?: { date?: string; time?: string; venue?: string }[]
  ) => Promise<boolean>;
  /** Finalize the playoff bracket: for single-leg just flips the
   *  `playoffFixtureGenerated` flag; for double-leg also rebuilds the bracket
   *  matches to include ida + vuelta legs (preserving round-1 team
   *  assignments). After this runs, PlayoffBracketView switches from the
   *  matchup builder to the regular bracket view. */
  generatePlayoffFixture: (tournamentId: string) => Promise<boolean>;
  /** Generate round-robin matches for an already-populated phase's groups.
   *  `doubleRoundRobin` controls "ida y vuelta" (each pair plays twice). When
   *  omitted, falls back to the tournament-level flag (default false). The
   *  chosen value is persisted at the tournament level so subsequent phases
   *  and pending-matchup checks stay consistent. */
  generatePhaseMatches: (
    tournamentId: string,
    phase: number,
    doubleRoundRobin?: boolean
  ) => Promise<boolean>;
  updateMatch: (
    tournamentId: string,
    matchId: string,
    homeScore: number,
    awayScore: number,
    events?: MatchEvent[],
    sets?: VolleyballSet[]
  ) => Promise<void>;
  /** Apply an externally-sourced match update (Realtime channel). Only
   *  patches local state — does NOT write to the DB. The patch comes from
   *  a Supabase Realtime payload, so the change is already persisted. */
  applyExternalMatchUpdate: (
    tournamentId: string,
    matchId: string,
    patch: Partial<Match>
  ) => void;
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
  // Ref kept in sync with `tournaments` so useCallback bodies can read the
  // latest state without listing `tournaments` as a dependency (which would
  // recreate every callback on each state mutation).
  const tournamentsRef = useRef<Tournament[]>([]);
  tournamentsRef.current = tournaments;
  // `isLoading` refleja solo el estado de torneos (la query liviana). Lo
  // usamos en la landing y /tournaments para no bloquear el render.
  // `teamsLoading` es la query pesada de equipos; se carga en background
  // y la página de detalle del torneo la usa para esperar los nombres.
  const [isLoading, setIsLoading] = useState(true);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // El estado de auth se inyecta vía AuthProvider (que envuelve a este
  // provider en app/providers.tsx). Lo usamos para evitar pedir
  // `fetchAllTeams()` en el initial load para usuarios anónimos — esa
  // query trae TODOS los equipos del sistema con sus jugadores y es la
  // peor parte del bottleneck de performance (auditoria_landing.md #1).
  // Anónimos solo ven la landing y el listado público de torneos; los
  // equipos los cargamos recién cuando el user se autentica.
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Torneos: query pública con RLS, se carga siempre para todos.
  const loadTournaments = useCallback(async () => {
    try {
      const data = await fetchTournaments();
      setTournaments(data);
      setError(null);
    } catch (err) {
      setError("Error al cargar datos");
      console.error(err);
    }
  }, []);

  // Equipos: query "todos los equipos del sistema" — pesada. Se carga
  // en BACKGROUND después del initial paint de la landing. El estado
  // `teamsLoading` permite a la página de detalle del torneo mostrar
  // un spinner mientras los nombres reales llegan, en lugar de mostrar
  // UUIDs / "TBD" en bracket, calendario y posiciones.
  const loadTeams = useCallback(async () => {
    setTeamsLoading(true);
    try {
      const data = await fetchAllTeams();
      setTeams(data);
    } catch (err) {
      console.error("loadTeams failed", err);
    } finally {
      setTeamsLoading(false);
    }
  }, []);

  // Initial mount: arrancamos cargando torneos para tener la landing
  // utilizable lo antes posible. Los equipos van en un effect separado
  // que depende del estado de auth.
  useEffect(() => {
    loadTournaments().finally(() => setIsLoading(false));

    // Re-load when Supabase confirms a valid session (after token refresh,
    // sign-in, or session restore). Esto cubre el caso de que el JWT
    // estuviera vencido al mount o que el usuario haya hecho login.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        loadTournaments();
      }
    });

    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, [loadTournaments]);

  // Equipos: lazy load en background apenas el auth termina su check
  // inicial. Antes solo cargábamos para usuarios logueados, pero un
  // anónimo que entra directo a un link compartido de torneo se
  // encontraba con UUIDs en lugar de nombres. Ahora cargamos siempre,
  // pero después del primer paint — la landing y /tournaments arrancan
  // rápido igual porque dependen solo de `isLoading` (que es de
  // torneos), no de `teamsLoading`.
  useEffect(() => {
    if (authLoading) return;
    loadTeams();
  }, [authLoading, loadTeams]);

  const refetch = useCallback(async () => {
    await loadTournaments();
    await loadTeams();
  }, [loadTournaments, loadTeams]);

  const addTournament = useCallback(async (tournament: Tournament): Promise<{ id: string } | null> => {
    const tournamentId = await dbCreateTournament(tournament);
    if (tournamentId) {
      // Refetch to get the full tournament with DB-generated IDs
      await refetch();
      return { id: tournamentId };
    }
    return null;
  }, [refetch]);

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
      await refetch();
    }
    return ok;
  }, [refetch]);

  const assignTeamsToGroupFn = useCallback(async (groupId: string, teamIds: string[]): Promise<boolean> => {
    const ok = await assignTeamsToGroup(groupId, teamIds);
    if (ok) {
      await refetch();
    }
    return ok;
  }, [refetch]);

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

    await refetch();
  }, [refetch]);

  const addMatchToTournament = useCallback(async (tournamentId: string, match: Match) => {
    const dbData = toDbMatch({ ...match, tournamentId });
    await supabase.from("matches").insert(dbData);
    await refetch();
  }, [refetch]);

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
    async (tournamentId: string, updates: Partial<Pick<Tournament, "name" | "description" | "startDate" | "endDate" | "bestOf" | "doubleRoundRobin" | "groupStageComplete" | "playoffDoubleLeg" | "playoffFixtureGenerated" | "playoffFinalFormat" | "championPhotoUrl" | "sponsors" | "tier" | "price" | "plan" | "phaseConfigs" | "visibleTabs" | "disqualifiedTeamIds">>) => {
      // Update tournament fields in DB
      const dbUpdates: Partial<Tournament> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.startDate !== undefined) dbUpdates.startDate = updates.startDate;
      if (updates.endDate !== undefined) dbUpdates.endDate = updates.endDate;
      if (updates.bestOf !== undefined) dbUpdates.bestOf = updates.bestOf;
      if (updates.doubleRoundRobin !== undefined) dbUpdates.doubleRoundRobin = updates.doubleRoundRobin;
      if (updates.groupStageComplete !== undefined) dbUpdates.groupStageComplete = updates.groupStageComplete;
      if (updates.playoffDoubleLeg !== undefined) dbUpdates.playoffDoubleLeg = updates.playoffDoubleLeg;
      if (updates.playoffFixtureGenerated !== undefined) dbUpdates.playoffFixtureGenerated = updates.playoffFixtureGenerated;
      if (updates.playoffFinalFormat !== undefined) dbUpdates.playoffFinalFormat = updates.playoffFinalFormat;
      if (updates.championPhotoUrl !== undefined) dbUpdates.championPhotoUrl = updates.championPhotoUrl;
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
    async (
      tournamentId: string,
      advancePerGroup: number,
      totalAdvancing: number,
      perGroup?: Record<string, number>
    ) => {
      await dbUpdatePlayoffConfig(tournamentId, advancePerGroup, totalAdvancing, perGroup);
      setTournaments((prev) =>
        prev.map((t) =>
          t.id === tournamentId
            ? { ...t, playoffConfig: { advancePerGroup, totalAdvancing, perGroup } }
            : t
        )
      );
    },
    []
  );

  const configurePhaseGroups = useCallback(
    async (tournamentId: string, phase: number, assignments: Record<string, string[]>) => {
      const ok = await dbAssignTeamsToPhaseGroups(tournamentId, phase, assignments);
      if (!ok) return false;
      // Optimistic update: rewrite teamIds on the matching groups in local state.
      setTournaments((prev) =>
        prev.map((t) => {
          if (t.id !== tournamentId) return t;
          return {
            ...t,
            groups: t.groups?.map((g) =>
              assignments[g.id] !== undefined ? { ...g, teamIds: assignments[g.id] } : g
            ),
          };
        })
      );
      return true;
    },
    []
  );

  const configureBracketSlots = useCallback(
    async (
      tournamentId: string,
      slotAssignments: Record<string, { homeTeamId: string | null; awayTeamId: string | null }>
    ) => {
      const ok = await dbAssignTeamsToBracketSlots(slotAssignments);
      if (!ok) return false;

      // Bye resolution: any R1 match that ends up with exactly one team set
      // (and the other slot null) is a "bye" — the only team advances
      // directly to the next round. We auto-complete those matches with a
      // 0-0 score and the assigned team as winner, and propagate to the
      // next round's slot the same way a real match would.
      const t = tournamentsRef.current.find((x) => x.id === tournamentId);
      const byeUpdates: {
        matchId: string;
        winnerId: string;
      }[] = [];
      const propagatedToNext: Record<
        string,
        { homeTeamId?: string; awayTeamId?: string }
      > = {};
      if (t) {
        for (const [matchId, slots] of Object.entries(slotAssignments)) {
          const home = slots.homeTeamId;
          const away = slots.awayTeamId;
          const isBye = (!!home && !away) || (!home && !!away);
          if (!isBye) continue;
          const winnerId = (home ?? away)!;
          byeUpdates.push({ matchId, winnerId });

          // Find the match in current state to figure out its nextMatchId
          // and feeder index for propagation.
          const bracketMatch = t.matches.find((m) => m.id === matchId);
          if (!bracketMatch?.nextMatchId) continue;
          // Existing feeders + this bye match — feederIndex 0 fills home,
          // 1 fills away in the next match.
          const feeders = t.matches
            .filter((m) => m.nextMatchId === bracketMatch.nextMatchId)
            .sort((a, b) => a.matchNumber - b.matchNumber);
          const idx = feeders.findIndex((f) => f.id === matchId);
          const slotKey = idx === 0 ? "homeTeamId" : "awayTeamId";
          propagatedToNext[bracketMatch.nextMatchId] = {
            ...(propagatedToNext[bracketMatch.nextMatchId] ?? {}),
            [slotKey]: winnerId,
          };
        }
      }

      // Persist bye completions and the propagated team assignments.
      for (const { matchId, winnerId } of byeUpdates) {
        await dbUpdateMatchDetails(matchId, {
          status: "completed",
          homeScore: 0,
          awayScore: 0,
          winnerId,
        });
      }
      for (const [matchId, slots] of Object.entries(propagatedToNext)) {
        await dbUpdateMatchDetails(matchId, slots);
      }

      // Optimistic update: rewrite home/awayTeamId on the matching matches,
      // mark byes as completed in-place, and bubble bye winners to the next
      // round's slot so the bracket view reflects the resolution immediately.
      setTournaments((prev) =>
        prev.map((tt) => {
          if (tt.id !== tournamentId) return tt;
          const byeIds = new Set(byeUpdates.map((b) => b.matchId));
          const byeWinnerById = new Map(byeUpdates.map((b) => [b.matchId, b.winnerId]));
          return {
            ...tt,
            matches: tt.matches.map((m) => {
              let next = m;
              if (slotAssignments[m.id]) {
                next = {
                  ...next,
                  homeTeamId: slotAssignments[m.id].homeTeamId,
                  awayTeamId: slotAssignments[m.id].awayTeamId,
                };
              }
              if (byeIds.has(m.id)) {
                next = {
                  ...next,
                  status: "completed" as const,
                  homeScore: 0,
                  awayScore: 0,
                  winnerId: byeWinnerById.get(m.id) ?? null,
                };
              }
              if (propagatedToNext[m.id]) {
                next = { ...next, ...propagatedToNext[m.id] };
              }
              return next;
            }),
          };
        })
      );
      return true;
    },
    []
  );

  const configurePlayoffFinal = useCallback(
    async (
      tournamentId: string,
      format: NonNullable<Tournament["playoffFinalFormat"]>,
      schedules?: { date?: string; time?: string; venue?: string }[]
    ): Promise<boolean> => {
      const t = tournamentsRef.current.find((x) => x.id === tournamentId);
      if (!t) return false;

      const playoffMatches = t.matches.filter((m) => m.phase === "playoff");
      if (playoffMatches.length === 0) return false;

      // The "final" occupies 1 round (single-leg) or 2 rounds (double-leg
      // where the ida is at maxRound-1 and the vuelta at maxRound). For
      // double-leg the propagation fills the IDA's teams (from the semi
      // vueltas); the vuelta keeps null teams because nothing feeds into
      // it. So to find the finalists we look at the IDA row, not the
      // vuelta.
      const maxRound = Math.max(...playoffMatches.map((m) => m.round));
      const isDoubleLegBracket = !!t.playoffDoubleLeg;
      const idaRound = isDoubleLegBracket ? maxRound - 1 : maxRound;
      const idaMatches = playoffMatches
        .filter((m) => m.round === idaRound)
        .sort((a, b) => a.matchNumber - b.matchNumber);
      const firstIda = idaMatches[0];
      if (!firstIda?.homeTeamId || !firstIda?.awayTeamId) {
        return false;
      }
      const finalistA = firstIda.homeTeamId;
      const finalistB = firstIda.awayTeamId;

      // Final matches to wipe: idaRound + maxRound for double-leg, just
      // maxRound for single-leg.
      const currentFinalMatches = playoffMatches.filter(
        (m) => m.round === maxRound || (isDoubleLegBracket && m.round === idaRound)
      );
      const currentFinalIds = new Set(currentFinalMatches.map((m) => m.id));

      // Feeders of the final (semi vueltas in double-leg semis, or semi
      // matches in single-leg semis) — their nextMatchId points to one of
      // the current final matches. We'll rewire them to the new match 1.
      const feeders = t.matches.filter(
        (m) => m.nextMatchId && currentFinalIds.has(m.nextMatchId)
      );

      // Wipe the existing final matches.
      for (const m of currentFinalMatches) {
        await dbDeleteMatch(m.id);
      }

      // Generate the new series. All matches share the same round so the
      // bracket renderer can group them as a single "matchup card".
      const countMap: Record<typeof format, number> = {
        single: 1,
        double_leg: 2,
        best_of_5: 5,
        best_of_7: 7,
      };
      const count = countMap[format];
      let counter = Math.max(0, ...t.matches.map((m) => m.matchNumber)) + 1;
      const newMatches: Match[] = [];
      for (let i = 0; i < count; i++) {
        // For double_leg, match 2 has sides swapped (true "vuelta"). For
        // best-of-N, all matches have the same sides — the organizer picks
        // venue / home advantage separately.
        let h: string | null = finalistA;
        let a: string | null = finalistB;
        if (format === "double_leg" && i === 1) {
          h = finalistB;
          a = finalistA;
        }
        const schedule = schedules?.[i];
        newMatches.push({
          id: `${tournamentId}-m-${counter}`,
          tournamentId,
          round: maxRound,
          matchNumber: counter,
          homeTeamId: h,
          awayTeamId: a,
          homeScore: null,
          awayScore: null,
          winnerId: null,
          status: "unscheduled",
          nextMatchId: null,
          phase: "playoff",
          date: schedule?.date,
          time: schedule?.time,
          venue: schedule?.venue,
        });
        counter++;
      }

      // Persist new matches.
      const idMapping = await insertMatchesForPhase(newMatches, tournamentId);
      const persisted = newMatches.map((m) => ({
        ...m,
        id: idMapping[m.id] ?? m.id,
      }));

      // Rewire feeders to point at the first match of the new series. For
      // best-of-N the semi winners feed into match 1 only; matches 2..N share
      // the same teams and are not fed by anything.
      const newMatch1 = persisted[0];
      if (newMatch1) {
        for (const feeder of feeders) {
          await dbUpdateMatchDetails(feeder.id, { nextMatchId: newMatch1.id });
        }
      }

      // Persist the format flag.
      await dbUpdateTournament(tournamentId, { playoffFinalFormat: format });

      // Local state update: drop deleted, rewire feeders, append new ones.
      setTournaments((prev) =>
        prev.map((x) => {
          if (x.id !== tournamentId) return x;
          const remaining = x.matches.filter((m) => !currentFinalIds.has(m.id));
          const rewired = remaining.map((m) =>
            feeders.some((f) => f.id === m.id)
              ? { ...m, nextMatchId: newMatch1?.id ?? null }
              : m
          );
          return {
            ...x,
            matches: [...rewired, ...persisted],
            playoffFinalFormat: format,
          };
        })
      );

      return true;
    },
    []
  );

  const generatePlayoffFixture = useCallback(
    async (tournamentId: string): Promise<boolean> => {
      const t = tournamentsRef.current.find((x) => x.id === tournamentId);
      if (!t) return false;

      const doubleLeg = !!t.playoffDoubleLeg;

      // Single-leg path: matchups already live on the existing bracket
      // matches. Just flip the flag so the UI moves to State C.
      if (!doubleLeg) {
        await dbUpdateTournament(tournamentId, { playoffFixtureGenerated: true });
        setTournaments((prev) =>
          prev.map((x) =>
            x.id === tournamentId ? { ...x, playoffFixtureGenerated: true } : x
          )
        );
        return true;
      }

      // Double-leg path: rebuild the bracket from scratch with ida + vuelta
      // legs. Round-1 team assignments from the current bracket are
      // preserved; everything else (later rounds) is regenerated empty with
      // the new nextMatchId chain. Existing playoff matches are deleted.
      const currentBracket = t.matches.filter((m) => m.phase === "playoff");
      const round1 = [...currentBracket]
        .filter((m) => m.round === 1)
        .sort((a, b) => a.matchNumber - b.matchNumber);
      const round1Anchors = round1.map((m) => ({
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
      }));
      const bracketSize = round1.length * 2;
      const singleRounds = Math.log2(bracketSize);

      for (const m of currentBracket) {
        await dbDeleteMatch(m.id);
      }

      // Build the single-leg skeleton first (matching how the wizard would
      // have done it), then expand each match into an ida + vuelta pair.
      // Numbering picks up after the highest existing matchNumber so the
      // ids don't collide with group-stage matches.
      let counter = Math.max(0, ...t.matches.map((m) => m.matchNumber)) + 1;

      type Single = {
        id: string;
        round: number;
        matchNumber: number;
        homeTeamId: string | null;
        awayTeamId: string | null;
        nextMatchIdx: number | null;
      };
      const singles: Single[] = [];
      const indexByRound: Record<number, number[]> = {};

      // Round 1.
      for (let i = 0; i < round1.length; i++) {
        const anchor = round1Anchors[i];
        const idx = singles.length;
        singles.push({
          id: `${tournamentId}-m-${counter}`,
          round: 1,
          matchNumber: counter,
          homeTeamId: anchor.homeTeamId,
          awayTeamId: anchor.awayTeamId,
          nextMatchIdx: null,
        });
        (indexByRound[1] ??= []).push(idx);
        counter++;
      }
      // Subsequent rounds: each match feeds from two of the previous round.
      for (let round = 2; round <= singleRounds; round++) {
        const prev = indexByRound[round - 1];
        const current: number[] = [];
        for (let i = 0; i < prev.length / 2; i++) {
          const idx = singles.length;
          singles.push({
            id: `${tournamentId}-m-${counter}`,
            round,
            matchNumber: counter,
            homeTeamId: null,
            awayTeamId: null,
            nextMatchIdx: null,
          });
          singles[prev[i * 2]].nextMatchIdx = idx;
          singles[prev[i * 2 + 1]].nextMatchIdx = idx;
          current.push(idx);
          counter++;
        }
        indexByRound[round] = current;
      }

      // Double-leg expansion: each single becomes round*2-1 (ida) and
      // round*2 (vuelta). Only the vuelta carries the nextMatchId to the
      // ida of the next bracket round. Mirrors helpers.ts:toDoubleLegElimination
      // but preserves phase="playoff" on the vuelta.
      const expanded: Match[] = [];
      const expandedIdaIndex: Map<number, number> = new Map();
      const expandedVueltaIndex: Map<number, number> = new Map();

      for (let i = 0; i < singles.length; i++) {
        const s = singles[i];
        // Ida
        const idaIdx = expanded.length;
        expanded.push({
          id: s.id,
          tournamentId,
          round: s.round * 2 - 1,
          matchNumber: s.matchNumber,
          homeTeamId: s.homeTeamId,
          awayTeamId: s.awayTeamId,
          homeScore: null,
          awayScore: null,
          winnerId: null,
          status: "unscheduled",
          nextMatchId: null,
          phase: "playoff",
        });
        expandedIdaIndex.set(i, idaIdx);
        // Vuelta — same matchup with sides swapped, new id.
        const vueltaId = `${tournamentId}-m-${counter}`;
        const vueltaIdx = expanded.length;
        expanded.push({
          id: vueltaId,
          tournamentId,
          round: s.round * 2,
          matchNumber: counter,
          homeTeamId: s.awayTeamId,
          awayTeamId: s.homeTeamId,
          homeScore: null,
          awayScore: null,
          winnerId: null,
          status: "unscheduled",
          nextMatchId: null,
          phase: "playoff",
        });
        expandedVueltaIndex.set(i, vueltaIdx);
        counter++;
      }
      // Wire vuelta.nextMatchId → ida of the next bracket round.
      for (let i = 0; i < singles.length; i++) {
        const s = singles[i];
        if (s.nextMatchIdx == null) continue;
        const targetIda = expandedIdaIndex.get(s.nextMatchIdx);
        const vueltaIdx = expandedVueltaIndex.get(i);
        if (targetIda == null || vueltaIdx == null) continue;
        expanded[vueltaIdx].nextMatchId = expanded[targetIda].id;
      }

      // Bye resolution after double-leg regen. The original single-leg bye
      // auto-completes get wiped when this function deletes and recreates
      // the bracket. Walk the new matches and re-resolve any bye pair (both
      // the ida with one team set and its mirrored vuelta) — mark them
      // completed with the lone team as winner. For vueltas with a
      // nextMatchId, also propagate the winner to the next round's ida slot.
      //
      // Gated on "no feeder" so later rounds with one slot waiting for a
      // R1 winner (e.g. semis already populated by a bye but missing the
      // play-in winner) don't get auto-completed.
      for (const m of expanded) {
        const isOnlyOneTeam =
          (!!m.homeTeamId && !m.awayTeamId) ||
          (!m.homeTeamId && !!m.awayTeamId);
        if (!isOnlyOneTeam) continue;
        const hasFeeder = expanded.some((x) => x.nextMatchId === m.id);
        if (hasFeeder) continue;
        const winnerId = (m.homeTeamId ?? m.awayTeamId)!;
        m.status = "completed";
        m.homeScore = 0;
        m.awayScore = 0;
        m.winnerId = winnerId;
      }
      // Propagate vuelta bye winners to the next round's ida slot AND mirror
      // to the paired vuelta (same matchup, sides swapped) so the next round's
      // vuelta isn't left with null teams.
      for (const m of expanded) {
        if (m.status !== "completed" || !m.winnerId || !m.nextMatchId) continue;
        const next = expanded.find((x) => x.id === m.nextMatchId);
        if (!next) continue;
        const feeders = expanded.filter((x) => x.nextMatchId === next.id);
        const idx = feeders.findIndex((f) => f.id === m.id);
        if (idx === 0) next.homeTeamId = m.winnerId;
        else next.awayTeamId = m.winnerId;

        // Mirror to the paired vuelta of `next` (= round+1, same position).
        const idaRoundMatches = expanded
          .filter((x) => x.round === next.round)
          .sort((a, b) => a.matchNumber - b.matchNumber);
        const pairPosition = idaRoundMatches.findIndex((x) => x.id === next.id);
        const vueltaRoundMatches = expanded
          .filter((x) => x.round === next.round + 1)
          .sort((a, b) => a.matchNumber - b.matchNumber);
        const pairedVuelta = vueltaRoundMatches[pairPosition];
        if (pairedVuelta) {
          if (idx === 0) pairedVuelta.awayTeamId = m.winnerId;
          else pairedVuelta.homeTeamId = m.winnerId;
        }
      }

      // Persist new matches and flip the flag.
      const idMapping = await insertMatchesForPhase(expanded, tournamentId);
      // Re-key both id AND nextMatchId so the in-memory bracket links stay
      // valid for the winner-propagation cascade. Without remapping
      // nextMatchId, the local state keeps the temp ids and findIndex by
      // nextMatchId would silently miss — playoff winners wouldn't appear
      // in the next round until a page reload.
      const persisted = expanded.map((m) => ({
        ...m,
        id: idMapping[m.id] ?? m.id,
        nextMatchId: m.nextMatchId
          ? idMapping[m.nextMatchId] ?? m.nextMatchId
          : null,
      }));
      await dbUpdateTournament(tournamentId, { playoffFixtureGenerated: true });

      setTournaments((prev) =>
        prev.map((x) =>
          x.id === tournamentId
            ? {
                ...x,
                matches: [
                  ...x.matches.filter((m) => m.phase !== "playoff"),
                  ...persisted,
                ],
                playoffFixtureGenerated: true,
              }
            : x
        )
      );
      return true;
    },
    []
  );

  const generatePhaseMatches = useCallback(
    async (tournamentId: string, phase: number, doubleRoundRobin?: boolean) => {
      // Build round-robin matches per group in the given phase, then persist.
      // Re-uses generateRoundRobinCircle so the fixture matches what the
      // wizard would have generated for the first phase.
      const tournament = tournamentsRef.current.find((t) => t.id === tournamentId);
      if (!tournament) return false;
      const phaseGroups = (tournament.groups ?? []).filter((g) => g.phase === phase);
      if (phaseGroups.length === 0) return false;

      const drr = doubleRoundRobin ?? tournament.doubleRoundRobin ?? false;
      const allNew: Match[] = [];
      // Start match numbering after the highest existing matchNumber so the
      // ids stay unique across already-generated phases.
      let counter = Math.max(0, ...tournament.matches.map((m) => m.matchNumber)) + 1;
      for (const group of phaseGroups) {
        if (group.teamIds.length < 2) continue;
        const { matches, nextMatchCounter } = generateRoundRobinCircle(
          group.teamIds,
          tournamentId,
          {
            phase: "group",
            groupId: group.id,
            matchCounterStart: counter,
            doubleRoundRobin: drr,
          }
        );
        allNew.push(...matches);
        counter = nextMatchCounter;
      }

      // First time fixture is generated for a group-playoff tournament, also
      // scaffold the empty playoff bracket. Without this, completing every
      // group match would flip the tournament status to "completed" (no
      // pending matches anywhere) and PlayoffBracketView would have no
      // round-1 matches to assign teams to. The wizard's old "Generar
      // Aleatorio" path created the bracket up-front; this is the new
      // equivalent for Pieza F's per-phase generation.
      //
      // Triggered on any phase (single-phase or multi-phase fase 1) — the
      // bracket size is fixed by playoffConfig.totalAdvancing at tournament
      // creation, so creating it early is safe.
      const bracketExists = tournament.matches.some((m) => m.phase === "playoff");
      if (!bracketExists && tournament.playoffConfig?.totalAdvancing) {
        // nextPowerOf2: 5 -> 8, 8 -> 8, 9 -> 16. Sets the bracket round-1
        // size so byes can be assigned to top seeds when totalAdvancing isn't
        // already a power of two.
        let bracketSize = 1;
        while (bracketSize < tournament.playoffConfig.totalAdvancing) bracketSize *= 2;
        const numRounds = Math.log2(bracketSize);
        const startIdx = allNew.length;
        for (let i = 0; i < bracketSize / 2; i++) {
          allNew.push({
            id: `${tournamentId}-m-${counter}`,
            tournamentId,
            round: 1,
            matchNumber: counter,
            homeTeamId: null,
            awayTeamId: null,
            homeScore: null,
            awayScore: null,
            winnerId: null,
            status: "unscheduled",
            nextMatchId: null,
            phase: "playoff",
          });
          counter++;
        }
        let prevRoundStart = startIdx;
        let prevRoundSize = bracketSize / 2;
        for (let round = 2; round <= numRounds; round++) {
          const currentRoundSize = prevRoundSize / 2;
          for (let i = 0; i < currentRoundSize; i++) {
            const matchId = `${tournamentId}-m-${counter}`;
            allNew.push({
              id: matchId,
              tournamentId,
              round,
              matchNumber: counter,
              homeTeamId: null,
              awayTeamId: null,
              homeScore: null,
              awayScore: null,
              winnerId: null,
              status: "unscheduled",
              nextMatchId: null,
              phase: "playoff",
            });
            allNew[prevRoundStart + i * 2].nextMatchId = matchId;
            allNew[prevRoundStart + i * 2 + 1].nextMatchId = matchId;
            counter++;
          }
          prevRoundStart += prevRoundSize;
          prevRoundSize = currentRoundSize;
        }
      }

      if (allNew.length === 0) return false;
      const idMapping = await insertMatchesForPhase(allNew, tournamentId);
      // Swap temp ids for DB-generated ids before patching local state.
      // Re-key both id AND nextMatchId so the in-memory bracket links stay
      // valid (see generatePlayoffFixture for the same fix).
      const persisted = allNew.map((m) => ({
        ...m,
        id: idMapping[m.id] ?? m.id,
        nextMatchId: m.nextMatchId
          ? idMapping[m.nextMatchId] ?? m.nextMatchId
          : null,
      }));
      // Persist the chosen "ida y vuelta" at the tournament level so other
      // views (pending-matchups detection, future phase generation) stay
      // consistent. Mirrors what match-schedule.tsx already does.
      if (doubleRoundRobin !== undefined && doubleRoundRobin !== tournament.doubleRoundRobin) {
        await dbUpdateTournament(tournamentId, { doubleRoundRobin: drr });
      }
      setTournaments((prev) =>
        prev.map((t) =>
          t.id === tournamentId
            ? {
                ...t,
                matches: [...t.matches, ...persisted],
                doubleRoundRobin: drr,
              }
            : t
        )
      );
      return true;
    },
    []
  );

  const renameGroup = useCallback(
    async (tournamentId: string, groupId: string, name: string) => {
      const ok = await dbUpdateGroupName(groupId, name);
      if (!ok) return;
      // Optimistic update of just the matched group in the matched tournament.
      setTournaments((prev) =>
        prev.map((t) => {
          if (t.id !== tournamentId) return t;
          return {
            ...t,
            groups: t.groups?.map((g) => (g.id === groupId ? { ...g, name } : g)),
          };
        })
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

          // Find the match being updated (pre-change) so we can detect
          // whether it's the vuelta of a double-leg matchup before computing
          // the winner. For ida and single-leg matches the winner is just
          // who scored more; for vueltas we need the aggregate across both
          // legs because a tied vuelta can still have a clear matchup
          // winner from the ida.
          const targetMatch = t.matches.find((m) => m.id === matchId);
          const isDoubleLegContext =
            (t.format === "elimination" && t.doubleRoundRobin) ||
            (t.format === "group-playoff" && t.playoffDoubleLeg);
          const isVuelta =
            isDoubleLegContext &&
            targetMatch != null &&
            (targetMatch.phase === "playoff" || !targetMatch.phase) &&
            targetMatch.round % 2 === 0;

          // Find the ida that pairs with this vuelta (round - 1, sides
          // swapped). Used to compute the aggregate winner below.
          const idaMatch =
            isVuelta && targetMatch
              ? t.matches.find(
                  (m) =>
                    m.round === targetMatch.round - 1 &&
                    m.homeTeamId === targetMatch.awayTeamId &&
                    m.awayTeamId === targetMatch.homeTeamId
                )
              : undefined;

          const computeWinnerId = (m: typeof t.matches[number]): string | null => {
            // Vuelta of a double-leg matchup: use aggregate. Team that played
            // home in the ida totals idaHome + vueltaAway (because sides
            // swapped). Team that played away in the ida totals idaAway +
            // vueltaHome. Ties → null (organizer resolves manually).
            if (
              isVuelta &&
              idaMatch &&
              idaMatch.homeScore != null &&
              idaMatch.awayScore != null
            ) {
              const teamHomeIdaTotal = idaMatch.homeScore + awayScore;
              const teamAwayIdaTotal = idaMatch.awayScore + homeScore;
              if (teamHomeIdaTotal > teamAwayIdaTotal) return idaMatch.homeTeamId;
              if (teamAwayIdaTotal > teamHomeIdaTotal) return idaMatch.awayTeamId;
              return null;
            }
            // Single-leg / ida / non-bracket: per-match winner.
            return homeScore > awayScore
              ? m.homeTeamId
              : awayScore > homeScore
                ? m.awayTeamId
                : null;
          };

          const updatedMatches = t.matches.map((m) => {
            if (m.id !== matchId) return m;
            return {
              ...m,
              homeScore,
              awayScore,
              winnerId: computeWinnerId(m),
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

                // Double-leg mirror: nextMatch is the IDA of the next bracket
                // round. Its paired VUELTA (at nextMatch.round + 1, same
                // position when both rounds are sorted by matchNumber) is the
                // same matchup with sides swapped, so the winner that filled
                // ida.home must also fill vuelta.away (and vice versa). Without
                // this the vuelta of semis/final keeps null teams and the user
                // can never play it.
                const isDoubleLegBracket =
                  (t.format === "elimination" && t.doubleRoundRobin) ||
                  (t.format === "group-playoff" && t.playoffDoubleLeg);
                if (isDoubleLegBracket && completedMatch.phase === "playoff") {
                  const idaRoundMatches = updatedMatches
                    .filter(
                      (m) => m.phase === "playoff" && m.round === nextMatch.round
                    )
                    .sort((a, b) => a.matchNumber - b.matchNumber);
                  const pairPosition = idaRoundMatches.findIndex(
                    (m) => m.id === nextMatch.id
                  );
                  const vueltaRoundMatches = updatedMatches
                    .filter(
                      (m) =>
                        m.phase === "playoff" && m.round === nextMatch.round + 1
                    )
                    .sort((a, b) => a.matchNumber - b.matchNumber);
                  const pairedVuelta = vueltaRoundMatches[pairPosition];
                  if (pairedVuelta) {
                    const vueltaIdx = updatedMatches.findIndex(
                      (m) => m.id === pairedVuelta.id
                    );
                    if (vueltaIdx !== -1) {
                      // Sides are swapped in the vuelta relative to the ida.
                      const mirroredUpdates =
                        feederIndex === 0
                          ? { awayTeamId: completedMatch.winnerId }
                          : { homeTeamId: completedMatch.winnerId };
                      updatedMatches[vueltaIdx] = {
                        ...updatedMatches[vueltaIdx],
                        ...mirroredUpdates,
                      };
                      dbUpdateMatchDetails(pairedVuelta.id, mirroredUpdates);
                    }
                  }
                }
              }
            }
          }

          // For group-playoff: auto-fill playoff bracket when all group matches complete
          let groupStageComplete = t.groupStageComplete;
          let updatedPhaseConfigs = t.phaseConfigs ? [...t.phaseConfigs.map(pc => ({ ...pc }))] : undefined;
          let updatedGroups = t.groups;

          // Pieza D: when a phase of group play completes, the next phase's
          // groups/bracket are NO LONGER filled automatically. We only mark
          // the phase as complete and let the organizer configure the next
          // phase manually via the PhaseConfigDialog (button "Configurar
          // Fase X" in the corresponding tab). This applies to both
          // intermediate phases (→ next phase groups) and final ones
          // (→ playoff bracket). Single-phase group-playoff follows the
          // same flow: groupStageComplete=true triggers the dialog.
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
              if (!pc.nextGroupCount) {
                // Last group phase done → group stage of the tournament is
                // complete. Playoff bracket teams are assigned manually.
                groupStageComplete = true;
                dbUpdateTournament(t.id, { groupStageComplete: true });
              }

              // Persist phase config update
              dbUpdateTournament(t.id, { phaseConfigs: updatedPhaseConfigs });
              break; // Only process one phase at a time
            }
          } else if (t.format === "group-playoff" && !t.groupStageComplete) {
            // Single-phase group-playoff: when all group matches finish, mark
            // the stage complete. The user then configures the bracket via
            // the PhaseConfigDialog instead of auto-filling.
            const groupMatches = updatedMatches.filter((m) => m.phase === "group");
            const allGroupsDone =
              groupMatches.length > 0 && groupMatches.every((m) => m.status === "completed");
            if (allGroupsDone) {
              groupStageComplete = true;
              dbUpdateTournament(t.id, { groupStageComplete: true });
            }
          }

          // Check if all matches are completed. For group-playoff and
          // elimination, the tournament is "completed" when the final SERIES
          // has a champion (Pieza I helper handles single / double_leg /
          // best-of-N). Other formats fall back to "every match completed".
          let allCompleted: boolean;
          if (t.format === "group-playoff" || t.format === "elimination") {
            const champion = getFinalSeriesChampion({
              ...t,
              matches: updatedMatches,
            });
            allCompleted = champion != null;
          } else {
            allCompleted = updatedMatches.every(
              (m) => m.status === "completed"
            );
          }
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

      // Persist the match result to DB. For double-leg vueltas the winnerId
      // is the aggregate winner (same logic as the in-memory branch above).
      const tournament = tournaments.find((t) => t.id === tournamentId);
      const match = tournament?.matches.find((m) => m.id === matchId);
      const isDoubleLegContextDb =
        match &&
        ((tournament?.format === "elimination" && tournament.doubleRoundRobin) ||
          (tournament?.format === "group-playoff" && tournament.playoffDoubleLeg));
      const isVueltaDb =
        !!isDoubleLegContextDb &&
        !!match &&
        (match.phase === "playoff" || !match.phase) &&
        match.round % 2 === 0;
      const idaForVuelta = isVueltaDb
        ? tournament?.matches.find(
            (m) =>
              m.round === match!.round - 1 &&
              m.homeTeamId === match!.awayTeamId &&
              m.awayTeamId === match!.homeTeamId
          )
        : undefined;
      const winnerId = (() => {
        if (
          isVueltaDb &&
          idaForVuelta &&
          idaForVuelta.homeScore != null &&
          idaForVuelta.awayScore != null
        ) {
          const teamHomeIdaTotal = idaForVuelta.homeScore + awayScore;
          const teamAwayIdaTotal = idaForVuelta.awayScore + homeScore;
          if (teamHomeIdaTotal > teamAwayIdaTotal) return idaForVuelta.homeTeamId;
          if (teamAwayIdaTotal > teamHomeIdaTotal) return idaForVuelta.awayTeamId;
          return null;
        }
        return homeScore > awayScore
          ? match?.homeTeamId ?? null
          : awayScore > homeScore
            ? match?.awayTeamId ?? null
            : null;
      })();

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

  // Applies a Realtime-sourced patch to the local match without touching DB.
  // Used by tournament-detail's subscription so that scorer-link updates
  // (and any other concurrent writer) reflect in the UI without reload.
  const applyExternalMatchUpdate = useCallback(
    (tournamentId: string, matchId: string, patch: Partial<Match>) => {
      setTournaments((prev) =>
        prev.map((t) =>
          t.id === tournamentId
            ? {
                ...t,
                matches: t.matches.map((m) =>
                  m.id === matchId ? { ...m, ...patch } : m
                ),
              }
            : t
        )
      );
    },
    []
  );

  const value = useMemo(
    () => ({
      tournaments,
      teams,
      isLoading,
      teamsLoading,
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
      renameGroup,
      configurePhaseGroups,
      configurePlayoffFinal,
      generatePlayoffFixture,
      configureBracketSlots,
      generatePhaseMatches,
      updateTeamPlayers,
      updateTeam,
      updateEventPaid,
      assignTeamsToGroupFn,
      addMatchesToTournament,
      updateMatch,
      applyExternalMatchUpdate,
      getTournamentById,
      getTeamById,
      getFilteredTournaments,
      refetch,
    }),
    [
      tournaments,
      teams,
      isLoading,
      teamsLoading,
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
      renameGroup,
      configurePhaseGroups,
      configurePlayoffFinal,
      generatePlayoffFixture,
      configureBracketSlots,
      generatePhaseMatches,
      updateTeamPlayers,
      updateTeam,
      updateEventPaid,
      assignTeamsToGroupFn,
      addMatchesToTournament,
      updateMatch,
      applyExternalMatchUpdate,
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
