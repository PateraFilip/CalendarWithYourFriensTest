
-- Pridani funkce pro kontrolu narozenin
CREATE OR REPLACE FUNCTION check_and_insert_birthdays()
RETURNS void AS $$
DECLARE
    u RECORD;
    v_age INTEGER;
BEGIN
    FOR u IN 
        SELECT id, username, datum_narozeni 
        FROM users 
        WHERE datum_narozeni IS NOT NULL 
          AND EXTRACT(MONTH FROM datum_narozeni) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(DAY FROM datum_narozeni) = EXTRACT(DAY FROM CURRENT_DATE)
    LOOP
        v_age := EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM u.datum_narozeni);
        
        -- Vlozeni systemove zpravy do global_messages, pokud dnes uz nebyla vlozena
        IF NOT EXISTS (
            SELECT 1 FROM global_messages 
            WHERE related_user_id = u.id 
              AND is_system_message = true 
              AND DATE(created_at) = CURRENT_DATE
        ) THEN
            INSERT INTO global_messages (user_id, message, is_system_message, related_user_id)
            VALUES (u.id, u.username || ' má dnes ' || v_age || '. narozeniny! 🎂', true, u.id);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Povoleni pg_cron (musi se zapnout v Supabase Dashboard -> Database -> Extensions, pokud neni)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Naplanovani spousteni kazdy den v 8:00 rano (UTC)
SELECT cron.schedule('check-birthdays', '0 8 * * *', 'SELECT check_and_insert_birthdays();');
