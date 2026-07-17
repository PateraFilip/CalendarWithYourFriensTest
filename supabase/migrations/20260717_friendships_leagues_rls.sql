-- Friendships + leagues RLS, FoF RPC lock, pair ratings tighten
-- Spusť po 20260717_tighten_rls.sql

-- ---------------------------------------------------------------------------
-- FoF RPC: jen vlastní síť
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_extended_network_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden: can only query own network';
  END IF;

  RETURN QUERY
  WITH direct_friends AS (
    SELECT friend_id AS u_id FROM friendships WHERE user_id = p_user_id AND status = 'accepted'
    UNION
    SELECT user_id AS u_id FROM friendships WHERE friend_id = p_user_id AND status = 'accepted'
  ),
  friends_of_friends AS (
    SELECT f.friend_id AS u_id FROM friendships f
    JOIN direct_friends df ON f.user_id = df.u_id
    WHERE f.status = 'accepted' AND f.friend_id != p_user_id
    UNION
    SELECT f.user_id AS u_id FROM friendships f
    JOIN direct_friends df ON f.friend_id = df.u_id
    WHERE f.status = 'accepted' AND f.user_id != p_user_id
  )
  SELECT u_id FROM direct_friends
  UNION
  SELECT u_id FROM friends_of_friends;
END;
$$;

REVOKE ALL ON FUNCTION public.get_extended_network_ids(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_extended_network_ids(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Friendships
-- ---------------------------------------------------------------------------
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friendships_select" ON friendships;
CREATE POLICY "friendships_select" ON friendships FOR SELECT
  USING (user_id = auth.uid() OR friend_id = auth.uid());

DROP POLICY IF EXISTS "friendships_insert" ON friendships;
CREATE POLICY "friendships_insert" ON friendships FOR INSERT
  WITH CHECK (user_id = auth.uid() AND user_id <> friend_id);

DROP POLICY IF EXISTS "friendships_update" ON friendships;
CREATE POLICY "friendships_update" ON friendships FOR UPDATE
  USING (user_id = auth.uid() OR friend_id = auth.uid())
  WITH CHECK (user_id = auth.uid() OR friend_id = auth.uid());

DROP POLICY IF EXISTS "friendships_delete" ON friendships;
CREATE POLICY "friendships_delete" ON friendships FOR DELETE
  USING (user_id = auth.uid() OR friend_id = auth.uid());

-- ---------------------------------------------------------------------------
-- League visibility helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_league(p_league_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM leagues l
    WHERE l.id = p_league_id
      AND auth.uid() IS NOT NULL
      AND (
        l.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM league_players lp
          WHERE lp.league_id = l.id AND lp.user_id = auth.uid()
        )
        OR (COALESCE(l.is_global, false) = true AND l.created_by IS NULL)
        OR (
          l.created_by IS NOT NULL
          AND l.created_by IN (SELECT public.get_extended_network_ids(auth.uid()))
        )
        OR EXISTS (
          SELECT 1 FROM league_players lp
          WHERE lp.league_id = l.id
            AND lp.user_id IN (SELECT public.get_extended_network_ids(auth.uid()))
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_league_creator(p_league_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM leagues l
    WHERE l.id = p_league_id AND l.created_by = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_league_player(p_league_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM league_players lp
    WHERE lp.league_id = p_league_id AND lp.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- leagues
-- ---------------------------------------------------------------------------
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leagues_select" ON leagues;
CREATE POLICY "leagues_select" ON leagues FOR SELECT
  USING (public.can_view_league(id));

DROP POLICY IF EXISTS "leagues_insert" ON leagues;
CREATE POLICY "leagues_insert" ON leagues FOR INSERT
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "leagues_update" ON leagues;
CREATE POLICY "leagues_update" ON leagues FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "leagues_delete" ON leagues;
CREATE POLICY "leagues_delete" ON leagues FOR DELETE
  USING (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- league_players
-- ---------------------------------------------------------------------------
ALTER TABLE league_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "league_players_select" ON league_players;
CREATE POLICY "league_players_select" ON league_players FOR SELECT
  USING (public.can_view_league(league_id));

DROP POLICY IF EXISTS "league_players_insert" ON league_players;
CREATE POLICY "league_players_insert" ON league_players FOR INSERT
  WITH CHECK (
    public.is_league_creator(league_id)
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "league_players_update" ON league_players;
CREATE POLICY "league_players_update" ON league_players FOR UPDATE
  USING (
    public.is_league_creator(league_id)
    OR public.is_league_player(league_id)
  )
  WITH CHECK (
    public.is_league_creator(league_id)
    OR public.is_league_player(league_id)
  );

DROP POLICY IF EXISTS "league_players_delete" ON league_players;
CREATE POLICY "league_players_delete" ON league_players FOR DELETE
  USING (
    public.is_league_creator(league_id)
    OR user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- league_matches
-- ---------------------------------------------------------------------------
ALTER TABLE league_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "league_matches_select" ON league_matches;
CREATE POLICY "league_matches_select" ON league_matches FOR SELECT
  USING (public.can_view_league(league_id));

DROP POLICY IF EXISTS "league_matches_insert" ON league_matches;
CREATE POLICY "league_matches_insert" ON league_matches FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.is_league_creator(league_id)
      OR public.is_league_player(league_id)
    )
  );

DROP POLICY IF EXISTS "league_matches_update" ON league_matches;
CREATE POLICY "league_matches_update" ON league_matches FOR UPDATE
  USING (
    public.is_league_creator(league_id)
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.is_league_creator(league_id)
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "league_matches_delete" ON league_matches;
CREATE POLICY "league_matches_delete" ON league_matches FOR DELETE
  USING (
    public.is_league_creator(league_id)
    OR created_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- league_match_participants
-- ---------------------------------------------------------------------------
ALTER TABLE league_match_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "league_match_participants_select" ON league_match_participants;
CREATE POLICY "league_match_participants_select" ON league_match_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM league_matches lm
      WHERE lm.id = league_match_participants.match_id
        AND public.can_view_league(lm.league_id)
    )
  );

DROP POLICY IF EXISTS "league_match_participants_insert" ON league_match_participants;
CREATE POLICY "league_match_participants_insert" ON league_match_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM league_matches lm
      WHERE lm.id = match_id
        AND (
          public.is_league_creator(lm.league_id)
          OR lm.created_by = auth.uid()
          OR public.is_league_player(lm.league_id)
        )
    )
  );

DROP POLICY IF EXISTS "league_match_participants_update" ON league_match_participants;
CREATE POLICY "league_match_participants_update" ON league_match_participants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM league_matches lm
      WHERE lm.id = league_match_participants.match_id
        AND (public.is_league_creator(lm.league_id) OR lm.created_by = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM league_matches lm
      WHERE lm.id = match_id
        AND (public.is_league_creator(lm.league_id) OR lm.created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS "league_match_participants_delete" ON league_match_participants;
CREATE POLICY "league_match_participants_delete" ON league_match_participants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM league_matches lm
      WHERE lm.id = league_match_participants.match_id
        AND (public.is_league_creator(lm.league_id) OR lm.created_by = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- league_pair_ratings (tighten beyond "any authenticated")
-- ---------------------------------------------------------------------------
ALTER TABLE league_pair_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "league_pair_ratings_all" ON league_pair_ratings;
DROP POLICY IF EXISTS "league_pair_ratings_select" ON league_pair_ratings;
DROP POLICY IF EXISTS "league_pair_ratings_write" ON league_pair_ratings;
DROP POLICY IF EXISTS "league_pair_ratings_insert" ON league_pair_ratings;
DROP POLICY IF EXISTS "league_pair_ratings_update" ON league_pair_ratings;
DROP POLICY IF EXISTS "league_pair_ratings_delete" ON league_pair_ratings;

CREATE POLICY "league_pair_ratings_select" ON league_pair_ratings FOR SELECT
  USING (public.can_view_league(league_id));

CREATE POLICY "league_pair_ratings_insert" ON league_pair_ratings FOR INSERT
  WITH CHECK (
    public.is_league_creator(league_id)
    OR public.is_league_player(league_id)
  );

CREATE POLICY "league_pair_ratings_update" ON league_pair_ratings FOR UPDATE
  USING (
    public.is_league_creator(league_id)
    OR public.is_league_player(league_id)
  )
  WITH CHECK (
    public.is_league_creator(league_id)
    OR public.is_league_player(league_id)
  );

CREATE POLICY "league_pair_ratings_delete" ON league_pair_ratings FOR DELETE
  USING (public.is_league_creator(league_id));

-- Oprava: series_exceptions nesmí zůstat open po pomíchaném pořadí migrací
DROP POLICY IF EXISTS "series_exceptions_update" ON series_exceptions;
CREATE POLICY "series_exceptions_update" ON series_exceptions FOR UPDATE
  USING (public.is_series_owner(series_id))
  WITH CHECK (public.is_series_owner(series_id));

DROP POLICY IF EXISTS "series_exceptions_delete" ON series_exceptions;
CREATE POLICY "series_exceptions_delete" ON series_exceptions FOR DELETE
  USING (public.is_series_owner(series_id));
