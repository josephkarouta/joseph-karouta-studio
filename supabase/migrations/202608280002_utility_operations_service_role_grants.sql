-- Utility billing server access hardening.
-- The initial utility migration intentionally keeps browser writes behind RPCs,
-- but the server-side usage/paid-fallback routes also read and insert operation
-- rows using the Supabase service role. Grant only those required privileges.

grant usage on schema public to service_role;
grant select, insert on table public.utility_operations to service_role;
