-- Migrate all user_id columns from bigint to uuid
-- Run this in Supabase SQL Editor

-- Option 1: Clear existing data and then migrate (simpler but loses data)
-- Uncomment the delete statements below if you want to clear data first

delete from public.event_messages;
delete from public.event_users;
delete from public.password_resets;
delete from public.user_notification_settings;
delete from public.web_push_subscriptions;

-- Now migrate the columns (since data is cleared, we can use simple casting)

-- event_messages table
alter table public.event_messages alter column user_id type uuid using user_id::text::uuid;

-- event_users table
alter table public.event_users alter column user_id type uuid using user_id::text::uuid;

-- password_resets table (if still needed)
alter table public.password_resets alter column user_id type uuid using user_id::text::uuid;

-- user_notification_settings table
alter table public.user_notification_settings alter column user_id type uuid using user_id::text::uuid;

-- web_push_subscriptions table
alter table public.web_push_subscriptions alter column user_id type uuid using user_id::text::uuid;

select 'All user_id columns migrated to UUID successfully' as status;
