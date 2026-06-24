-- Spusť v Supabase SQL Editoru (nový projekt)

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_read" ON users;
CREATE POLICY "users_read" ON users FOR SELECT USING (true);
DROP POLICY IF EXISTS "users_update" ON users;
CREATE POLICY "users_update" ON users FOR UPDATE USING (true) WITH CHECK (true);

ALTER TABLE colors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "colors_read" ON colors;
CREATE POLICY "colors_read" ON colors FOR SELECT USING (true);
DROP POLICY IF EXISTS "colors_update" ON colors;
CREATE POLICY "colors_update" ON colors FOR UPDATE USING (true) WITH CHECK (true);

ALTER TABLE event_series ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_series_read" ON event_series;
CREATE POLICY "event_series_read" ON event_series FOR SELECT USING (true);
DROP POLICY IF EXISTS "event_series_insert" ON event_series;
CREATE POLICY "event_series_insert" ON event_series FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "event_series_update" ON event_series;
CREATE POLICY "event_series_update" ON event_series FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "event_series_delete" ON event_series;
CREATE POLICY "event_series_delete" ON event_series FOR DELETE USING (true);

ALTER TABLE series_exceptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "series_exceptions_read" ON series_exceptions;
CREATE POLICY "series_exceptions_read" ON series_exceptions FOR SELECT USING (true);
DROP POLICY IF EXISTS "series_exceptions_insert" ON series_exceptions;
CREATE POLICY "series_exceptions_insert" ON series_exceptions FOR INSERT WITH CHECK (true);

ALTER TABLE event_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_users_read" ON event_users;
CREATE POLICY "event_users_read" ON event_users FOR SELECT USING (true);
DROP POLICY IF EXISTS "event_users_insert" ON event_users;
CREATE POLICY "event_users_insert" ON event_users FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "event_users_delete" ON event_users;
CREATE POLICY "event_users_delete" ON event_users FOR DELETE USING (true);

ALTER TABLE event_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_messages_read" ON event_messages;
CREATE POLICY "event_messages_read" ON event_messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "event_messages_insert" ON event_messages;
CREATE POLICY "event_messages_insert" ON event_messages FOR INSERT WITH CHECK (true);

ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_devices_all" ON user_devices;
CREATE POLICY "user_devices_all" ON user_devices FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE web_push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "web_push_all" ON web_push_subscriptions;
CREATE POLICY "web_push_all" ON web_push_subscriptions FOR ALL USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- chat_reads
-- -----------------------------------------------------------------------------
ALTER TABLE chat_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reads" ON chat_reads FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can insert own reads" ON chat_reads FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update own reads" ON chat_reads FOR UPDATE USING (auth.uid()::text = user_id::text);

