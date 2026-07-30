export type MatchSetScore = {
  team1: number;
  team2: number;
};

export type MatchSetsMetadata = {
  sets: MatchSetScore[];
  sets_won: { team1: number; team2: number };
  games: { team1: number; team2: number };
  scoring_mode: 'sets';
};

/** Normální zápas = 2 vítězné sety → K_set = K_match / 2. */
export const ELO_K_MATCH = 32;
export const ELO_SETS_TO_WIN = 2;
export const ELO_K_SET = ELO_K_MATCH / ELO_SETS_TO_WIN; // 16

/** Zaokrouhlení Elo na 2 desetinná místa (výpočet i zobrazení). */
export function roundElo(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function formatElo(n: number): string {
  return roundElo(n).toFixed(2);
}

export function formatEloChange(change: number): string {
  const r = roundElo(change);
  if (r === 0) return '±0.00';
  return `${r > 0 ? '+' : ''}${r.toFixed(2)}`;
}

/** Spočítá sety a gamy ze seznamu setů. */
export function summarizeSets(sets: MatchSetScore[]) {
  let sets1 = 0;
  let sets2 = 0;
  let games1 = 0;
  let games2 = 0;

  for (const set of sets) {
    const t1 = Number(set.team1) || 0;
    const t2 = Number(set.team2) || 0;
    games1 += t1;
    games2 += t2;
    if (t1 > t2) sets1++;
    else if (t2 > t1) sets2++;
  }

  return {
    sets_won: { team1: sets1, team2: sets2 },
    games: { team1: games1, team2: games2 },
  };
}

function normalizeSet(set: MatchSetScore): MatchSetScore {
  return {
    team1: Number(set.team1) || 0,
    team2: Number(set.team2) || 0,
  };
}

/** Extrahuje sety z metadata zápasu (pokud scoring_mode === 'sets'). */
export function setsFromMetadata(metadata: any): MatchSetScore[] {
  if (metadata?.scoring_mode !== 'sets' || !Array.isArray(metadata?.sets)) return [];
  return metadata.sets.map(normalizeSet);
}

/**
 * Typické vítězné skóre setu z historie tabulky.
 * Medián horní poloviny max(team1, team2) — dokončené sety bývají výš.
 */
export function inferSetWinTarget(sets: MatchSetScore[]): number | null {
  const winners = sets
    .map((s) => Math.max(Number(s.team1) || 0, Number(s.team2) || 0))
    .filter((n) => n > 0)
    .sort((a, b) => a - b);

  if (winners.length === 0) return null;

  const upper = winners.slice(Math.floor(winners.length / 2));
  const mid = Math.floor(upper.length / 2);
  if (upper.length % 2 === 0) {
    return (upper[mid - 1] + upper[mid]) / 2;
  }
  return upper[mid];
}

/** Váha dohrání setu: 1 = plný set, <1 = nedohrano podle typického cíle. */
export function setCompletionWeight(
  set: MatchSetScore,
  target: number | null
): number {
  const t1 = Number(set.team1) || 0;
  const t2 = Number(set.team2) || 0;
  const maxScore = Math.max(t1, t2);
  if (maxScore <= 0) return 0;
  if (target == null || target <= 0) return 1;
  return Math.min(1, Math.max(0, maxScore / target));
}

/**
 * Actual score S ∈ [0, 1] pro team1 z jednoho setu.
 * 75 % výhra setu + 25 % dominance gamů.
 */
export function setActualScore(set: MatchSetScore): { s1: number; s2: number } {
  const t1 = Number(set.team1) || 0;
  const t2 = Number(set.team2) || 0;
  const total = t1 + t2;

  if (total <= 0) {
    return { s1: 0.5, s2: 0.5 };
  }

  const sWin1 = t1 > t2 ? 1 : t2 > t1 ? 0 : 0.5;
  const sGames1 = 0.5 + 0.5 * ((t1 - t2) / total);
  const s1 = Math.min(1, Math.max(0, 0.75 * sWin1 + 0.25 * sGames1));
  return { s1, s2: 1 - s1 };
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Sekvenční Elo po setech (jako N jednosetových zápasů).
 * priorSets = historie ligy před tímto zápasem (bez lookaheadu).
 * Target se počítá z priorSets + ostatních setů stejného zápasu.
 */
export function computeSequentialSetElo(opts: {
  sets: MatchSetScore[];
  r1: number;
  r2: number;
  priorSets?: MatchSetScore[];
  K?: number;
}): { change1: number; change2: number } {
  const sets = opts.sets.map(normalizeSet).filter((s) => s.team1 + s.team2 > 0);
  const K = opts.K ?? ELO_K_SET;
  const prior = opts.priorSets ?? [];

  if (sets.length === 0) {
    return { change1: 0, change2: 0 };
  }

  let rating1 = opts.r1;
  let rating2 = opts.r2;
  let change1 = 0;
  let change2 = 0;

  for (let i = 0; i < sets.length; i++) {
    const set = sets[i];
    const otherInMatch = sets.filter((_, j) => j !== i);
    const target = inferSetWinTarget([...prior, ...otherInMatch]);
    const weight = setCompletionWeight(set, target);
    if (weight <= 0) continue;

    const { s1 } = setActualScore(set);
    const e1 = expectedScore(rating1, rating2);
    const delta1 = weight * K * (s1 - e1);
    const delta2 = -delta1;

    rating1 += delta1;
    rating2 += delta2;
    change1 += delta1;
    change2 += delta2;
  }

  return { change1: roundElo(change1), change2: roundElo(change2) };
}

export function buildSetsMetadata(sets: MatchSetScore[]): MatchSetsMetadata {
  const summary = summarizeSets(sets);
  return {
    sets: sets.map(normalizeSet),
    ...summary,
    scoring_mode: 'sets',
  };
}
