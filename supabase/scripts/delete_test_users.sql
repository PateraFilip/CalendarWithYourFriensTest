-- =============================================================================
-- Smazání testovacích uživatelů + závislých záznamů
-- Spusť v Supabase → SQL Editor (role postgres / service).
--
-- 1) Doplň username nebo e-maily níže
-- 2) Spusť NEJDŘÍV blok PREVIEW
-- 3) Pak blok DELETE
--
-- Poznámka: event_series, které uživatel ZALOŽIL, se smažou celé (včetně
-- účastníků/chatů u těch sérií). Účast na cizích událostech se jen odpojí.
-- =============================================================================

-- >>> UPRAV SEZNAM <<<
CREATE TEMP TABLE tmp_delete_users AS
SELECT u.id, u.username, u.email
FROM public.users u
WHERE u.username IN (
    'test1',          -- nahraď
    'test2',
    'test3'
  )
   OR lower(u.email) IN (
    'test1@example.com',  -- nebo e-maily
    'test2@example.com',
    'test3@example.com'
  );

-- ---------- PREVIEW (spusť samostatně / nejdřív) ----------
SELECT * FROM tmp_delete_users;

SELECT 'event_series (owner)' AS tbl, count(*)::bigint AS n
FROM event_series WHERE zakladatel_id IN (SELECT id FROM tmp_delete_users)
UNION ALL
SELECT 'event_users', count(*) FROM event_users WHERE user_id IN (SELECT id FROM tmp_delete_users)
UNION ALL
SELECT 'event_invites', count(*) FROM event_invites WHERE user_id IN (SELECT id FROM tmp_delete_users)
UNION ALL
SELECT 'event_messages', count(*) FROM event_messages WHERE user_id IN (SELECT id FROM tmp_delete_users)
UNION ALL
SELECT 'friendships', count(*) FROM friendships
  WHERE user_id IN (SELECT id FROM tmp_delete_users)
     OR friend_id IN (SELECT id FROM tmp_delete_users)
UNION ALL
SELECT 'user_notifications (recipient)', count(*) FROM user_notifications
  WHERE recipient_id IN (SELECT id FROM tmp_delete_users)
UNION ALL
SELECT 'user_notifications (actor)', count(*) FROM user_notifications
  WHERE actor_id IN (SELECT id FROM tmp_delete_users)
UNION ALL
SELECT 'user_devices', count(*) FROM user_devices WHERE user_id IN (SELECT id FROM tmp_delete_users)
UNION ALL
SELECT 'web_push_subscriptions', count(*) FROM web_push_subscriptions WHERE user_id IN (SELECT id FROM tmp_delete_users)
UNION ALL
SELECT 'chat_reads', count(*) FROM chat_reads WHERE user_id IN (SELECT id FROM tmp_delete_users)
UNION ALL
SELECT 'colors', count(*) FROM colors WHERE user_id IN (SELECT id FROM tmp_delete_users)
UNION ALL
SELECT 'league_players', count(*) FROM league_players WHERE user_id IN (SELECT id FROM tmp_delete_users)
UNION ALL
SELECT 'league_match_participants', count(*) FROM league_match_participants WHERE user_id IN (SELECT id FROM tmp_delete_users)
UNION ALL
SELECT 'muted_chats', count(*) FROM muted_chats WHERE user_id IN (SELECT id FROM tmp_delete_users);

-- ---------- DELETE ----------
-- Pořadí: nejdřív věci bez spolehlivého CASCADE / SET NULL, pak auth.users
BEGIN;

-- Barvy: UNIQUE(user_id) — uvolni vazbu (FK je SET NULL, ale pro jistotu)
UPDATE colors SET user_id = NULL WHERE user_id IN (SELECT id FROM tmp_delete_users);

-- Actor v oznámeních (FK SET NULL) — ať nezůstane „duch“
UPDATE user_notifications
SET actor_id = NULL
WHERE actor_id IN (SELECT id FROM tmp_delete_users);

-- Ligy: created_by SET NULL
UPDATE leagues SET created_by = NULL WHERE created_by IN (SELECT id FROM tmp_delete_users);
UPDATE league_matches SET created_by = NULL WHERE created_by IN (SELECT id FROM tmp_delete_users);

-- Mute (pokud tabulka existuje)
DELETE FROM muted_chats WHERE user_id IN (SELECT id FROM tmp_delete_users);

-- Hlavní cascade: smazání v Auth smaže public.users a většinu závislostí
DELETE FROM auth.users
WHERE id IN (SELECT id FROM tmp_delete_users);

-- Kdyby někdo zbyl jen v public.users (bez auth řádku):
DELETE FROM public.users
WHERE id IN (SELECT id FROM tmp_delete_users);

COMMIT;

-- Ověření
SELECT count(*) AS remaining_public_users
FROM public.users
WHERE id IN (SELECT id FROM tmp_delete_users);
-- tmp tabulka zanikne s koncem session
