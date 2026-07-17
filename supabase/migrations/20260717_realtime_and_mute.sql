-- Realtime publication + mute unique + list helpers
-- Spusť v Supabase SQL Editoru

-- 1) Realtime tabulky (idempotentní)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_series;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_users;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.series_exceptions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.colors;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_invites;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 2) Unikátní mute (user + chat)
DELETE FROM muted_chats a
USING muted_chats b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.chat_id = b.chat_id;

CREATE UNIQUE INDEX IF NOT EXISTS muted_chats_user_chat_uidx
  ON muted_chats (user_id, chat_id);
