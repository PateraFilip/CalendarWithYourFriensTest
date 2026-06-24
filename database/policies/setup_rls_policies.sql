-- RLS Policies for Supabase Auth integration with UUID-based user_id
-- Run this in your Supabase SQL Editor

-- Enable RLS on tables if not already enabled
alter table public.users enable row level security;
alter table public.colors enable row level security;

-- Drop ALL existing policies on users table
drop policy if exists "Users can view own data" on public.users;
drop policy if exists "Users can insert own data" on public.users;
drop policy if exists "Users can update own data" on public.users;
drop policy if exists "Public can read users" on public.users;
drop policy if exists "Service role can insert users" on public.users;
drop policy if exists "Service role can update users" on public.users;

-- Drop ALL existing policies on colors table
drop policy if exists "Users can view own colors" on public.colors;
drop policy if exists "Users can insert colors" on public.colors;
drop policy if exists "Users can update own colors" on public.colors;
drop policy if exists "Public can read colors" on public.colors;
drop policy if exists "Service role can update colors" on public.colors;

-- Users table policies
-- Allow everyone to read users (for calendar sharing)
create policy "Public can read users"
on public.users for select
using (true);

-- Allow service role (trigger) to insert users
create policy "Service role can insert users"
on public.users for insert
with check (auth.role() = 'service_role');

-- Allow service role (trigger) to update users
create policy "Service role can update users"
on public.users for update
using (auth.role() = 'service_role');

-- Colors table policies
-- Allow everyone to read colors (critical for registration)
create policy "Public can read colors"
on public.colors for select
using (true);

-- Allow service role (trigger) to update colors
create policy "Service role can update colors"
on public.colors for update
using (auth.role() = 'service_role');

-- Allow authenticated users to insert colors (if needed)
create policy "Users can insert colors"
on public.colors for insert
with check (auth.role() = 'service_role');

-- Allow authenticated users to update their own colors using UUID matching
create policy "Users can update own colors"
on public.colors for update
using (
  colors.user_id = auth.uid() -- Direct UUID comparison
  or auth.role() = 'service_role'
);

-- Verify policies
select 'RLS policies created successfully for UUID-based system' as status;
