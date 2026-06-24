-- =============================================================================
-- ShareCalendarWithYourFriends – cílové schéma DB
-- Spusť v Supabase SQL Editoru (nejdřív záloha!)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Uživatelé a profil
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  heslo         TEXT NOT NULL,
  email         TEXT UNIQUE,
  jmeno         TEXT,
  prijmeni      TEXT,
  datum_narozeni DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS colors (
  id               BIGSERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  background_color TEXT NOT NULL,
  text_color       TEXT NOT NULL,
  user_id          BIGINT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS password_resets (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Šablony událostí (nový jednotný model)
-- recurrence_rule JSON – viz supabase/_shared/recurrence.ts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_series (
  id              BIGSERIAL PRIMARY KEY,
  nazev           TEXT NOT NULL,
  zakladatel_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pocet_lidi      INT NOT NULL DEFAULT 1 CHECK (pocet_lidi >= 1),
  is_group        BOOLEAN NOT NULL DEFAULT FALSE,
  cas_od          TIME NOT NULL,
  cas_do          TIME NOT NULL,
  timezone        TEXT NOT NULL DEFAULT 'Europe/Prague',
  recurrence_rule JSONB NOT NULL,
  valid_from      DATE,
  valid_until     DATE,
  group_id        BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_series_zakladatel ON event_series (zakladatel_id);
CREATE INDEX IF NOT EXISTS idx_event_series_is_group ON event_series (is_group);
CREATE INDEX IF NOT EXISTS idx_event_series_rule_type ON event_series ((recurrence_rule->>'type'));
CREATE INDEX IF NOT EXISTS idx_event_series_group_id ON event_series (group_id);

-- Výjimky pro konkrétní instance série (zrušení / přesun směny)
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
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (series_id, puvodni_den, typ)
);

CREATE INDEX IF NOT EXISTS idx_series_exceptions_series ON series_exceptions (series_id);

-- Účast na skupinové události (vázáno na sérii, ne na instanci)
CREATE TABLE IF NOT EXISTS event_users (
  id        BIGSERIAL PRIMARY KEY,
  series_id BIGINT NOT NULL REFERENCES event_series(id) ON DELETE CASCADE,
  user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_date TEXT, -- Volitelné datum instance pro opakující se události
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (series_id, user_id, instance_date)
);

CREATE INDEX IF NOT EXISTS idx_event_users_series ON event_users (series_id);
CREATE INDEX IF NOT EXISTS idx_event_users_user ON event_users (user_id);

-- Chat u série a instancí
CREATE TABLE IF NOT EXISTS event_messages (
  id            BIGSERIAL PRIMARY KEY,
  series_id     BIGINT NOT NULL REFERENCES event_series(id) ON DELETE CASCADE,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_date TEXT, -- NULL = chat pro celou sérii, YYYY-MM-DD = chat pro konkrétní instanci
  message       TEXT NOT NULL CHECK (char_length(trim(message)) > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Globální chat pro všechny
CREATE TABLE IF NOT EXISTS global_messages (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message    TEXT NOT NULL CHECK (char_length(trim(message)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_global_messages_time ON global_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_messages_series ON event_messages (series_id, created_at);

-- Nastavení upozornění (volitelně synchronizované z klienta)
CREATE TABLE IF NOT EXISTS user_notification_settings (
  user_id        BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  event_changes  BOOLEAN NOT NULL DEFAULT TRUE,
  group_events   BOOLEAN NOT NULL DEFAULT TRUE,
  chat_messages  BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Push tokeny – mobil (FCM)
CREATE TABLE IF NOT EXISTS user_devices (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token  TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Web Push odběry
CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id                   BIGSERIAL PRIMARY KEY,
  user_id              BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_object  JSONB NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, subscription_object)
);

-- -----------------------------------------------------------------------------
-- Legacy tabulky (zachovat během migrace, později smazat)
-- -----------------------------------------------------------------------------
-- events, weekly_events, event_exceptions – viz migration.sql

-- -----------------------------------------------------------------------------
-- Realtime
-- -----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE event_series;
ALTER PUBLICATION supabase_realtime ADD TABLE series_exceptions;
ALTER PUBLICATION supabase_realtime ADD TABLE event_users;
ALTER PUBLICATION supabase_realtime ADD TABLE event_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE global_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE colors;
ALTER PUBLICATION supabase_realtime ADD TABLE users;

-- -----------------------------------------------------------------------------
-- RLS (základ – uprav podle produkce)
-- -----------------------------------------------------------------------------
ALTER TABLE event_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE series_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_series_read" ON event_series FOR SELECT USING (true);
CREATE POLICY "series_exceptions_read" ON series_exceptions FOR SELECT USING (true);
CREATE POLICY "event_users_read" ON event_users FOR SELECT USING (true);
CREATE POLICY "event_messages_read" ON event_messages FOR SELECT USING (true);
CREATE POLICY "event_messages_insert" ON event_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "global_messages_read" ON global_messages FOR SELECT USING (true);
CREATE POLICY "global_messages_insert" ON global_messages FOR INSERT WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- Tabulka pro sledov�n� p�e�ten�ch zpr�v
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_reads (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id TEXT NOT NULL,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, room_id)
);

