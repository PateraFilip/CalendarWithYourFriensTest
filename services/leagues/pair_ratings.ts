import { supabase } from '@/lib/supabaseClient';

/** Stabilní klíč sestavy (seřazená UUID hráčů). */
export function makePairKey(userIds: string[]): string {
  return [...userIds].map(String).sort().join('_');
}

export type PairStatRow = {
  id?: number;
  league_id?: number;
  pair_key: string;
  rating: number;
  matches_played: number;
  wins: number;
  losses: number;
  draws: number;
  score_for: number;
  score_against: number;
  score_diff: number;
  last_rating_change: number;
};

export function emptyPairStats(pairKey: string, trackElo: boolean): PairStatRow {
  return {
    pair_key: pairKey,
    rating: trackElo ? 1500 : 0,
    matches_played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    score_for: 0,
    score_against: 0,
    score_diff: 0,
    last_rating_change: 0,
  };
}

export async function fetchLeaguePairRatings(leagueId: number): Promise<PairStatRow[]> {
  const { data, error } = await supabase
    .from('league_pair_ratings')
    .select('*')
    .eq('league_id', leagueId);

  if (error) {
    console.error('fetchLeaguePairRatings:', error.message);
    throw new Error(
      error.message.includes('does not exist')
        ? 'Tabulka league_pair_ratings chybí — spusť migraci 20260717_league_pair_ratings.sql'
        : error.message
    );
  }
  return (data || []) as PairStatRow[];
}

export async function upsertPairStats(leagueId: number, rows: PairStatRow[]) {
  for (const row of rows) {
    const payload = {
      league_id: leagueId,
      pair_key: row.pair_key,
      rating: row.rating,
      matches_played: row.matches_played,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      score_for: row.score_for,
      score_against: row.score_against,
      score_diff: row.score_diff,
      last_rating_change: row.last_rating_change,
      updated_at: new Date().toISOString(),
    };

    if (row.id) {
      await supabase.from('league_pair_ratings').update(payload).eq('id', row.id);
    } else {
      const { data } = await supabase
        .from('league_pair_ratings')
        .upsert(payload, { onConflict: 'league_id,pair_key' })
        .select()
        .single();
      if (data) row.id = data.id;
    }
  }
}

export async function resetLeaguePairRatings(leagueId: number) {
  const { error } = await supabase.from('league_pair_ratings').delete().eq('league_id', leagueId);
  if (error) {
    console.error('resetLeaguePairRatings:', error.message);
  }
}
