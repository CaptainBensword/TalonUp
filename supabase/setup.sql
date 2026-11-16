-- TalonUp database + storage setup
-- Paste this entire file into Supabase > SQL Editor > New query and run it.
-- This creates public video profiles, moderation, reports, and a public media bucket.
-- Every upload must belong to a signed-in user; videos stay pending until an admin approves them.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null default 'TalonUp creator',
  created_at timestamptz not null default now()
);

create table if not exists public.talonup_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 90),
  description text not null default '' check (char_length(description) <= 1200),
  category text not null default 'Other'
    check (category in ('Gaming','Music','Animation','Education','Comedy','Other')),
  video_path text not null,
  thumbnail_path text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create index if not exists videos_public_feed_idx
  on public.videos (status, created_at desc);
create index if not exists videos_owner_idx
  on public.videos (user_id, created_at desc);

create table if not exists public.video_reports (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  details text not null default '' check (char_length(details) <= 500),
  created_at timestamptz not null default now()
);

-- Create a profile automatically when someone registers.
create or replace function public.handle_talonup_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_name text;
  base_name text;
begin
  chosen_name := left(
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'creator'),
    32
  );
  base_name := lower(regexp_replace(chosen_name, '[^a-zA-Z0-9_]+', '_', 'g'));
  if base_name = '' then base_name := 'creator'; end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, base_name || '_' || substr(new.id::text, 1, 6), chosen_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_talonup_user_created on auth.users;
create trigger on_talonup_user_created
  after insert on auth.users
  for each row execute procedure public.handle_talonup_new_user();

-- Only the private admin table controls review permissions.
create or replace function public.is_talon_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.talonup_admins
    where user_id = auth.uid()
  );
$$;

grant execute on function public.is_talon_admin() to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.talonup_admins enable row level security;
alter table public.videos enable row level security;
alter table public.video_reports enable row level security;

-- Explicit API grants; Row Level Security below still decides which rows are visible.
grant select on public.profiles to anon, authenticated;
grant select, insert, update, delete on public.videos to anon, authenticated;
grant select, insert on public.video_reports to authenticated;

drop policy if exists "Public profiles are viewable" on public.profiles;
create policy "Public profiles are viewable"
  on public.profiles for select
  using (true);

-- No client-side policy exists for editing admin membership.
-- Profile creation is handled by the secure auth trigger.

drop policy if exists "Public can view approved videos and owners can view theirs" on public.videos;
create policy "Public can view approved videos and owners can view theirs"
  on public.videos for select
  using (status = 'approved' or user_id = auth.uid() or public.is_talon_admin());

drop policy if exists "Signed in users can submit their own videos" on public.videos;
create policy "Signed in users can submit their own videos"
  on public.videos for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "Only admins can moderate videos" on public.videos;
create policy "Only admins can moderate videos"
  on public.videos for update to authenticated
  using (public.is_talon_admin())
  with check (public.is_talon_admin());

drop policy if exists "Owners and admins can delete videos" on public.videos;
create policy "Owners and admins can delete videos"
  on public.videos for delete to authenticated
  using (user_id = auth.uid() or public.is_talon_admin());

drop policy if exists "Signed in users can report videos" on public.video_reports;
create policy "Signed in users can report videos"
  on public.video_reports for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists "Only admins can read reports" on public.video_reports;
create policy "Only admins can read reports"
  on public.video_reports for select to authenticated
  using (public.is_talon_admin());

-- Public bucket means approved videos can play without requiring an account.
-- The database feed only returns approved videos. Random object paths are generated per upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  52428800,
  array['video/mp4','video/webm','video/quicktime','image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload media to their own folder" on storage.objects;
create policy "Users upload media to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can read their own media metadata" on storage.objects;
create policy "Users can read their own media metadata"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own media" on storage.objects;
create policy "Users can update their own media"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own media" on storage.objects;
create policy "Users can delete their own media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- AFTER creating your account, replace the email below and run this one statement
-- to grant your account upload-review access. Never add admin access from client code.
-- insert into public.talonup_admins (user_id)
-- select id from auth.users where email = 'YOUR-ACCOUNT-EMAIL'
-- on conflict (user_id) do nothing;
