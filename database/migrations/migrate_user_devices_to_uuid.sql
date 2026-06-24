-- Migrate user_devices.user_id from bigint to uuid
-- Run this in Supabase SQL Editor

-- First, drop existing data if needed (optional)
-- delete from public.user_devices;

-- Alter the column type
alter table public.user_devices alter column user_id type uuid using user_id::text::uuid;
