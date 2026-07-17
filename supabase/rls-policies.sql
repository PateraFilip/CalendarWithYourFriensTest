-- Aktuální RLS politiky (synchronní s migrations/20260717_tighten_rls.sql)
-- Spusť v Supabase SQL Editoru po ostatních migracích.

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

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_read" ON users;
CREATE POLICY "users_read" ON users FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "users_update" ON users;
CREATE POLICY "users_update" ON users FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "users_insert" ON users;
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (id = auth.uid());

ALTER TABLE colors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "colors_read" ON colors;
CREATE POLICY "colors_read" ON colors FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "colors_update" ON colors;
CREATE POLICY "colors_update" ON colors FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "colors_insert" ON colors;
CREATE POLICY "colors_insert" ON colors FOR INSERT WITH CHECK (user_id = auth.uid());

ALTER TABLE event_series ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_series_read" ON event_series;
CREATE POLICY "event_series_read" ON event_series FOR SELECT USING (public.can_view_series(id));
DROP POLICY IF EXISTS "event_series_insert" ON event_series;
CREATE POLICY "event_series_insert" ON event_series FOR INSERT WITH CHECK (zakladatel_id = auth.uid());
DROP POLICY IF EXISTS "event_series_update" ON event_series;
CREATE POLICY "event_series_update" ON event_series FOR UPDATE USING (zakladatel_id = auth.uid()) WITH CHECK (zakladatel_id = auth.uid());
DROP POLICY IF EXISTS "event_series_delete" ON event_series;
CREATE POLICY "event_series_delete" ON event_series FOR DELETE USING (zakladatel_id = auth.uid());

ALTER TABLE series_exceptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "series_exceptions_read" ON series_exceptions;
CREATE POLICY "series_exceptions_read" ON series_exceptions FOR SELECT USING (public.can_view_series(series_id));
DROP POLICY IF EXISTS "series_exceptions_insert" ON series_exceptions;
CREATE POLICY "series_exceptions_insert" ON series_exceptions FOR INSERT WITH CHECK (public.is_series_owner(series_id));
DROP POLICY IF EXISTS "series_exceptions_update" ON series_exceptions;
CREATE POLICY "series_exceptions_update" ON series_exceptions FOR UPDATE USING (public.is_series_owner(series_id)) WITH CHECK (public.is_series_owner(series_id));
DROP POLICY IF EXISTS "series_exceptions_delete" ON series_exceptions;
CREATE POLICY "series_exceptions_delete" ON series_exceptions FOR DELETE USING (public.is_series_owner(series_id));

ALTER TABLE event_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_users_read" ON event_users;
CREATE POLICY "event_users_read" ON event_users FOR SELECT USING (user_id = auth.uid() OR public.can_view_series(series_id));
DROP POLICY IF EXISTS "event_users_insert" ON event_users;
CREATE POLICY "event_users_insert" ON event_users FOR INSERT WITH CHECK (user_id = auth.uid() OR public.is_series_owner(series_id));
DROP POLICY IF EXISTS "event_users_delete" ON event_users;
CREATE POLICY "event_users_delete" ON event_users FOR DELETE USING (user_id = auth.uid() OR public.is_series_owner(series_id));
DROP POLICY IF EXISTS "event_users_update" ON event_users;
CREATE POLICY "event_users_update" ON event_users FOR UPDATE USING (user_id = auth.uid() OR public.is_series_owner(series_id)) WITH CHECK (user_id = auth.uid() OR public.is_series_owner(series_id));

ALTER TABLE event_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_messages_read" ON event_messages;
CREATE POLICY "event_messages_read" ON event_messages FOR SELECT USING (public.can_view_series(series_id));
DROP POLICY IF EXISTS "event_messages_insert" ON event_messages;
CREATE POLICY "event_messages_insert" ON event_messages FOR INSERT WITH CHECK (user_id = auth.uid() AND public.can_view_series(series_id));

ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_devices_all" ON user_devices;
DROP POLICY IF EXISTS "user_devices_select" ON user_devices;
DROP POLICY IF EXISTS "user_devices_insert" ON user_devices;
DROP POLICY IF EXISTS "user_devices_update" ON user_devices;
DROP POLICY IF EXISTS "user_devices_delete" ON user_devices;
CREATE POLICY "user_devices_select" ON user_devices FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_devices_insert" ON user_devices FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_devices_update" ON user_devices FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_devices_delete" ON user_devices FOR DELETE USING (user_id = auth.uid());

ALTER TABLE web_push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "web_push_all" ON web_push_subscriptions;
DROP POLICY IF EXISTS "web_push_select" ON web_push_subscriptions;
DROP POLICY IF EXISTS "web_push_insert" ON web_push_subscriptions;
DROP POLICY IF EXISTS "web_push_update" ON web_push_subscriptions;
DROP POLICY IF EXISTS "web_push_delete" ON web_push_subscriptions;
CREATE POLICY "web_push_select" ON web_push_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "web_push_insert" ON web_push_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "web_push_update" ON web_push_subscriptions FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "web_push_delete" ON web_push_subscriptions FOR DELETE USING (user_id = auth.uid());

ALTER TABLE chat_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own reads" ON chat_reads;
DROP POLICY IF EXISTS "Users can insert own reads" ON chat_reads;
DROP POLICY IF EXISTS "Users can update own reads" ON chat_reads;
CREATE POLICY "Users can view own reads" ON chat_reads FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can insert own reads" ON chat_reads FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update own reads" ON chat_reads FOR UPDATE USING (auth.uid()::text = user_id::text);

ALTER TABLE event_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_invites_select" ON event_invites;
CREATE POLICY "event_invites_select" ON event_invites FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM event_series es WHERE es.id = event_invites.series_id AND es.zakladatel_id = auth.uid())
  );
DROP POLICY IF EXISTS "event_invites_insert" ON event_invites;
CREATE POLICY "event_invites_insert" ON event_invites FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM event_series es WHERE es.id = series_id AND es.zakladatel_id = auth.uid()));
DROP POLICY IF EXISTS "event_invites_delete" ON event_invites;
CREATE POLICY "event_invites_delete" ON event_invites FOR DELETE
  USING (EXISTS (SELECT 1 FROM event_series es WHERE es.id = event_invites.series_id AND es.zakladatel_id = auth.uid()));

ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_notifications_select" ON user_notifications;
CREATE POLICY "user_notifications_select" ON user_notifications FOR SELECT USING (recipient_id = auth.uid());
DROP POLICY IF EXISTS "user_notifications_update" ON user_notifications;
CREATE POLICY "user_notifications_update" ON user_notifications FOR UPDATE USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());
DROP POLICY IF EXISTS "user_notifications_insert" ON user_notifications;
CREATE POLICY "user_notifications_insert" ON user_notifications FOR INSERT WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'league_pair_ratings'
  ) THEN
    ALTER TABLE league_pair_ratings ENABLE ROW LEVEL SECURITY;
    -- Kompletní politiky: migrations/20260717_friendships_leagues_rls.sql
  END IF;
END $$;

-- Friendships + leagues RLS: spusť také
--   migrations/20260717_friendships_leagues_rls.sql

