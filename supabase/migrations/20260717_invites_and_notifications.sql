-- Pozvaní (viditelnost) vs přihlášení (event_users)
-- Osobní inbox notifikací nahrazuje globální chat

CREATE TABLE IF NOT EXISTS event_invites (
  id         BIGSERIAL PRIMARY KEY,
  series_id  BIGINT NOT NULL REFERENCES event_series(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (series_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_invites_series ON event_invites (series_id);
CREATE INDEX IF NOT EXISTS idx_event_invites_user ON event_invites (user_id);

CREATE TABLE IF NOT EXISTS user_notifications (
  id           BIGSERIAL PRIMARY KEY,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  type         TEXT NOT NULL DEFAULT 'info',
  message      TEXT NOT NULL,
  series_id    BIGINT REFERENCES event_series(id) ON DELETE SET NULL,
  instance_date TEXT,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient ON user_notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON user_notifications (recipient_id) WHERE read_at IS NULL;

ALTER TABLE event_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_invites_select" ON event_invites;
CREATE POLICY "event_invites_select" ON event_invites FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM event_series es
      WHERE es.id = event_invites.series_id AND es.zakladatel_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "event_invites_insert" ON event_invites;
CREATE POLICY "event_invites_insert" ON event_invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_series es
      WHERE es.id = series_id AND es.zakladatel_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "event_invites_delete" ON event_invites;
CREATE POLICY "event_invites_delete" ON event_invites FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM event_series es
      WHERE es.id = event_invites.series_id AND es.zakladatel_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "user_notifications_select" ON user_notifications;
CREATE POLICY "user_notifications_select" ON user_notifications FOR SELECT
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "user_notifications_update" ON user_notifications;
CREATE POLICY "user_notifications_update" ON user_notifications FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

DROP POLICY IF EXISTS "user_notifications_insert" ON user_notifications;
CREATE POLICY "user_notifications_insert" ON user_notifications FOR INSERT
  WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

-- Realtime pro inbox
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE user_notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill: existující skupinové události → pozvat accepted přátele zakladatele
INSERT INTO event_invites (series_id, user_id)
SELECT DISTINCT es.id,
  CASE
    WHEN f.user_id = es.zakladatel_id THEN f.friend_id
    ELSE f.user_id
  END
FROM event_series es
JOIN friendships f
  ON f.status = 'accepted'
 AND (f.user_id = es.zakladatel_id OR f.friend_id = es.zakladatel_id)
WHERE es.is_group = true
ON CONFLICT DO NOTHING;

-- Narozeniny: inbox přátelům (ne global_messages)
CREATE OR REPLACE FUNCTION check_and_insert_birthdays()
RETURNS void AS $$
DECLARE
    u RECORD;
    friend RECORD;
    v_age INTEGER;
    v_msg TEXT;
BEGIN
    FOR u IN
        SELECT id, username, datum_narozeni
        FROM users
        WHERE datum_narozeni IS NOT NULL
          AND EXTRACT(MONTH FROM datum_narozeni) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(DAY FROM datum_narozeni) = EXTRACT(DAY FROM CURRENT_DATE)
    LOOP
        v_age := EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM u.datum_narozeni);
        v_msg := u.username || ' má dnes ' || v_age || '. narozeniny!';

        FOR friend IN
            SELECT CASE
                WHEN f.user_id = u.id THEN f.friend_id
                ELSE f.user_id
            END AS friend_id
            FROM friendships f
            WHERE f.status = 'accepted'
              AND (f.user_id = u.id OR f.friend_id = u.id)
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM user_notifications n
                WHERE n.recipient_id = friend.friend_id
                  AND n.actor_id = u.id
                  AND n.type = 'birthday'
                  AND DATE(n.created_at) = CURRENT_DATE
            ) THEN
                INSERT INTO user_notifications (recipient_id, actor_id, type, message)
                VALUES (friend.friend_id, u.id, 'birthday', v_msg);
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
