-- =============================================================================
-- Leaderboards & Leagues Schema V2
-- PŮVODNÍ TABULKY LZE SMAZAT NEBO DROPNOUT
-- =============================================================================

DROP TABLE IF EXISTS league_match_participants CASCADE;
DROP TABLE IF EXISTS league_matches CASCADE;
DROP TABLE IF EXISTS league_players CASCADE;
DROP TABLE IF EXISTS leagues CASCADE;

CREATE TABLE IF NOT EXISTS leagues (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  sport_id     TEXT NOT NULL, -- 'padel', 'badminton', 'bowling', 'custom'
  team_size    INT NOT NULL DEFAULT 1, -- 1=1v1, 2=2v2, 0=FFA
  scoring_type TEXT NOT NULL, -- 'elo', 'avg_high', 'avg_low', 'points'
  config       JSONB NOT NULL DEFAULT '{"track_score": false}', -- {track_score: true}
  is_global    BOOLEAN NOT NULL DEFAULT false, -- Pokud true, jedná se o výchozí tabulku v aplikaci
  created_by   UUID REFERENCES users(id) ON DELETE CASCADE, -- U globálních může být NULL
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS league_players (
  id             BIGSERIAL PRIMARY KEY,
  league_id      BIGINT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating         FLOAT NOT NULL DEFAULT 1500, -- Default ELO is 1500, points/avg is 0
  matches_played INT NOT NULL DEFAULT 0,
  wins           INT NOT NULL DEFAULT 0,
  losses         INT NOT NULL DEFAULT 0,
  draws          INT NOT NULL DEFAULT 0,
  total_score    FLOAT NOT NULL DEFAULT 0,
  first_places   INT DEFAULT 0,
  second_places  INT DEFAULT 0,
  third_places   INT DEFAULT 0,
  score_for      FLOAT DEFAULT 0,
  score_against  FLOAT NOT NULL DEFAULT 0,
  score_diff     FLOAT NOT NULL DEFAULT 0,
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, user_id)
);

CREATE TABLE IF NOT EXISTS league_matches (
  id          BIGSERIAL PRIMARY KEY,
  league_id   BIGINT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  played_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB -- Stores extra match details (sety, góly, poznámka)
);

CREATE TABLE IF NOT EXISTS league_match_participants (
  id             BIGSERIAL PRIMARY KEY,
  match_id       BIGINT NOT NULL REFERENCES league_matches(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team           INT NOT NULL, -- 1 = Team A, 2 = Team B, atd.
  score          FLOAT, -- Skóre zadané pro hráče (např. body v bowlingu, počet gólů)
  rating_change  FLOAT NOT NULL, -- O kolik se po zápase změnilo ELO / Průměr
  position       INT, -- Umístění ve hře (pro FFA ligy, kde záleží na pozici)
  is_winner      BOOLEAN NOT NULL DEFAULT false
);

-- RLS
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_match_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leagues_read" ON leagues FOR SELECT USING (true);
CREATE POLICY "leagues_insert" ON leagues FOR INSERT WITH CHECK (true);

CREATE POLICY "league_players_read" ON league_players FOR SELECT USING (true);
CREATE POLICY "league_players_insert" ON league_players FOR INSERT WITH CHECK (true);
CREATE POLICY "league_players_update" ON league_players FOR UPDATE USING (true);

CREATE POLICY "league_matches_read" ON league_matches FOR SELECT USING (true);
CREATE POLICY "league_matches_insert" ON league_matches FOR INSERT WITH CHECK (true);

CREATE POLICY "league_match_participants_read" ON league_match_participants FOR SELECT USING (true);
CREATE POLICY "league_match_participants_insert" ON league_match_participants FOR INSERT WITH CHECK (true);

-- SEED GLOBÁLNÍCH TABULEK (POKUD UŽ NEEXISTUJÍ)
INSERT INTO leagues (name, sport_id, team_size, scoring_type, config, is_global, created_by)
SELECT 'Padel (Dvouhra)', 'padel', 1, 'dynamic', '{"track_elo": true, "track_score": true, "track_score_diff": true, "track_wins_losses": true}', true, NULL
WHERE NOT EXISTS (SELECT 1 FROM leagues WHERE name = 'Padel (Dvouhra)' AND is_global = true);

INSERT INTO leagues (name, sport_id, team_size, scoring_type, config, is_global, created_by)
SELECT 'Padel (Čtyřhra)', 'padel', 2, 'dynamic', '{"track_elo": true, "track_score": true, "track_score_diff": true, "track_wins_losses": true}', true, NULL
WHERE NOT EXISTS (SELECT 1 FROM leagues WHERE name = 'Padel (Čtyřhra)' AND is_global = true);

INSERT INTO leagues (name, sport_id, team_size, scoring_type, config, is_global, created_by)
SELECT 'Badminton (Dvouhra)', 'badminton', 1, 'dynamic', '{"track_elo": true, "track_score": true, "track_score_diff": true, "track_wins_losses": true}', true, NULL
WHERE NOT EXISTS (SELECT 1 FROM leagues WHERE name = 'Badminton (Dvouhra)' AND is_global = true);

INSERT INTO leagues (name, sport_id, team_size, scoring_type, config, is_global, created_by)
SELECT 'Badminton (Čtyřhra)', 'badminton', 2, 'dynamic', '{"track_elo": true, "track_score": true, "track_score_diff": true, "track_wins_losses": true}', true, NULL
WHERE NOT EXISTS (SELECT 1 FROM leagues WHERE name = 'Badminton (Čtyřhra)' AND is_global = true);

INSERT INTO leagues (name, sport_id, team_size, scoring_type, config, is_global, created_by)
SELECT 'Bowling', 'bowling', 0, 'dynamic', '{"track_average": true, "track_score": true, "track_wins_losses": true}', true, NULL
WHERE NOT EXISTS (SELECT 1 FROM leagues WHERE name = 'Bowling' AND is_global = true);

-- ==============================================================================
-- 8. FRIENDSHIPS
-- ==============================================================================

CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Opr�vn�n� (RLS) pro friendships
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own friendships" ON friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can create friendships" ON friendships FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update friendships" ON friendships FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can delete friendships" ON friendships FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

