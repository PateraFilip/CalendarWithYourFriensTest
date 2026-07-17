-- Zpřísnění RLS: auth.uid() = public.users.id
-- Spusť po migracích invites/notifications a pair ratings.

CREATE OR REPLACE FUNCTION public.is_accepted_friend(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted'
      AND (
        (f.user_id = a AND f.friend_id = b)
        OR (f.user_id = b AND f.friend_id = a)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_series(p_series_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM event_series es
    WHERE es.id = p_series_id
      AND (
        es.zakladatel_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM event_invites ei
          WHERE ei.series_id = es.id AND ei.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM event_users eu
          WHERE eu.series_id = es.id AND eu.user_id = auth.uid()
        )
        OR (
          COALESCE(es.is_group, false) = false
          AND public.is_accepted_friend(auth.uid(), es.zakladatel_id)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_series_owner(p_series_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM event_series es
    WHERE es.id = p_series_id AND es.zakladatel_id = auth.uid()
  );
$$;

-- users
DROP POLICY IF EXISTS "users_read" ON users;
CREATE POLICY "users_read" ON users FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "users_update" ON users;
CREATE POLICY "users_update" ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "users_insert" ON users;
CREATE POLICY "users_insert" ON users FOR INSERT
  WITH CHECK (id = auth.uid());

-- colors
DROP POLICY IF EXISTS "colors_read" ON colors;
CREATE POLICY "colors_read" ON colors FOR SELECT
  USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "colors_update" ON colors;
CREATE POLICY "colors_update" ON colors FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "colors_insert" ON colors;
CREATE POLICY "colors_insert" ON colors FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- event_series
DROP POLICY IF EXISTS "event_series_read" ON event_series;
CREATE POLICY "event_series_read" ON event_series FOR SELECT
  USING (public.can_view_series(id));

DROP POLICY IF EXISTS "event_series_insert" ON event_series;
CREATE POLICY "event_series_insert" ON event_series FOR INSERT
  WITH CHECK (zakladatel_id = auth.uid());

DROP POLICY IF EXISTS "event_series_update" ON event_series;
CREATE POLICY "event_series_update" ON event_series FOR UPDATE
  USING (zakladatel_id = auth.uid())
  WITH CHECK (zakladatel_id = auth.uid());

DROP POLICY IF EXISTS "event_series_delete" ON event_series;
CREATE POLICY "event_series_delete" ON event_series FOR DELETE
  USING (zakladatel_id = auth.uid());

-- series_exceptions
DROP POLICY IF EXISTS "series_exceptions_read" ON series_exceptions;
CREATE POLICY "series_exceptions_read" ON series_exceptions FOR SELECT
  USING (public.can_view_series(series_id));

DROP POLICY IF EXISTS "series_exceptions_insert" ON series_exceptions;
CREATE POLICY "series_exceptions_insert" ON series_exceptions FOR INSERT
  WITH CHECK (public.is_series_owner(series_id));

DROP POLICY IF EXISTS "series_exceptions_update" ON series_exceptions;
CREATE POLICY "series_exceptions_update" ON series_exceptions FOR UPDATE
  USING (public.is_series_owner(series_id))
  WITH CHECK (public.is_series_owner(series_id));

DROP POLICY IF EXISTS "series_exceptions_delete" ON series_exceptions;
CREATE POLICY "series_exceptions_delete" ON series_exceptions FOR DELETE
  USING (public.is_series_owner(series_id));

-- event_users
DROP POLICY IF EXISTS "event_users_read" ON event_users;
CREATE POLICY "event_users_read" ON event_users FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.can_view_series(series_id)
  );

DROP POLICY IF EXISTS "event_users_insert" ON event_users;
CREATE POLICY "event_users_insert" ON event_users FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_series_owner(series_id)
  );

DROP POLICY IF EXISTS "event_users_delete" ON event_users;
CREATE POLICY "event_users_delete" ON event_users FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.is_series_owner(series_id)
  );

DROP POLICY IF EXISTS "event_users_update" ON event_users;
CREATE POLICY "event_users_update" ON event_users FOR UPDATE
  USING (
    user_id = auth.uid()
    OR public.is_series_owner(series_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_series_owner(series_id)
  );

-- event_messages
DROP POLICY IF EXISTS "event_messages_read" ON event_messages;
CREATE POLICY "event_messages_read" ON event_messages FOR SELECT
  USING (public.can_view_series(series_id));

DROP POLICY IF EXISTS "event_messages_insert" ON event_messages;
CREATE POLICY "event_messages_insert" ON event_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_view_series(series_id)
  );

-- user_devices
DROP POLICY IF EXISTS "user_devices_all" ON user_devices;
CREATE POLICY "user_devices_select" ON user_devices FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "user_devices_insert" ON user_devices FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_devices_update" ON user_devices FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_devices_delete" ON user_devices FOR DELETE
  USING (user_id = auth.uid());

-- web_push_subscriptions
DROP POLICY IF EXISTS "web_push_all" ON web_push_subscriptions;
CREATE POLICY "web_push_select" ON web_push_subscriptions FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "web_push_insert" ON web_push_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "web_push_update" ON web_push_subscriptions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "web_push_delete" ON web_push_subscriptions FOR DELETE
  USING (user_id = auth.uid());

-- league_pair_ratings (pokud tabulka existuje)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'league_pair_ratings'
  ) THEN
    ALTER TABLE league_pair_ratings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "league_pair_ratings_all" ON league_pair_ratings;
    DROP POLICY IF EXISTS "league_pair_ratings_select" ON league_pair_ratings;
    DROP POLICY IF EXISTS "league_pair_ratings_write" ON league_pair_ratings;
    CREATE POLICY "league_pair_ratings_select" ON league_pair_ratings FOR SELECT
      USING (auth.uid() IS NOT NULL);
    CREATE POLICY "league_pair_ratings_write" ON league_pair_ratings FOR ALL
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Birthday cron: vždy user_notifications (ne global_messages)
-- (idempotentní — přepíše starší definici pokud existuje pg_cron)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('birthday-notifications')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'birthday-notifications'
    );
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'cron unschedule skipped: %', SQLERRM;
END $$;
