-- Add instance_date column to event_users table
-- This allows tracking participants for specific instances of recurring events

-- First, drop the existing unique constraint
ALTER TABLE event_users DROP CONSTRAINT IF EXISTS event_users_series_id_user_id_key;

-- Add the instance_date column
ALTER TABLE event_users ADD COLUMN IF NOT EXISTS instance_date TEXT;

-- Add a new unique constraint that includes instance_date
ALTER TABLE event_users ADD CONSTRAINT event_users_series_id_user_id_instance_date_key UNIQUE (series_id, user_id, instance_date);

-- Create index for faster queries on instance_date
CREATE INDEX IF NOT EXISTS idx_event_users_instance_date ON event_users(instance_date);
