-- HEYY STUDIO — assign the Supabase admin role
-- Run this manually in Supabase SQL Editor BEFORE installing proxy.ts.
-- Replace the email below with the exact email used to sign in to Heyy Studio.

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'admin')
where lower(email) = lower('REPLACE_WITH_YOUR_ADMIN_EMAIL');

-- Confirm the role was applied. This should return one row with role = admin.
select
  id,
  email,
  raw_app_meta_data ->> 'role' as role
from auth.users
where lower(email) = lower('REPLACE_WITH_YOUR_ADMIN_EMAIL');

-- To remove admin access later, run:
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'role'
-- where lower(email) = lower('REPLACE_WITH_YOUR_ADMIN_EMAIL');
