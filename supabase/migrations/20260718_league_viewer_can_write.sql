-- Kdokoli, kdo tabulku vidí (FoF síť), může zapsat výsledek a přidat hráče.
-- Dříve insert vyžadoval league_players membership — přátelé tabulku viděli, ale zápis padal na RLS.

DROP POLICY IF EXISTS "league_players_insert" ON league_players;
CREATE POLICY "league_players_insert" ON league_players FOR INSERT
  WITH CHECK (public.can_view_league(league_id));

DROP POLICY IF EXISTS "league_players_update" ON league_players;
CREATE POLICY "league_players_update" ON league_players FOR UPDATE
  USING (public.can_view_league(league_id))
  WITH CHECK (public.can_view_league(league_id));

DROP POLICY IF EXISTS "league_matches_insert" ON league_matches;
CREATE POLICY "league_matches_insert" ON league_matches FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND public.can_view_league(league_id)
  );

DROP POLICY IF EXISTS "league_match_participants_insert" ON league_match_participants;
CREATE POLICY "league_match_participants_insert" ON league_match_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM league_matches lm
      WHERE lm.id = match_id
        AND public.can_view_league(lm.league_id)
    )
  );

DROP POLICY IF EXISTS "league_pair_ratings_insert" ON league_pair_ratings;
CREATE POLICY "league_pair_ratings_insert" ON league_pair_ratings FOR INSERT
  WITH CHECK (public.can_view_league(league_id));

DROP POLICY IF EXISTS "league_pair_ratings_update" ON league_pair_ratings;
CREATE POLICY "league_pair_ratings_update" ON league_pair_ratings FOR UPDATE
  USING (public.can_view_league(league_id))
  WITH CHECK (public.can_view_league(league_id));
