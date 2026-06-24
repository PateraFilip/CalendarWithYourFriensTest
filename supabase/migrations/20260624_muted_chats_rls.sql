
-- Enable RLS
ALTER TABLE muted_chats ENABLE ROW LEVEL SECURITY;

-- Allow users to select their own muted chats
CREATE POLICY "Users can view own muted chats" 
ON muted_chats FOR SELECT 
USING (auth.uid() = user_id);

-- Allow users to insert their own muted chats
CREATE POLICY "Users can insert own muted chats" 
ON muted_chats FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own muted chats
CREATE POLICY "Users can delete own muted chats" 
ON muted_chats FOR DELETE 
USING (auth.uid() = user_id);
