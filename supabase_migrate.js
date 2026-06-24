const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://sdzyhihtqrgsntbxlugp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkenloaWh0cXJnc250YnhsdWdwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU0OTYxMSwiZXhwIjoyMDk2MTI1NjExfQ.Zp5v2kC1yM5XlT0UqT_bY9gD18k-t018j3kL49T5Y58');

const query = `
CREATE TABLE IF NOT EXISTS chat_reads (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id TEXT NOT NULL,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, room_id)
);

ALTER TABLE chat_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reads" ON chat_reads;
DROP POLICY IF EXISTS "Users can insert own reads" ON chat_reads;
DROP POLICY IF EXISTS "Users can update own reads" ON chat_reads;

CREATE POLICY "Users can view own reads" ON chat_reads FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can insert own reads" ON chat_reads FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update own reads" ON chat_reads FOR UPDATE USING (auth.uid()::text = user_id::text);
`;

supabase.rpc('exec_sql', { sql: query }).then(console.log).catch(console.error);
