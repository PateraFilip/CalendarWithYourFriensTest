import { eloActualFromSetsAndGames, MatchSetsMetadata } from '@/services/leagues/match_sets';
import { emptyPairStats, makePairKey, PairStatRow } from '@/services/leagues/pair_ratings';

export type MatchTeamInput = {
  team_index: number;
  user_ids: string[];
  score: number;
  is_winner: boolean;
  is_draw: boolean;
  position?: number;
};

export type PlayerStatRow = {
  id?: number;
  user_id: string;
  rating: number;
  matches_played: number;
  wins: number;
  losses: number;
  draws: number;
  first_places: number;
  second_places: number;
  third_places: number;
  total_score: number;
  score_for: number;
  score_against: number;
  score_diff: number;
  best_score?: number | null;
  sets_won?: number;
  sets_lost?: number;
  games_for?: number;
  games_against?: number;
};

/** Aplikuje jeden zápas na in-memory mapu statistik hráčů. */
export function applyMatchToPlayerMap(
  league: { team_size: number; config?: any },
  teams: MatchTeamInput[],
  metadata: any,
  playerStatsMap: Map<string, PlayerStatRow>
): { ratingChanges: Map<string, number> } {
  const config = league.config || {};
  const teamsCopy: MatchTeamInput[] = teams.map((t) => ({ ...t, user_ids: [...t.user_ids] }));
  const setsMeta =
    metadata?.scoring_mode === 'sets' ? (metadata as MatchSetsMetadata) : null;

  let team1Change = 0;
  let team2Change = 0;
  const ffaRatingChanges = new Map<number, number>();

  if (config.track_elo) {
    if (league.team_size > 0 && teamsCopy.length === 2) {
      const team1 = teamsCopy[0];
      const team2 = teamsCopy[1];
      const r1 =
        team1.user_ids.reduce((sum, uid) => sum + (playerStatsMap.get(uid)?.rating || 1500), 0) /
        (team1.user_ids.length || 1);
      const r2 =
        team2.user_ids.reduce((sum, uid) => sum + (playerStatsMap.get(uid)?.rating || 1500), 0) /
        (team2.user_ids.length || 1);

      const e1 = 1 / (1 + Math.pow(10, (r2 - r1) / 400));
      const e2 = 1 / (1 + Math.pow(10, (r1 - r2) / 400));

      let s1 = team1.is_draw ? 0.5 : team1.is_winner ? 1 : 0;
      let s2 = team2.is_draw ? 0.5 : team2.is_winner ? 1 : 0;

      if (setsMeta) {
        const eloS = eloActualFromSetsAndGames(
          setsMeta.sets_won.team1,
          setsMeta.sets_won.team2,
          setsMeta.games.team1,
          setsMeta.games.team2
        );
        s1 = eloS.s1;
        s2 = eloS.s2;
      }

      const K = 32;
      team1Change = K * (s1 - e1);
      team2Change = K * (s2 - e2);
    } else if (league.team_size === 0 && teamsCopy.length > 0) {
      if (config.lower_is_better) {
        teamsCopy.sort((a, b) => a.score - b.score);
      } else {
        teamsCopy.sort((a, b) => b.score - a.score);
      }

      let currentPos = 1;
      let prevScore = teamsCopy[0].score;
      teamsCopy.forEach((t) => {
        if (config.lower_is_better) {
          if (t.score > prevScore) {
            currentPos++;
            prevScore = t.score;
          }
        } else if (t.score < prevScore) {
          currentPos++;
          prevScore = t.score;
        }
        t.position = currentPos;
        t.is_winner = t.position === 1;
        t.is_draw = false;
      });

      if (teamsCopy.length > 1) {
        const K = 32;
        const N = teamsCopy.length;
        teamsCopy.forEach((teamA) => {
          let totalChange = 0;
          const rA =
            teamA.user_ids.reduce((sum, uid) => sum + (playerStatsMap.get(uid)?.rating || 1500), 0) /
            (teamA.user_ids.length || 1);
          teamsCopy.forEach((teamB) => {
            if (teamA.team_index === teamB.team_index) return;
            const rB =
              teamB.user_ids.reduce((sum, uid) => sum + (playerStatsMap.get(uid)?.rating || 1500), 0) /
              (teamB.user_ids.length || 1);
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
  }

  const getScoreFor = (teamIndex: number) => {
    if (setsMeta) {
      return teamIndex === 1 ? setsMeta.games.team1 : setsMeta.games.team2;
    }
    return teamsCopy.find((t) => t.team_index === teamIndex)?.score || 0;
  };

  const getAgainstScore = (myTeamIndex: number) => {
    if (teamsCopy.length !== 2) return 0;
    const other = teamsCopy.find((t) => t.team_index !== myTeamIndex);
    if (!other) return 0;
    return getScoreFor(other.team_index);
  };

  const ratingChanges = new Map<string, number>();

  teamsCopy.forEach((team, idx) => {
    const scoreFor = config.track_score || config.track_average ? getScoreFor(team.team_index) : 0;
    const scoreAgainst =
      config.track_score || config.track_score_diff ? getAgainstScore(team.team_index) : 0;
    const scoreDiff = scoreFor - scoreAgainst;

    let ratingChange = 0;
    if (config.track_elo) {
      if (league.team_size > 0 && teamsCopy.length === 2) {
        ratingChange = idx === 0 ? team1Change : team2Change;
      } else if (league.team_size === 0) {
        ratingChange = ffaRatingChanges.get(team.team_index) || 0;
      }
    }

    team.user_ids.forEach((userId) => {
      const stats = playerStatsMap.get(userId);
      if (!stats) return;

      ratingChanges.set(userId, ratingChange);

      let baseRating = stats.rating;
      if (config.track_elo && (baseRating === 0 || baseRating === null)) {
        baseRating = 1500;
      }

      stats.rating = (baseRating || 0) + ratingChange;
      stats.matches_played += 1;
      stats.total_score += scoreFor;
      stats.score_for += scoreFor;
      stats.score_against += scoreAgainst;
      if (config.track_score_diff) stats.score_diff += scoreDiff;

      if (config.track_wins_losses) {
        if (team.is_draw) stats.draws += 1;
        else if (team.is_winner) stats.wins += 1;
        else stats.losses += 1;
      }

      if (team.position === 1) stats.first_places += 1;
      else if (team.position === 2) stats.second_places += 1;
      else if (team.position === 3) stats.third_places += 1;

      if (config.track_best_score) {
        const current = stats.best_score;
        if (current === null || current === undefined) {
          stats.best_score = scoreFor;
        } else if (config.lower_is_better) {
          stats.best_score = Math.min(current, scoreFor);
        } else {
          stats.best_score = Math.max(current, scoreFor);
        }
      }

      if (setsMeta && config.track_set_stats) {
        const won = team.team_index === 1 ? setsMeta.sets_won.team1 : setsMeta.sets_won.team2;
        const lost = team.team_index === 1 ? setsMeta.sets_won.team2 : setsMeta.sets_won.team1;
        const gf = team.team_index === 1 ? setsMeta.games.team1 : setsMeta.games.team2;
        const ga = team.team_index === 1 ? setsMeta.games.team2 : setsMeta.games.team1;
        stats.sets_won = (stats.sets_won || 0) + won;
        stats.sets_lost = (stats.sets_lost || 0) + lost;
        stats.games_for = (stats.games_for || 0) + gf;
        stats.games_against = (stats.games_against || 0) + ga;
      }
    });
  });

  return { ratingChanges };
}

/**
 * Samostatné ELO sestavy (pár/tým jako jednotka).
 * Používá se jen když team_size > 1 a obě strany mají alespoň 2 hráče.
 */
export function applyMatchToPairMap(
  league: { team_size: number; config?: any },
  teams: MatchTeamInput[],
  metadata: any,
  pairStatsMap: Map<string, PairStatRow>
): void {
  const config = league.config || {};
  if (league.team_size <= 1 || teams.length !== 2) return;

  const teamsCopy = [...teams].sort((a, b) => a.team_index - b.team_index);
  const team1 = teamsCopy[0];
  const team2 = teamsCopy[1];
  if (team1.user_ids.length < 2 || team2.user_ids.length < 2) return;

  const key1 = makePairKey(team1.user_ids);
  const key2 = makePairKey(team2.user_ids);
  const trackElo = !!config.track_elo;

  if (!pairStatsMap.has(key1)) pairStatsMap.set(key1, emptyPairStats(key1, trackElo));
  if (!pairStatsMap.has(key2)) pairStatsMap.set(key2, emptyPairStats(key2, trackElo));

  const p1 = pairStatsMap.get(key1)!;
  const p2 = pairStatsMap.get(key2)!;

  const setsMeta =
    metadata?.scoring_mode === 'sets' ? (metadata as MatchSetsMetadata) : null;

  let change1 = 0;
  let change2 = 0;

  if (trackElo) {
    const r1 = p1.rating || 1500;
    const r2 = p2.rating || 1500;
    const e1 = 1 / (1 + Math.pow(10, (r2 - r1) / 400));
    const e2 = 1 / (1 + Math.pow(10, (r1 - r2) / 400));

    let s1 = team1.is_draw ? 0.5 : team1.is_winner ? 1 : 0;
    let s2 = team2.is_draw ? 0.5 : team2.is_winner ? 1 : 0;

    if (setsMeta) {
      const eloS = eloActualFromSetsAndGames(
        setsMeta.sets_won.team1,
        setsMeta.sets_won.team2,
        setsMeta.games.team1,
        setsMeta.games.team2
      );
      s1 = eloS.s1;
      s2 = eloS.s2;
    }

    const K = 32;
    change1 = K * (s1 - e1);
    change2 = K * (s2 - e2);
    p1.rating = r1 + change1;
    p2.rating = r2 + change2;
  }

  p1.last_rating_change = change1;
  p2.last_rating_change = change2;

  const scoreFor1 = setsMeta ? setsMeta.games.team1 : team1.score || 0;
  const scoreFor2 = setsMeta ? setsMeta.games.team2 : team2.score || 0;

  const applySide = (pair: PairStatRow, team: MatchTeamInput, scoreFor: number, scoreAgainst: number) => {
    pair.matches_played += 1;
    if (config.track_score) {
      pair.score_for += scoreFor;
      pair.score_against += scoreAgainst;
      if (config.track_score_diff) pair.score_diff += scoreFor - scoreAgainst;
    }
    if (config.track_wins_losses) {
      if (team.is_draw) pair.draws += 1;
      else if (team.is_winner) pair.wins += 1;
      else pair.losses += 1;
    }
  };

  applySide(p1, team1, scoreFor1, scoreFor2);
  applySide(p2, team2, scoreFor2, scoreFor1);
}

export function emptyPlayerStats(userId: string, trackElo: boolean): PlayerStatRow {
  return {
    user_id: userId,
    rating: trackElo ? 1500 : 0,
    matches_played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    first_places: 0,
    second_places: 0,
    third_places: 0,
    total_score: 0,
    score_for: 0,
    score_against: 0,
    score_diff: 0,
    best_score: null,
    sets_won: 0,
    sets_lost: 0,
    games_for: 0,
    games_against: 0,
  };
}

export function teamsFromMatchParticipants(participants: any[]): MatchTeamInput[] {
  const byTeam = new Map<number, any[]>();
  for (const p of participants) {
    const t = Number(p.team);
    if (!byTeam.has(t)) byTeam.set(t, []);
    byTeam.get(t)!.push(p);
  }

  return Array.from(byTeam.entries()).map(([team_index, parts]) => {
    const is_winner = parts.some((p) => p.is_winner);
    const score = parts[0]?.score ?? 0;
    const position = parts[0]?.position ?? undefined;
    return {
      team_index,
      user_ids: parts.map((p) => String(p.user_id)),
      score: Number(score) || 0,
      is_winner,
      is_draw: false,
      position: position ?? undefined,
    };
  }).map((team, _i, all) => {
    const anyWinner = all.some((t) => t.is_winner);
    return {
      ...team,
      is_draw: !anyWinner && all.length === 2,
    };
  });
}
