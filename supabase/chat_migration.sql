-- ==========================================
-- MIGRACE: CHAT SYSTÉM
-- Zkopíruj tento kód a spusť ho v Supabase SQL Editoru
-- ==========================================

-- 1. Tabulka pro Globální Chat
CREATE TABLE IF NOT EXISTS global_messages (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message    TEXT NOT NULL CHECK (char_length(trim(message)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pro rychlejší načítání zpráv podle času
CREATE INDEX IF NOT EXISTS idx_global_messages_time ON global_messages (created_at DESC);

-- 2. Přidání sloupce pro identifikaci instance v event_messages
ALTER TABLE event_messages ADD COLUMN IF NOT EXISTS instance_date TEXT;

-- 3. Aktualizace Realtime
-- Ujistíme se, že tabulky posílají změny
ALTER PUBLICATION supabase_realtime ADD TABLE global_messages;

-- 4. Nastavení RLS (Row Level Security)
ALTER TABLE global_messages ENABLE ROW LEVEL SECURITY;

-- Kdokoliv přihlášený (nebo všichni, pokud nemáš striktní auth na API úrovni) může číst a psát
CREATE POLICY "global_messages_read" ON global_messages FOR SELECT USING (true);
CREATE POLICY "global_messages_insert" ON global_messages FOR INSERT WITH CHECK (true);

-- (Možná oprava existující tabulky event_messages pro jistotu)
ALTER TABLE event_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_messages_read" ON event_messages;
DROP POLICY IF EXISTS "event_messages_insert" ON event_messages;
CREATE POLICY "event_messages_read" ON event_messages FOR SELECT USING (true);
CREATE POLICY "event_messages_insert" ON event_messages FOR INSERT WITH CHECK (true);
