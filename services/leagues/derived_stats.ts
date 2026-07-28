import dayjs from 'dayjs';
import { applyMatchToPairMap } from '@/services/leagues/match_engine';
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
 * ELO po každém zápase (a změna). Hráči z uloženého rating_change;
 * páry/týmy přehráním stejné logiky jako match engine.
 */
export function buildMatchEloHistory(
  matches: any[],
  league: { team_size: number; config?: any } | null
): Map<number, MatchEloSnapshot> {
  const result = new Map<number, MatchEloSnapshot>();
  if (!league?.config?.track_elo) return result;

  const playerRatings = new Map<string, number>();
  const pairStatsMap = new Map<string, PairStatRow>();

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
      const before = playerRatings.get(uid) ?? 1500;
      const change = Number(p.rating_change) || 0;
      const after = before + change;
      playersSnap.set(uid, { before, after, change });
      playerRatings.set(uid, after);
    }

    if (league.team_size > 1) {
      const byTeam = new Map<number, any[]>();
      for (const p of parts) {
        const t = Number(p.team);
        if (!byTeam.has(t)) byTeam.set(t, []);
        byTeam.get(t)!.push(p);
      }

      const teams = [...byTeam.entries()]
        .sort(([a], [b]) => a - b)
        .map(([teamIndex, participants]) => {
          const anyWinner = parts.some((x: any) => x.is_winner);
          const isWinner = !!participants[0]?.is_winner;
          return {
            team_index: teamIndex,
            user_ids: participants.map((x: any) => String(x.user_id)),
            score: Number(participants[0]?.score) || 0,
            is_winner: isWinner,
            is_draw: !anyWinner,
          };
        });

      if (teams.length === 2 && teams.every((t) => t.user_ids.length >= 2)) {
        const key1 = makePairKey(teams[0].user_ids);
        const key2 = makePairKey(teams[1].user_ids);
        if (!pairStatsMap.has(key1)) pairStatsMap.set(key1, emptyPairStats(key1, true));
        if (!pairStatsMap.has(key2)) pairStatsMap.set(key2, emptyPairStats(key2, true));

        const before1 = pairStatsMap.get(key1)!.rating;
        const before2 = pairStatsMap.get(key2)!.rating;

        applyMatchToPairMap(league, teams, match.metadata, pairStatsMap);

        const after1 = pairStatsMap.get(key1)!.rating;
        const after2 = pairStatsMap.get(key2)!.rating;
        pairsSnap.set(key1, { before: before1, after: after1, change: after1 - before1 });
        pairsSnap.set(key2, { before: before2, after: after2, change: after2 - before2 });
      }
    }

    result.set(Number(match.id), { players: playersSnap, pairs: pairsSnap });
  }

  return result;
}
