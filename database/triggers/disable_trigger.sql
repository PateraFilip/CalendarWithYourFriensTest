-- Disable the trigger temporarily to debug the schema error
drop trigger if exists on_auth_user_created on auth.users;
