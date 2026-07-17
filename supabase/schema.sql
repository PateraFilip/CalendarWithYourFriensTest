-- =============================================================================
-- ShareCalendarWithYourFriends – referenční schéma (aktuální záměr)
-- NEPOUŽÍVEJ jako blind bootstrap na produkci se starými daty.
-- RLS politiky: viz rls-policies.sql a migrations/20260717_*.sql
-- =============================================================================

-- users: UUID = auth.users.id (bez hesla v public.users)
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username        TEXT NOT NULL UNIQUE,
  email           TEXT UNIQUE,
  jmeno           TEXT,
  prijmeni        TEXT,
  datum_narozeni  DATE,
  notify_friend_requests BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS colors (
  id               BIGSERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  background_color TEXT NOT NULL,
  text_color       TEXT NOT NULL,
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS friendships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS event_series (
  id              BIGSERIAL PRIMARY KEY,
  nazev           TEXT NOT NULL,
  zakladatel_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pocet_lidi      INT NOT NULL DEFAULT 1 CHECK (pocet_lidi >= 1),
  is_group        BOOLEAN NOT NULL DEFAULT FALSE,
  cas_od          TIME NOT NULL,
  cas_do          TIME NOT NULL,
  timezone        TEXT NOT NULL DEFAULT 'Europe/Prague',
  poloha          TEXT,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  recurrence_rule JSONB NOT NULL,
  valid_from      DATE,
  valid_until     DATE,
  group_id        BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS series_exceptions (
  id              BIGSERIAL PRIMARY KEY,
  series_id       BIGINT NOT NULL REFERENCES event_series(id) ON DELETE CASCADE,
  typ             TEXT NOT NULL CHECK (typ IN ('DELETE', 'UPDATE')),
  puvodni_den     DATE NOT NULL,
  puvodni_cas_od  TIME,
  puvodni_cas_do  TIME,
  den_od          DATE,
  den_do          DATE,
  cas_od          TIME,
  cas_do          TIME,
  title           TEXT,
  poloha          TEXT,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  pocet_lidi      INT,
  is_group        BOOLEAN,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (series_id, puvodni_den)
);

CREATE TABLE IF NOT EXISTS event_users (
  id            BIGSERIAL PRIMARY KEY,
  series_id     BIGINT NOT NULL REFERENCES event_series(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_date TEXT,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (series_id, user_id, instance_date)
);

CREATE TABLE IF NOT EXISTS event_invites (
  id         BIGSERIAL PRIMARY KEY,
  series_id  BIGINT NOT NULL REFERENCES event_series(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (series_id, user_id)
);

CREATE TABLE IF NOT EXISTS event_messages (
  id                 BIGSERIAL PRIMARY KEY,
  series_id          BIGINT NOT NULL REFERENCES event_series(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_date      TEXT,
  message            TEXT NOT NULL CHECK (char_length(trim(message)) > 0),
  is_system_message  BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_notifications (
  id            BIGSERIAL PRIMARY KEY,
  recipient_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  type          TEXT NOT NULL DEFAULT 'info',
  message       TEXT NOT NULL,
  series_id     BIGINT REFERENCES event_series(id) ON DELETE SET NULL,
  instance_date TEXT,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_devices (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token  TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id                   BIGSERIAL PRIMARY KEY,
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_object  JSONB NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_reads (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id      TEXT NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, room_id)
);

-- Ligy (zjednodušený tvar – sloupce mohou mít další migrace)
CREATE TABLE IF NOT EXISTS leagues (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  sport_id     TEXT,
  team_size    INT NOT NULL DEFAULT 1,
  scoring_type TEXT,
  config       JSONB DEFAULT '{}'::jsonb,
  is_global    BOOLEAN NOT NULL DEFAULT FALSE,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS league_players (
  id             BIGSERIAL PRIMARY KEY,
  league_id      BIGINT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating         FLOAT DEFAULT 1500,
  matches_played INT DEFAULT 0,
  wins           INT DEFAULT 0,
  losses         INT DEFAULT 0,
  draws          INT DEFAULT 0,
  total_score    FLOAT DEFAULT 0,
  score_for      FLOAT DEFAULT 0,
  score_against  FLOAT DEFAULT 0,
  score_diff     FLOAT DEFAULT 0,
  UNIQUE (league_id, user_id)
);

CREATE TABLE IF NOT EXISTS league_matches (
  id         BIGSERIAL PRIMARY KEY,
  league_id  BIGINT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS league_match_participants (
  id         BIGSERIAL PRIMARY KEY,
  match_id   BIGINT NOT NULL REFERENCES league_matches(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team       INT NOT NULL DEFAULT 0,
  is_winner  BOOLEAN,
  score      FLOAT
);

CREATE TABLE IF NOT EXISTS league_pair_ratings (
  id                 BIGSERIAL PRIMARY KEY,
  league_id          BIGINT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  pair_key           TEXT NOT NULL,
  rating             FLOAT NOT NULL DEFAULT 1500,
  matches_played     INT NOT NULL DEFAULT 0,
  wins               INT NOT NULL DEFAULT 0,
  losses             INT NOT NULL DEFAULT 0,
  draws              INT NOT NULL DEFAULT 0,
  score_for          FLOAT NOT NULL DEFAULT 0,
  score_against      FLOAT NOT NULL DEFAULT 0,
  score_diff         FLOAT NOT NULL DEFAULT 0,
  last_rating_change FLOAT NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, pair_key)
);

-- Poznámka: global_messages je deprecated (nahrazeno user_notifications).
-- RLS: spusť supabase/rls-policies.sql a migrations/20260717_friendships_leagues_rls.sql
