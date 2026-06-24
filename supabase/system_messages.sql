-- Přidání sloupce is_system_message do obou chatovacích tabulek
ALTER TABLE event_messages ADD COLUMN IF NOT EXISTS is_system_message BOOLEAN DEFAULT false;
ALTER TABLE global_messages ADD COLUMN IF NOT EXISTS is_system_message BOOLEAN DEFAULT false;
