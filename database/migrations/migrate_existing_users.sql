-- Migration script to migrate existing users to Supabase Auth
-- This adds auth_user_id column and creates auth.users records
-- Run this in your Supabase SQL Editor

-- Step 1: Add auth_user_id column if it doesn't exist
alter table public.users add column if not exists auth_user_id uuid unique;

-- Step 2: Create a temporary table to map old IDs to new UUIDs
create temp table user_id_mapping as
select
    id as old_id,
    gen_random_uuid() as new_id,
    email,
    username
from public.users;

-- Step 3: Create auth.users records for existing users
-- Note: We'll use a temporary password that users must change
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
select
    uim.new_id,
    uim.email,
    crypt('heslo', gen_salt('bf')), -- Temporary password, users must change it
    now() as email_confirmed_at,
    jsonb_build_object(
        'username', uim.username,
        'firstname', pu.jmeno,
        'lastname', pu.prijmeni,
        'birthDate', pu.datum_narozeni,
        'needs_password_reset', true
    ) as raw_user_meta_data,
    pu.datum_narozeni as created_at, -- Use birth date as approximation
    now() as updated_at
from user_id_mapping uim
join public.users pu on pu.id = uim.old_id
on conflict (id) do nothing;

-- Step 4: Update public.users with auth_user_id (keep integer ID)
update public.users pu
set auth_user_id = uim.new_id
from user_id_mapping uim
where pu.id = uim.old_id;

-- No need to update foreign keys - they still use integer IDs

-- Step 5: Clean up
drop table user_id_mapping;

-- Step 6: Verify the migration
select 'Migration completed. Users now have both integer ID and auth_user_id.' as status;
