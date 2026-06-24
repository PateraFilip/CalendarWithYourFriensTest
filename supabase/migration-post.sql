-- =============================================================================
-- POST-MIGRACE: spusť v NOVÉM projektu po migrate-from-old-supabase.mjs
-- Nastaví sekvence ID podle max hodnot
-- =============================================================================

SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));
SELECT setval(pg_get_serial_sequence('colors', 'id'), COALESCE((SELECT MAX(id) FROM colors), 1));
SELECT setval(pg_get_serial_sequence('event_series', 'id'), COALESCE((SELECT MAX(id) FROM event_series), 1));
SELECT setval(pg_get_serial_sequence('series_exceptions', 'id'), COALESCE((SELECT MAX(id) FROM series_exceptions), 1));
SELECT setval(pg_get_serial_sequence('event_users', 'id'), COALESCE((SELECT MAX(id) FROM event_users), 1));
SELECT setval(pg_get_serial_sequence('event_messages', 'id'), COALESCE((SELECT MAX(id) FROM event_messages), 1));
SELECT setval(pg_get_serial_sequence('user_devices', 'id'), COALESCE((SELECT MAX(id) FROM user_devices), 1));
SELECT setval(pg_get_serial_sequence('web_push_subscriptions', 'id'), COALESCE((SELECT MAX(id) FROM web_push_subscriptions), 1));
SELECT setval(pg_get_serial_sequence('password_resets', 'id'), COALESCE((SELECT MAX(id) FROM password_resets), 1));

-- Ověření počtů
SELECT 'users' AS tabulka, COUNT(*) AS pocet FROM users
UNION ALL SELECT 'event_series', COUNT(*) FROM event_series
UNION ALL SELECT 'series_exceptions', COUNT(*) FROM series_exceptions
UNION ALL SELECT 'event_users', COUNT(*) FROM event_users
UNION ALL SELECT 'event_messages', COUNT(*) FROM event_messages;
