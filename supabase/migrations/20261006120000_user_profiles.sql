-- Profile data (name, phone, avatar URL...) lives here instead of auth user_metadata.
-- user_metadata is embedded in the JWT / session cookie, so large values caused
-- 494 REQUEST_HEADER_TOO_LARGE errors. Only the service role reads/writes this table.
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  phone text,
  department text,
  location text,
  avatar_url text check (avatar_url is null or length(avatar_url) <= 500),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
-- No policies on purpose: anon/authenticated cannot access it; the server uses the service role.
revoke all on public.user_profiles from anon, authenticated;
grant all on public.user_profiles to service_role;
