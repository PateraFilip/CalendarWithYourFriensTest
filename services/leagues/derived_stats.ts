import dayjs from 'dayjs';
import {
  applyMatchToPairMap,
  applyMatchToPlayerMap,
  emptyPlayerStats,
  teamsFromMatchParticipants,
  type PlayerStatRow,
} from '@/services/leagues/match_engine';
import { MatchSetScore, roundElo, setsFromMetadata } from '@/services/leagues/match_sets';
import { emptyPairStats, makePairKey, PairStatRow } from '@/services/leagues/pair_ratings';

export type EnrichedPlayer = {
  form?: string;
  winrate?: number;
  sets_won?: number;
  sets_lost?: number;
  games_for?: number;
  games_against?: number;
  best_score?: number | null;
  last_played?: string | null;
};

/** Spočítá odvozené statistiky z historie zápasů (forma, sety, best, last). */
export function enrichPlayersFromMatches(
  players: any[],
  matches: any[],
  config: any,
  lowerIsBetter?: boolean
): Map<string, EnrichedPlayer> {
  const result = new Map<string, EnrichedPlayer>();
  for (const p of players) {
    result.set(String(p.user_id), {
      form: '',
      winrate: p.matches_played ? Math.round((p.wins / p.matches_played) * 100) : 0,
      sets_won: 0,
      sets_lost: 0,
      games_for: 0,
      games_against: 0,
      best_score: null,
      last_played: null,
    });
  }

  // matches jsou typicky newest-first
  const chronological = [...matches].sort(
    (a, b) => new Date(a.played_at).getTime() - new Date(b.played_at).getTime()
  );

  const formLetters = new Map<string, string[]>();

  for (const match of chronological) {
    const parts = match.league_match_participants || [];
    const setsMeta = match.metadata?.scoring_mode === 'sets' ? match.metadata : null;
    const anyWinner = parts.some((p: any) => p.is_winner);

    for (const part of parts) {
      const uid = String(part.user_id);
      const enriched = result.get(uid);
      if (!enriched) continue;

      enriched.last_played = match.played_at;

      const score = Number(part.score) || 0;
      if (config?.track_best_score || config?.track_average) {
        if (enriched.best_score === null || enriched.best_score === undefined) {
          enriched.best_score = score;
        } else if (lowerIsBetter) {
          enriched.best_score = Math.min(enriched.best_score, score);
        } else {
          enriched.best_score = Math.max(enriched.best_score, score);
        }
      }

      if (setsMeta && config?.track_set_stats) {
        const team = Number(part.team);
        const won = team === 1 ? setsMeta.sets_won.team1 : setsMeta.sets_won.team2;
        const lost = team === 1 ? setsMeta.sets_won.team2 : setsMeta.sets_won.team1;
        const gf = team === 1 ? setsMeta.games.team1 : setsMeta.games.team2;
        const ga = team === 1 ? setsMeta.games.team2 : setsMeta.games.team1;
        // Každý hráč týmu dostane stejné sety — přičteme jen jednou na hráče za zápas
        enriched.sets_won = (enriched.sets_won || 0) + (won || 0);
        enriched.sets_lost = (enriched.sets_lost || 0) + (lost || 0);
        enriched.games_for = (enriched.games_for || 0) + (gf || 0);
        enriched.games_against = (enriched.games_against || 0) + (ga || 0);
      }

      if (config?.track_form) {
        let letter = 'L';
        if (part.is_winner) letter = 'W';
        else if (!anyWinner) letter = 'D';
        if (!formLetters.has(uid)) formLetters.set(uid, []);
        formLetters.get(uid)!.push(letter);
      }
    }
  }

  for (const [uid, letters] of formLetters.entries()) {
    const enriched = result.get(uid);
    if (enriched) {
      enriched.form = letters.slice(-5).join('');
    }
  }

  return result;
}

export function formatLastPlayed(iso?: string | null) {
  if (!iso) return '—';
  return dayjs(iso).format('D.M.');
}

export type EloSnap = { before: number; after: number; change: number };

export type MatchEloSnapshot = {
  players: Map<string, EloSnap>;
  pairs: Map<string, EloSnap>;
};

/**
 * ELO po každém zápase — hráči i páry přehráním stejné logiky jako match engine
 * (včetně sekvenčního Elo po setech).
 */
export function buildMatchEloHistory(
  matches: any[],
  league: { team_size: number; config?: any } | null
): Map<number, MatchEloSnapshot> {
  const result = new Map<number, MatchEloSnapshot>();
  if (!league?.config?.track_elo) return result;

  const playerStatsMap = new Map<string, PlayerStatRow>();
  const pairStatsMap = new Map<string, PairStatRow>();
  const priorSets: MatchSetScore[] = [];

  const chronological = [...matches].sort((a, b) => {
    const ta = new Date(a.played_at || a.created_at).getTime();
    const tb = new Date(b.played_at || b.created_at).getTime();
    if (ta !== tb) return ta - tb;
    return Number(a.id) - Number(b.id);
  });

  for (const match of chronological) {
    const playersSnap = new Map<string, EloSnap>();
    const pairsSnap = new Map<string, EloSnap>();
    const parts = match.league_match_participants || [];

    for (const p of parts) {
      const uid = String(p.user_id);
      if (!playerStatsMap.has(uid)) {
        playerStatsMap.set(uid, emptyPlayerStats(uid, true));
      }
    }

    const teams = teamsFromMatchParticipants(parts);
    teams.sort((a, b) => a.team_index - b.team_index);
    const applyOpts = { priorSets: [...priorSets] };

    const beforeByUser = new Map<string, number>();
    for (const p of parts) {
      const uid = String(p.user_id);
      beforeByUser.set(uid, playerStatsMap.get(uid)?.rating ?? 1500);
    }

    const { ratingChanges } = applyMatchToPlayerMap(
      league,
      teams,
      match.metadata,
      playerStatsMap,
      applyOpts
    );

    for (const p of parts) {
      const uid = String(p.user_id);
      const before = beforeByUser.get(uid) ?? 1500;
      const change = roundElo(ratingChanges.get(uid) || 0);
      playersSnap.set(uid, {
        before: roundElo(before),
        after: roundElo(before + change),
        change,
      });
    }

    if (league.team_size > 1) {
      if (teams.length === 2 && teams.every((t) => t.user_ids.length >= 2)) {
        const key1 = makePairKey(teams[0].user_ids);
        const key2 = makePairKey(teams[1].user_ids);
        if (!pairStatsMap.has(key1)) pairStatsMap.set(key1, emptyPairStats(key1, true));
        if (!pairStatsMap.has(key2)) pairStatsMap.set(key2, emptyPairStats(key2, true));

        const before1 = pairStatsMap.get(key1)!.rating;
        const before2 = pairStatsMap.get(key2)!.rating;

        applyMatchToPairMap(league, teams, match.metadata, pairStatsMap, applyOpts);

        const after1 = pairStatsMap.get(key1)!.rating;
        const after2 = pairStatsMap.get(key2)!.rating;
        pairsSnap.set(key1, {
          before: roundElo(before1),
          after: roundElo(after1),
          change: roundElo(after1 - before1),
        });
        pairsSnap.set(key2, {
          before: roundElo(before2),
          after: roundElo(after2),
          change: roundElo(after2 - before2),
        });
      }
    }

    priorSets.push(...setsFromMetadata(match.metadata));
    result.set(Number(match.id), { players: playersSnap, pairs: pairsSnap });
  }

  return result;
}
