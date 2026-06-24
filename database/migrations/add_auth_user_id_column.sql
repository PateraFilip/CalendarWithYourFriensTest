-- Add auth_user_id column to users table
alter table public.users add column if not exists auth_user_id uuid unique;
