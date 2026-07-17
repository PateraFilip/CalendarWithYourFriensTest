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

/**
 * ELO actual score S ∈ [0, 1] z výsledku setů a gamů.
 * Sety mají větší váhu (kdo vyhrál zápas), gamy jemně doladí dominanci.
 */
export function eloActualFromSetsAndGames(
  sets1: number,
  sets2: number,
  games1: number,
  games2: number
): { s1: number; s2: number } {
  const totalSets = sets1 + sets2;
  const totalGames = games1 + games2;

  if (totalSets === 0 && totalGames === 0) {
    return { s1: 0.5, s2: 0.5 };
  }

  const sSets1 = totalSets > 0 ? 0.5 + 0.5 * ((sets1 - sets2) / totalSets) : 0.5;
  const sGames1 = totalGames > 0 ? 0.5 + 0.5 * ((games1 - games2) / totalGames) : 0.5;

  // 75 % sety, 25 % gamy — 2:0 vs 2:1 a těsné/volné gamy se projeví
  const setWeight = totalSets > 0 ? 0.75 : 0;
  const gameWeight = 1 - setWeight;
  const s1 = Math.min(1, Math.max(0, setWeight * sSets1 + gameWeight * sGames1));
  const s2 = 1 - s1;

  return { s1, s2 };
}

export function buildSetsMetadata(sets: MatchSetScore[]): MatchSetsMetadata {
  const summary = summarizeSets(sets);
  return {
    sets: sets.map((s) => ({
      team1: Number(s.team1) || 0,
      team2: Number(s.team2) || 0,
    })),
    ...summary,
    scoring_mode: 'sets',
  };
}
