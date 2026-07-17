import dayjs from 'dayjs';

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
