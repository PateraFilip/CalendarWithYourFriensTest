-- Samostatné ELO / statistiky pro sestavu (pár / tým) v ligách s team_size > 1

CREATE TABLE IF NOT EXISTS league_pair_ratings (
  id              BIGSERIAL PRIMARY KEY,
  league_id       BIGINT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  pair_key        TEXT NOT NULL,
  rating          FLOAT NOT NULL DEFAULT 1500,
  matches_played  INT NOT NULL DEFAULT 0,
  wins            INT NOT NULL DEFAULT 0,
  losses          INT NOT NULL DEFAULT 0,
  draws           INT NOT NULL DEFAULT 0,
  score_for       FLOAT NOT NULL DEFAULT 0,
  score_against   FLOAT NOT NULL DEFAULT 0,
  score_diff      FLOAT NOT NULL DEFAULT 0,
  last_rating_change FLOAT NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, pair_key)
);

CREATE INDEX IF NOT EXISTS idx_league_pair_ratings_league ON league_pair_ratings (league_id);

ALTER TABLE league_pair_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "league_pair_ratings_select" ON league_pair_ratings;
CREATE POLICY "league_pair_ratings_select" ON league_pair_ratings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leagues l
      WHERE l.id = league_pair_ratings.league_id
        AND auth.uid() IS NOT NULL
        AND (
          l.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM league_players lp WHERE lp.league_id = l.id AND lp.user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "league_pair_ratings_insert" ON league_pair_ratings;
CREATE POLICY "league_pair_ratings_insert" ON league_pair_ratings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leagues l
      WHERE l.id = league_id
        AND (l.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM league_players lp WHERE lp.league_id = l.id AND lp.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "league_pair_ratings_update" ON league_pair_ratings;
CREATE POLICY "league_pair_ratings_update" ON league_pair_ratings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM leagues l
      WHERE l.id = league_pair_ratings.league_id
        AND (l.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM league_players lp WHERE lp.league_id = l.id AND lp.user_id = auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leagues l
      WHERE l.id = league_id
        AND (l.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM league_players lp WHERE lp.league_id = l.id AND lp.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "league_pair_ratings_delete" ON league_pair_ratings;
CREATE POLICY "league_pair_ratings_delete" ON league_pair_ratings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM leagues l
      WHERE l.id = league_pair_ratings.league_id AND l.created_by = auth.uid()
    )
  );
