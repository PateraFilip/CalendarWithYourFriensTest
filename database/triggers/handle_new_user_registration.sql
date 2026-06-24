-- SQL Trigger for handling new user registration
-- Run this in your Supabase SQL Editor

-- First, add auth_user_id column if it doesn't exist
alter table public.users add column if not exists auth_user_id uuid unique;

-- 1. Create function to handle new user registration
create or replace function public.handle_new_user_registration()
returns trigger as $$
declare
  new_user_id bigint;
begin
  -- Generate a new integer ID for the user
  select coalesce(max(id), 0) + 1 into new_user_id from public.users;

  -- Insert user data into public.users table
  insert into public.users (id, auth_user_id, username, email, jmeno, prijmeni, datum_narozeni)
  values (
    new_user_id, -- Integer ID
    new.id, -- UUID from auth.users
    new.raw_user_meta_data->>'username',
    new.email,
    new.raw_user_meta_data->>'firstname',
    new.raw_user_meta_data->>'lastname',
    (new.raw_user_meta_data->>'birthDate')::date
  )
  on conflict (auth_user_id) do nothing; -- Prevent duplicate inserts

  -- Assign color to user if colorId is provided
  if (new.raw_user_meta_data->>'colorId') is not null then
    update public.colors
    set user_id = new_user_id
    where id = (new.raw_user_meta_data->>'colorId')::integer
      and user_id is null; -- Only assign if color is available
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- 2. Create trigger on auth.users table
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user_registration();
