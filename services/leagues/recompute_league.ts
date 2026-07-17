import { supabase } from '@/lib/supabaseClient';
import {
  applyMatchToPlayerMap,
  applyMatchToPairMap,
  emptyPlayerStats,
  teamsFromMatchParticipants,
  PlayerStatRow,
} from '@/services/leagues/match_engine';
import {
  PairStatRow,
  resetLeaguePairRatings,
  upsertPairStats,
} from '@/services/leagues/pair_ratings';

/** Přepočítá všechny statistiky ligy od nuly podle historie zápasů (chronologicky). */
export async function recomputeLeagueStats(leagueId: number) {
  const { data: league, error: leagueError } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single();
  if (leagueError || !league) throw new Error('League not found');

  const { data: matches, error: matchesError } = await supabase
    .from('league_matches')
    .select('*, league_match_participants(*)')
    .eq('league_id', leagueId)
    .order('played_at', { ascending: true })
    .order('id', { ascending: true });
  if (matchesError) throw matchesError;

  const { data: existingPlayers, error: playersError } = await supabase
    .from('league_players')
    .select('*')
    .eq('league_id', leagueId);
  if (playersError) throw playersError;

  const trackElo = !!league.config?.track_elo;
  const playerStatsMap = new Map<string, PlayerStatRow>();
  const pairStatsMap = new Map<string, PairStatRow>();

  for (const p of existingPlayers || []) {
    const empty = emptyPlayerStats(String(p.user_id), trackElo);
    empty.id = p.id;
    playerStatsMap.set(String(p.user_id), empty);
  }

  await resetLeaguePairRatings(leagueId);

  for (const match of matches || []) {
    const participants = match.league_match_participants || [];
    for (const part of participants) {
      const uid = String(part.user_id);
      if (!playerStatsMap.has(uid)) {
        playerStatsMap.set(uid, emptyPlayerStats(uid, trackElo));
      }
    }

    const teams = teamsFromMatchParticipants(participants);
    teams.sort((a, b) => a.team_index - b.team_index);

    const { ratingChanges } = applyMatchToPlayerMap(
      league,
      teams,
      match.metadata,
      playerStatsMap
    );

    if (league.team_size > 1) {
      applyMatchToPairMap(league, teams, match.metadata, pairStatsMap);
    }

    for (const part of participants) {
      const change = ratingChanges.get(String(part.user_id)) || 0;
      await supabase
        .from('league_match_participants')
        .update({ rating_change: change })
        .eq('id', part.id);
    }
  }

  for (const stats of playerStatsMap.values()) {
    const payload = {
      rating: stats.rating,
      matches_played: stats.matches_played,
      wins: stats.wins,
      losses: stats.losses,
      draws: stats.draws,
      first_places: stats.first_places,
      second_places: stats.second_places,
      third_places: stats.third_places,
      total_score: stats.total_score,
      score_for: stats.score_for,
      score_against: stats.score_against,
      score_diff: stats.score_diff,
    };

    if (stats.id) {
      await supabase.from('league_players').update(payload).eq('id', stats.id);
    } else {
      const { data: inserted } = await supabase
        .from('league_players')
        .insert([{ league_id: leagueId, user_id: stats.user_id, ...payload }])
        .select()
        .single();
      if (inserted) stats.id = inserted.id;
    }
  }

  if (pairStatsMap.size > 0) {
    await upsertPairStats(leagueId, Array.from(pairStatsMap.values()));
  }

  await supabase
    .from('leagues')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', leagueId);

  return true;
}

export async function deleteMatch(matchId: number, leagueId: number) {
  const { error } = await supabase.from('league_matches').delete().eq('id', matchId);
  if (error) throw error;
  await recomputeLeagueStats(leagueId);
}
