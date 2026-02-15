import { supabase } from "@/lib/supabase";
import { Match, MatchEvent, VolleyballSet } from "@/types";
import { toDbMatch, toDbMatchEvent, toDbVolleyballSet } from "./mappers";

export async function createMatch(match: Match): Promise<string | null> {
  const dbData = toDbMatch(match);
  const { data, error } = await supabase
    .from("matches")
    .insert(dbData)
    .select("id")
    .single();

  if (error || !data) return null;
  return data.id as string;
}

export async function createMatches(
  matches: Match[],
  tournamentId: string
): Promise<boolean> {
  if (matches.length === 0) return true;

  // We need to insert matches in order to resolve nextMatchId references.
  // First pass: insert all matches without nextMatchId
  const idMapping: Record<string, string> = {};

  // Insert matches without next_match_id first
  for (const match of matches) {
    const dbData = toDbMatch({ ...match, tournamentId });
    // Temporarily set next_match_id to null
    dbData.next_match_id = null;

    const { data, error } = await supabase
      .from("matches")
      .insert(dbData)
      .select("id")
      .single();

    if (error || !data) return false;
    idMapping[match.id] = data.id as string;
  }

  // Second pass: update nextMatchId references
  for (const match of matches) {
    if (match.nextMatchId && idMapping[match.nextMatchId]) {
      await supabase
        .from("matches")
        .update({ next_match_id: idMapping[match.nextMatchId] })
        .eq("id", idMapping[match.id]);
    }

    // Also update group_id if it references a frontend group id
    // (group_id is already a UUID from the DB insert in createTournament)
  }

  return true;
}

export async function bulkUpsertMatches(
  matches: Match[],
  tournamentId: string
): Promise<boolean> {
  // Delete existing matches for this tournament
  await supabase.from("matches").delete().eq("tournament_id", tournamentId);

  if (matches.length === 0) return true;
  return createMatches(matches, tournamentId);
}

export async function updateMatchResult(
  matchId: string,
  homeScore: number,
  awayScore: number,
  winnerId: string | null,
  events?: MatchEvent[],
  sets?: VolleyballSet[]
): Promise<boolean> {
  const { error } = await supabase
    .from("matches")
    .update({
      home_score: homeScore,
      away_score: awayScore,
      winner_id: winnerId,
      status: "completed",
    })
    .eq("id", matchId);

  if (error) return false;

  // Replace events
  if (events !== undefined) {
    await supabase.from("match_events").delete().eq("match_id", matchId);
    if (events.length > 0) {
      await supabase
        .from("match_events")
        .insert(events.map((e) => toDbMatchEvent({ ...e, matchId })));
    }
  }

  // Replace sets
  if (sets !== undefined) {
    await supabase.from("volleyball_sets").delete().eq("match_id", matchId);
    if (sets.length > 0) {
      await supabase
        .from("volleyball_sets")
        .insert(sets.map((s) => toDbVolleyballSet(matchId, s)));
    }
  }

  return true;
}

export async function updateMatchDetails(
  matchId: string,
  updates: Partial<
    Pick<
      Match,
      | "homeTeamId"
      | "awayTeamId"
      | "date"
      | "time"
      | "venue"
      | "status"
      | "postponedReason"
      | "homeScore"
      | "awayScore"
      | "winnerId"
    >
  >
): Promise<boolean> {
  const dbUpdates = toDbMatch(updates);
  const { error } = await supabase
    .from("matches")
    .update(dbUpdates)
    .eq("id", matchId);

  return !error;
}

export async function deleteMatch(matchId: string): Promise<boolean> {
  const { error } = await supabase.from("matches").delete().eq("id", matchId);
  return !error;
}

export async function updateEventPaid(
  eventId: string,
  paid: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from("match_events")
    .update({ paid })
    .eq("id", eventId);

  return !error;
}
