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
  first_places?: number;
  second_places?: number;
  third_places?: number;
  users?: {
    username: string;
    jmeno: string;
    prijmeni: string;
  };
}

/** Já + přátelé + přátelé přátel */
export async function fetchNetworkIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_extended_network_ids', {
    p_user_id: userId,
  });
  if (error) {
    console.error('get_extended_network_ids:', error.message);
    return [userId];
  }
  const ids = (data || [])
    .map((r: any) => (typeof r === 'string' ? r : r.u_id))
    .filter(Boolean)
    .map(String);
  if (!ids.includes(String(userId))) ids.push(String(userId));
  return ids;
}

export const fetchMyLeagues = async (userId: string) => {
  const networkIds = await fetchNetworkIds(String(userId));

  const { data: allLeagues, error } = await supabase.from('leagues').select('*');
  if (error) {
    console.error('Error fetching leagues:', error);
    return [];
  }

  const { data: myParticipations } = await supabase
    .from('league_players')
    .select('league_id')
    .eq('user_id', String(userId));
  const myLeagueIds = new Set((myParticipations || []).map((p) => Number(p.league_id)));

  const { data: networkPlayers } = await supabase
    .from('league_players')
    .select('league_id, user_id')
    .in('user_id', networkIds);
  const leaguesWithNetworkPlayer = new Set(
    (networkPlayers || []).map((p) => Number(p.league_id))
  );

  const networkSet = new Set(networkIds.map(String));

  // Viditelné: moje / od někoho ze sítě (FoF) / kde hraje někdo ze sítě / seed globální tabulky
  const refined = (allLeagues || []).filter((league: League) => {
    if (myLeagueIds.has(Number(league.id))) return true;
    if (league.created_by && networkSet.has(String(league.created_by))) return true;
    if (leaguesWithNetworkPlayer.has(Number(league.id))) return true;
    if (league.is_global && !league.created_by) return true;
    return false;
  });

  return refined as League[];
};

export async function canViewLeague(leagueId: number, userId: string): Promise<boolean> {
  const leagues = await fetchMyLeagues(userId);
  return leagues.some((l) => Number(l.id) === Number(leagueId));
}

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
    .insert([{ ...leagueData, is_global: false }])
    .select()
    .single();

  if (error) throw error;

  await joinLeague(data.id, leagueData.created_by, !!leagueData.config?.track_elo);

  return data as League;
};

const joinLeague = async (leagueId: number, userId: string, trackElo?: boolean) => {
  const { data: existing } = await supabase
    .from('league_players')
    .select('id')
    .eq('league_id', leagueId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) return;

  let useElo = trackElo;
  if (useElo === undefined) {
    const { data: league } = await supabase
      .from('leagues')
      .select('config')
      .eq('id', leagueId)
      .single();
    useElo = !!league?.config?.track_elo;
  }

  const { error } = await supabase.from('league_players').insert([
    {
      league_id: leagueId,
      user_id: userId,
      rating: useElo ? 1500 : 0,
    },
  ]);

  if (error) throw error;
};
