
-- Pridani nastaveni notifikaci do tabulky users
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_friend_requests BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_chat_messages BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_global_chat BOOLEAN DEFAULT true;

-- Vytvoreni tabulky muted_chats
CREATE TABLE IF NOT EXISTS muted_chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    chat_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pridani related_user_id pro filtrovani systemovych zprav o narozeninach
ALTER TABLE global_messages ADD COLUMN IF NOT EXISTS related_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
