import { supabase } from '@/lib/supabaseClient';

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
}

export const submitMatch = async (data: SubmitMatchData) => {
  // 1. Fetch league
  const { data: league } = await supabase.from('leagues').select('*').eq('id', data.league_id).single();
  if (!league) throw new Error('League not found');

  // 2. Extract all user_ids
  const allUserIds = data.teams.flatMap(t => t.user_ids);
  
  // Fetch their current stats
  const { data: playersInfo } = await supabase
    .from('league_players')
    .select('*')
    .eq('league_id', data.league_id)
    .in('user_id', allUserIds);

  if (!playersInfo) throw new Error('Could not fetch players');

  const playerStatsMap = new Map(playersInfo.map(p => [p.user_id, p]));

  // Pokud někdo v lize ještě není, přidáme ho
  for (const userId of allUserIds) {
      if (!playerStatsMap.has(userId)) {
          const newPlayer = {
              league_id: data.league_id,
              user_id: userId,
              rating: league.config?.track_elo ? 1500 : 0
          };
          const { data: inserted, error } = await supabase.from('league_players').insert(newPlayer).select().single();
          if (error) throw error;
          playerStatsMap.set(userId, inserted);
      }
  }

  // 3. Create match entry
  const { data: matchEntry, error: matchError } = await supabase
    .from('league_matches')
    .insert([{
      league_id: data.league_id,
      created_by: data.created_by,
      metadata: data.metadata
    }])
    .select()
    .single();

  if (matchError) throw matchError;

  const participantsToInsert: any[] = [];
  const playerUpdates: any[] = [];

  const config = league.config || {};

  // ELO calculation
  let team1Change = 0;
  let team2Change = 0;
  const ffaRatingChanges = new Map<number, number>();

  if (config.track_elo) {
      if (league.team_size > 0 && data.teams.length === 2) {
          // Standardní 1v1 nebo 2v2
          const team1 = data.teams[0];
          const team2 = data.teams[1];

          const r1 = team1.user_ids.reduce((sum, uid) => sum + (playerStatsMap.get(uid)?.rating || 1500), 0) / (team1.user_ids.length || 1);
          const r2 = team2.user_ids.reduce((sum, uid) => sum + (playerStatsMap.get(uid)?.rating || 1500), 0) / (team2.user_ids.length || 1);

          const e1 = 1 / (1 + Math.pow(10, (r2 - r1) / 400));
          const e2 = 1 / (1 + Math.pow(10, (r1 - r2) / 400));

          let s1 = team1.is_draw ? 0.5 : (team1.is_winner ? 1 : 0);
          let s2 = team2.is_draw ? 0.5 : (team2.is_winner ? 1 : 0);

          const K = 32;
          team1Change = K * (s1 - e1);
          team2Change = K * (s2 - e2);
      } else if (league.team_size === 0) {
        if (config.lower_is_better) {
          data.teams.sort((a, b) => a.score - b.score);
        } else {
          data.teams.sort((a, b) => b.score - a.score);
        }
        
        let currentPos = 1;
        let prevScore = data.teams[0].score;
        
        data.teams.forEach((t, i) => {
          if (config.lower_is_better) {
            if (t.score > prevScore) {
              currentPos++; // Dense ranking
              prevScore = t.score;
            }
          } else {
            if (t.score < prevScore) {
              currentPos++; // Dense ranking
              prevScore = t.score;
            }
          }
          t.position = currentPos;
          t.is_winner = t.position === 1;
          t.is_draw = false;
        });
      }
      
      if (league.team_size === 0 && data.teams.length > 1) {
          // Multiplayer ELO pro FFA
          const K = 32;
          const N = data.teams.length;
          
          data.teams.forEach(teamA => {
              let totalChange = 0;
              const rA = teamA.user_ids.reduce((sum, uid) => sum + (playerStatsMap.get(uid)?.rating || 1500), 0) / (teamA.user_ids.length || 1);
              
              data.teams.forEach(teamB => {
                  if (teamA.team_index === teamB.team_index) return;
                  
                  const rB = teamB.user_ids.reduce((sum, uid) => sum + (playerStatsMap.get(uid)?.rating || 1500), 0) / (teamB.user_ids.length || 1);
                  const eA = 1 / (1 + Math.pow(10, (rB - rA) / 400));
                  
                  let sA = 0.5;
                  if (config.lower_is_better) {
                      if (teamA.score < teamB.score) sA = 1;
                      else if (teamA.score > teamB.score) sA = 0;
                  } else {
                      if (teamA.score > teamB.score) sA = 1;
                      else if (teamA.score < teamB.score) sA = 0;
                  }
                  
                  totalChange += K * (sA - eA);
              });
              
              ffaRatingChanges.set(teamA.team_index, totalChange / (N - 1));
          });
      }
  }

  // Calculate against score for exactly 2 teams
  const getAgainstScore = (myTeamIndex: number) => {
      if (data.teams.length !== 2) return 0;
      return data.teams.find(t => t.team_index !== myTeamIndex)?.score || 0;
  };

  // Process all participants
  data.teams.forEach((team, idx) => {
    const scoreFor = team.score || 0;
    const scoreAgainst = getAgainstScore(team.team_index);
    const scoreDiff = scoreFor - scoreAgainst;

    let ratingChange = 0;
    if (config.track_elo) {
        if (league.team_size > 0 && data.teams.length === 2) {
            ratingChange = idx === 0 ? team1Change : team2Change;
        } else if (league.team_size === 0) {
            ratingChange = ffaRatingChanges.get(team.team_index) || 0;
        }
    }

    team.user_ids.forEach(userId => {
        const stats = playerStatsMap.get(userId);
        if (!stats) return;

        participantsToInsert.push({
            match_id: matchEntry.id,
            user_id: userId,
            team: team.team_index,
            score: scoreFor,
            rating_change: ratingChange,
            position: team.position || null,
            is_winner: team.is_winner
        });

        // Calculate updates
        let baseRating = stats.rating;
        if (config.track_elo && (baseRating === 0 || baseRating === null)) {
            baseRating = 1500;
        }
        let newRating = (baseRating || 0) + ratingChange;
        let newTotalScore = (stats.total_score || 0) + scoreFor;
        let newMatchesPlayed = (stats.matches_played || 0) + 1;
        let newWins = stats.wins || 0;
        let newLosses = stats.losses || 0;
        let newDraws = stats.draws || 0;
        let newFirstPlaces = stats.first_places || 0;
        let newSecondPlaces = stats.second_places || 0;
        let newThirdPlaces = stats.third_places || 0;

        if (config.track_wins_losses) {
            if (team.is_draw) newDraws++;
            else if (team.is_winner) newWins++;
            else newLosses++;
        }
        
        if (team.position === 1) newFirstPlaces++;
        else if (team.position === 2) newSecondPlaces++;
        else if (team.position === 3) newThirdPlaces++;

        playerUpdates.push({
            id: stats.id,
            rating: newRating,
            matches_played: newMatchesPlayed,
            wins: newWins,
            losses: newLosses,
            draws: newDraws,
            first_places: newFirstPlaces,
            second_places: newSecondPlaces,
            third_places: newThirdPlaces,
            total_score: newTotalScore,
            score_for: (stats.score_for || 0) + (config.track_score ? scoreFor : 0),
            score_against: (stats.score_against || 0) + (config.track_score ? scoreAgainst : 0),
            score_diff: (stats.score_diff || 0) + (config.track_score_diff ? scoreDiff : 0),
        });
    });
  });

  if (participantsToInsert.length > 0) {
    await supabase.from('league_match_participants').insert(participantsToInsert);
  }

  for (const update of playerUpdates) {
    await supabase.from('league_players').update(update).eq('id', update.id);
  }

  return matchEntry;
};
