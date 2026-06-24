-- =============================================================================
-- CROSS-PROJECT MIGRACE: starý Supabase → nový Supabase
-- =============================================================================
--
-- DOPORUČENÝ POSTUP (nejjednodušší):
--   1. Nový projekt: spusť schema.sql
--   2. Terminál (PowerShell):
--        $env:OLD_SUPABASE_SERVICE_ROLE_KEY="klíč-ze-starého-projektu"
--        $env:NEW_SUPABASE_URL="https://NOVY-REF.supabase.co"
--        $env:NEW_SUPABASE_SERVICE_ROLE_KEY="klíč-z-nového-projektu"
--        node supabase/scripts/migrate-from-old-supabase.mjs
--   3. Nový projekt: spusť migration-post.sql
--
-- ALTERNATIVA (čisté SQL přes postgres_fdw – vyžaduje DB heslo starého projektu):
--   Odkomentuj blok METODA A níže. Heslo: Dashboard starého projektu → Settings → Database
--
-- Starý projekt (zdroj): sdzyhihtqrgsntbxlugp
-- Host: db.sdzyhihtqrgsntbxlugp.supabase.co
-- =============================================================================

-- =============================================================================
-- METODA A: postgres_fdw (spusť v SQL Editoru NOVÉHO projektu)
-- =============================================================================
-- Před spuštěním nahraď OLD_DB_PASSWORD heslem k postgres ze starého projektu.


CREATE EXTENSION IF NOT EXISTS postgres_fdw;

DROP SERVER IF EXISTS old_supabase CASCADE;

CREATE SERVER old_supabase
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (
    host 'db.sdzyhihtqrgsntbxlugp.supabase.co',
    port '5432',
    dbname 'postgres',
    sslmode 'require'
  );

CREATE USER MAPPING IF NOT EXISTS FOR CURRENT_USER
  SERVER old_supabase
  OPTIONS (user 'postgres', password 'OLD_DB_PASSWORD');

CREATE SCHEMA IF NOT EXISTS old_remote;

IMPORT FOREIGN SCHEMA public
  LIMIT TO (
    users, colors, events, weekly_events, event_exceptions,
    event_users, event_messages, password_resets,
    user_devices, web_push_subscriptions
  )
  FROM SERVER old_supabase
  INTO old_remote;

CREATE TABLE IF NOT EXISTS _migration_weekly_map (
  old_weekly_id   BIGINT PRIMARY KEY,
  new_series_id   BIGINT NOT NULL UNIQUE
);

INSERT INTO users (id, username, heslo, email, jmeno, prijmeni, datum_narozeni)
SELECT id, username, heslo, email, jmeno, prijmeni, datum_narozeni
FROM old_remote.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO colors (id, name, background_color, text_color, user_id)
SELECT id, name, background_color, text_color, user_id
FROM old_remote.colors
ON CONFLICT (id) DO NOTHING;

INSERT INTO password_resets (id, user_id, code, expires_at, used, created_at)
SELECT id, user_id, code, expires_at, used, COALESCE(created_at, NOW())
FROM old_remote.password_resets
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_series (
  id, nazev, zakladatel_id, pocet_lidi, is_group,
  cas_od, cas_do, recurrence_rule, valid_from, valid_until
)
SELECT
  e.id,
  e.nazev,
  e.zakladatel_id,
  COALESCE(e.pocet_lidi, 1),
  COALESCE(e.is_group, false),
  e.cas_od::time,
  e.cas_do::time,
  jsonb_build_object(
    'type', 'once',
    'start_date', e.den_od::text,
    'end_date', COALESCE(e.den_do, e.den_od)::text
  ),
  e.den_od::date,
  COALESCE(e.den_do, e.den_od)::date
FROM old_remote.events e
WHERE NOT COALESCE(e.pravidelnost, false)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  r RECORD;
  new_id BIGINT;
BEGIN
  FOR r IN SELECT * FROM old_remote.weekly_events ORDER BY id LOOP
    INSERT INTO event_series (
      nazev, zakladatel_id, pocet_lidi, is_group,
      cas_od, cas_do, recurrence_rule, valid_from
    ) VALUES (
      r.nazev,
      r.zakladatel_id,
      1,
      false,
      r.cas_od::time,
      r.cas_do::time,
      jsonb_build_object(
        'type', 'weekly',
        'days', jsonb_build_array(trim(r.den)),
        'interval', 1,
        '_legacy_weekly_id', r.id
      ),
      CURRENT_DATE
    )
    RETURNING id INTO new_id;

    INSERT INTO _migration_weekly_map (old_weekly_id, new_series_id)
    VALUES (r.id, new_id)
    ON CONFLICT (old_weekly_id) DO NOTHING;
  END LOOP;
END $$;

INSERT INTO series_exceptions (
  series_id, typ, puvodni_den, puvodni_cas_od, puvodni_cas_do,
  den_od, den_do, cas_od, cas_do
)
SELECT
  COALESCE(m.new_series_id, ex.event_id),
  ex.typ,
  ex.puvodni_den::date,
  ex.puvodni_cas_od::time,
  ex.puvodni_cas_do::time,
  ex.den_od::date,
  ex.den_do::date,
  ex.cas_od::time,
  ex.cas_do::time
FROM old_remote.event_exceptions ex
LEFT JOIN _migration_weekly_map m ON m.old_weekly_id = ex.event_id
WHERE COALESCE(m.new_series_id, ex.event_id) IN (SELECT id FROM event_series);

INSERT INTO event_users (series_id, user_id)
SELECT
  COALESCE(m.new_series_id, eu.event_id),
  eu.user_id
FROM old_remote.event_users eu
LEFT JOIN _migration_weekly_map m ON m.old_weekly_id = eu.event_id
WHERE COALESCE(m.new_series_id, eu.event_id) IN (SELECT id FROM event_series)
ON CONFLICT (series_id, user_id) DO NOTHING;

INSERT INTO event_messages (series_id, user_id, message, created_at)
SELECT
  COALESCE(m.new_series_id, msg.event_id),
  msg.user_id,
  msg.message,
  COALESCE(msg.created_at, NOW())
FROM old_remote.event_messages msg
LEFT JOIN _migration_weekly_map m ON m.old_weekly_id = msg.event_id
WHERE COALESCE(m.new_series_id, msg.event_id) IN (SELECT id FROM event_series);

INSERT INTO user_devices (user_id, fcm_token, created_at)
SELECT user_id, fcm_token, COALESCE(created_at, NOW())
FROM old_remote.user_devices
ON CONFLICT (fcm_token) DO NOTHING;

INSERT INTO web_push_subscriptions (user_id, subscription_object, created_at)
SELECT user_id, subscription_object, COALESCE(created_at, NOW())
FROM old_remote.web_push_subscriptions
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM users), 1), 1));
SELECT setval(pg_get_serial_sequence('colors', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM colors), 1), 1));
SELECT setval(pg_get_serial_sequence('event_series', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM event_series), 1), 1));

DROP SCHEMA IF EXISTS old_remote CASCADE;
DROP SERVER IF EXISTS old_supabase CASCADE;


-- =============================================================================
-- METODA B: Node skript (DOPORUČENO)
-- =============================================================================
--   node supabase/scripts/migrate-from-old-supabase.mjs
--   poté: migration-post.sql
