-- Narozeniny: denní cron (8:00 UTC) → check_and_insert_birthdays() → user_notifications → push.
-- Friend accept push: friendships webhook musí být AFTER INSERT OR UPDATE
-- (URL + service role header nastavíš v Dashboardu / skriptu migrace — neukládej secret sem).

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'birthday-notifications') THEN
    PERFORM cron.unschedule('birthday-notifications');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-birthdays') THEN
    PERFORM cron.unschedule('check-birthdays');
  END IF;
END $$;

SELECT cron.schedule('check-birthdays', '0 8 * * *', 'SELECT check_and_insert_birthdays();');
