import { supabase } from '@/lib/supabaseClient';

export interface League {
  id: number;
  name: string;
  sport_id: string;
  team_size: number;
  scoring_type: string;
  config: any;
  is_global: boolean;
  created_by: string | null;
  created_at: string;
  updated_at?: string;
}

export interface LeaguePlayer {
  id: number;
  league_id: number;
  user_id: string;
  rating: number;
  matches_played: number;
  wins: number;
  losses: number;
  draws: number;
  total_score: number;
  score_for: number;
  score_against: number;
  score_diff: number;
  users?: {
    username: string;
    jmeno: string;
    prijmeni: string;
  };
}

export const fetchMyLeagues = async (userId: string) => {
  // Všechny ligy jsou nyní globální, načteme prostě vše
  const { data, error } = await supabase.from('leagues').select('*');

  if (error) {
    console.error('Error fetching leagues:', error);
    return [];
  }

  console.log('Fetched leagues count:', data?.length);
  return data as League[];
};

export const fetchLeagueDetails = async (leagueId: number) => {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single();

  if (error) throw error;
  return data as League;
};

export const fetchLeagueLeaderboard = async (leagueId: number) => {
  const { data, error } = await supabase
    .from('league_players')
    .select('*, users(username, jmeno, prijmeni)')
    .eq('league_id', leagueId);

  if (error) throw error;
  return data as LeaguePlayer[];
};

export const fetchLeagueMatches = async (leagueId: number) => {
  const { data, error } = await supabase
    .from('league_matches')
    .select('*, league_match_participants(*, users(username, jmeno))')
    .eq('league_id', leagueId)
    .order('played_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const createLeague = async (leagueData: {
  name: string;
  sport_id: string;
  team_size: number;
  scoring_type: string;
  config: any;
  created_by: string;
}) => {
  const { data, error } = await supabase
    .from('leagues')
    .insert([{ ...leagueData, is_global: true }])
    .select()
    .single();

  if (error) throw error;
  
  // Zakladatel se rovnou přidá do ligy
  await joinLeague(data.id, leagueData.created_by);

  return data as League;
};

const joinLeague = async (leagueId: number, userId: string) => {
  // Pro jistotu zkontrolujeme, zda už tam není
  const { data: existing } = await supabase
    .from('league_players')
    .select('id')
    .eq('league_id', leagueId)
    .eq('user_id', userId)
    .single();

  if (existing) return;

  // Rating default: 1500 pro ELO, jinak 0
  const { data: league } = await supabase.from('leagues').select('scoring_type').eq('id', leagueId).single();
  const defaultRating = league?.scoring_type === 'elo' ? 1500 : 0;

  const { error } = await supabase
    .from('league_players')
    .insert([{
      league_id: leagueId,
      user_id: userId,
      rating: defaultRating
    }]);

  if (error) throw error;
};
