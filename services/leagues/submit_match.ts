import { supabase } from '@/lib/supabaseClient';
import {
  applyMatchToPlayerMap,
  applyMatchToPairMap,
  emptyPlayerStats,
  PlayerStatRow,
} from '@/services/leagues/match_engine';
import {
  emptyPairStats,
  fetchLeaguePairRatings,
  makePairKey,
  PairStatRow,
  upsertPairStats,
} from '@/services/leagues/pair_ratings';

export interface SubmitMatchData {
  league_id: number;
  created_by: string;
  metadata?: any;
  teams: {
    team_index: number;
    user_ids: string[];
    score: number;
    is_winner: boolean;
    is_draw: boolean;
    position?: number;
  }[];
  /** Pokud je nastaveno, přepíše existující zápas a přepočítá ligu. */
  replace_match_id?: number;
}

export const submitMatch = async (data: SubmitMatchData) => {
  const { data: league } = await supabase.from('leagues').select('*').eq('id', data.league_id).single();
  if (!league) throw new Error('League not found');

  // Edit: smaž starý zápas, založ nový, pak plný přepočet
  if (data.replace_match_id) {
    const { error: delError } = await supabase
      .from('league_matches')
      .delete()
      .eq('id', data.replace_match_id);
    if (delError) throw delError;
  }

  const allUserIds = data.teams.flatMap((t) => t.user_ids);

  const { data: playersInfo } = await supabase
    .from('league_players')
    .select('*')
    .eq('league_id', data.league_id)
    .in('user_id', allUserIds);

  if (!playersInfo) throw new Error('Could not fetch players');

  const playerStatsMap = new Map<string, PlayerStatRow>();
  for (const p of playersInfo) {
    playerStatsMap.set(String(p.user_id), {
      id: p.id,
      user_id: String(p.user_id),
      rating: p.rating,
      matches_played: p.matches_played || 0,
      wins: p.wins || 0,
      losses: p.losses || 0,
      draws: p.draws || 0,
      first_places: p.first_places || 0,
      second_places: p.second_places || 0,
      third_places: p.third_places || 0,
      total_score: p.total_score || 0,
      score_for: p.score_for || 0,
      score_against: p.score_against || 0,
      score_diff: p.score_diff || 0,
    });
  }

  for (const userId of allUserIds) {
    if (!playerStatsMap.has(String(userId))) {
      const newPlayer = {
        league_id: data.league_id,
        user_id: userId,
        rating: league.config?.track_elo ? 1500 : 0,
      };
      const { data: inserted, error } = await supabase
        .from('league_players')
        .insert(newPlayer)
        .select()
        .single();
      if (error) throw error;
      const empty = emptyPlayerStats(String(userId), !!league.config?.track_elo);
      empty.id = inserted.id;
      playerStatsMap.set(String(userId), empty);
    }
  }

  // Při editaci vždy přepočítáme celou ligu (kvůli ELO pořadí)
  if (data.replace_match_id) {
    const { data: matchEntry, error: matchError } = await supabase
      .from('league_matches')
      .insert([
        {
          league_id: data.league_id,
          created_by: data.created_by,
          metadata: data.metadata,
        },
      ])
      .select()
      .single();
    if (matchError) throw matchError;

    const participantsToInsert = data.teams.flatMap((team) =>
      team.user_ids.map((userId) => ({
        match_id: matchEntry.id,
        user_id: userId,
        team: team.team_index,
        score: team.score || 0,
        rating_change: 0,
        position: team.position || null,
        is_winner: team.is_winner,
      }))
    );
    if (participantsToInsert.length) {
      await supabase.from('league_match_participants').insert(participantsToInsert);
    }

    const { recomputeLeagueStats } = await import('@/services/leagues/recompute_league');
    await recomputeLeagueStats(data.league_id);
    return matchEntry;
  }

  // Snapshot statistik před zápasem pro inkrementální update
  const before = new Map(
    Array.from(playerStatsMap.entries()).map(([k, v]) => [k, { ...v }])
  );

  const { ratingChanges } = applyMatchToPlayerMap(
    league,
    data.teams,
    data.metadata,
    playerStatsMap
  );

  // Samostatné ELO sestav (čtyřhra / NvN)
  const pairStatsMap = new Map<string, PairStatRow>();
  if (league.team_size > 1) {
    try {
      const existingPairs = await fetchLeaguePairRatings(data.league_id);
      for (const row of existingPairs) {
        pairStatsMap.set(row.pair_key, { ...row });
      }
    } catch (e) {
      console.error('Pair ratings unavailable, continuing without pair ELO:', e);
    }
    for (const team of data.teams) {
      if (team.user_ids.length >= 2) {
        const key = makePairKey(team.user_ids);
        if (!pairStatsMap.has(key)) {
          pairStatsMap.set(key, emptyPairStats(key, !!league.config?.track_elo));
        }
      }
    }
    if (pairStatsMap.size > 0) {
      applyMatchToPairMap(league, data.teams, data.metadata, pairStatsMap);
    }
  }

  const { data: matchEntry, error: matchError } = await supabase
    .from('league_matches')
    .insert([
      {
        league_id: data.league_id,
        created_by: data.created_by,
        metadata: data.metadata,
      },
    ])
    .select()
    .single();
  if (matchError) throw matchError;

  const participantsToInsert: any[] = [];
  data.teams.forEach((team) => {
    team.user_ids.forEach((userId) => {
      participantsToInsert.push({
        match_id: matchEntry.id,
        user_id: userId,
        team: team.team_index,
        score: team.score || 0,
        rating_change: ratingChanges.get(String(userId)) || 0,
        position: team.position || null,
        is_winner: team.is_winner,
      });
    });
  });

  if (participantsToInsert.length > 0) {
    await supabase.from('league_match_participants').insert(participantsToInsert);
  }

  for (const [userId, stats] of playerStatsMap.entries()) {
    if (!allUserIds.map(String).includes(userId)) continue;
    const prev = before.get(userId);
    if (!prev?.id && !stats.id) continue;
    await supabase
      .from('league_players')
      .update({
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
      })
      .eq('id', stats.id || prev?.id);
  }

  if (pairStatsMap.size > 0) {
    // Uložit jen sestavy z tohoto zápasu
    const touchedKeys = new Set(
      data.teams
        .filter((t) => t.user_ids.length >= 2)
        .map((t) => makePairKey(t.user_ids))
    );
    await upsertPairStats(
      data.league_id,
      Array.from(pairStatsMap.values()).filter((r) => touchedKeys.has(r.pair_key))
    );
  }

  await supabase
    .from('leagues')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', data.league_id);

  return matchEntry;
};
